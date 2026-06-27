import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { createOpaqueToken } from "./auth.js";

type JsonRecord = Record<string, unknown>;

export type ApiWhatsappClient = {
  socketId: string;
  userID: string;
  token: string;
  connectedAt: string;
  lastSeenAt: string;
};

export type AtendenteRecord = {
  id: string;
  socketId: string;
  user_id: string;
  whatsappID: string;
  userLogado: boolean;
  email: string;
  assinaturaActive: boolean;
  assinatura: string;
  activeChat: string;
  connectedAt: string;
  updatedAt: string;
};

export type AtendimentoRecord = JsonRecord & {
  key: string;
  chatID: string;
  whatsappID: string;
  atendente: ReturnType<typeof sanitizeAtendente> | null;
  status: string;
  dataUltimaInteracao: number;
};

export type RuntimeBridge = {
  close(): Promise<void>;
  emitApiEvent(token: string, event: string, payload: JsonRecord): boolean;
  getApiClient(token: string): ReturnType<typeof sanitizeApiClient> | null;
  requestApiLabels(token: string): Promise<unknown[]>;
  requestApiAddOrRemoveLabels(token: string, payload: JsonRecord): Promise<unknown>;
  resetMultiAtendimento(whatsappId?: string): AtendimentoRecord[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeApiClient(client: ApiWhatsappClient) {
  return {
    socketId: client.socketId,
    userID: client.userID,
    token: client.token,
    connectedAt: client.connectedAt,
    lastSeenAt: client.lastSeenAt
  };
}

function normalizeAtendente(payload: unknown, socketId: string, existing?: AtendenteRecord): AtendenteRecord {
  const data = isRecord(payload) ? payload : {};
  const id =
    typeof data.id === "string" && data.id.trim()
      ? data.id.trim()
      : existing?.id ?? `att_${createOpaqueToken("id").slice(-12)}`;

  return {
    id,
    socketId,
    user_id: typeof data.user_id === "string" ? data.user_id : existing?.user_id ?? "",
    whatsappID: typeof data.whatsappID === "string" ? data.whatsappID : existing?.whatsappID ?? "",
    userLogado: typeof data.userLogado === "boolean" ? data.userLogado : existing?.userLogado ?? false,
    email: typeof data.email === "string" ? data.email : existing?.email ?? "",
    assinaturaActive:
      typeof data.assinaturaActive === "boolean"
        ? data.assinaturaActive
        : existing?.assinaturaActive ?? false,
    assinatura: typeof data.assinatura === "string" ? data.assinatura : existing?.assinatura ?? "",
    activeChat: typeof data.activeChat === "string" ? data.activeChat : existing?.activeChat ?? "",
    connectedAt: existing?.connectedAt ?? nowIso(),
    updatedAt: nowIso()
  };
}

function sanitizeAtendente(atendente: AtendenteRecord) {
  return {
    id: atendente.id,
    user_id: atendente.user_id,
    whatsappID: atendente.whatsappID,
    userLogado: atendente.userLogado,
    email: atendente.email,
    assinaturaActive: atendente.assinaturaActive,
    assinatura: atendente.assinatura,
    activeChat: atendente.activeChat,
    connectedAt: atendente.connectedAt,
    updatedAt: atendente.updatedAt
  };
}

function normalizeAtendimento(payload: unknown): AtendimentoRecord | null {
  if (!isRecord(payload)) {
    return null;
  }

  const chatID = typeof payload.chatID === "string" ? payload.chatID : "";
  const whatsappID = typeof payload.whatsappID === "string" ? payload.whatsappID : "";

  if (!chatID || !whatsappID) {
    return null;
  }

  const atendente = isRecord(payload.atendente)
    ? sanitizeAtendente(normalizeAtendente(payload.atendente, ""))
    : null;
  const dataUltimaInteracao =
    typeof payload.dataUltimaInteracao === "number" && Number.isFinite(payload.dataUltimaInteracao)
      ? payload.dataUltimaInteracao
      : Date.now();

  return {
    ...payload,
    key: `${whatsappID}::${chatID}`,
    chatID,
    whatsappID,
    atendente,
    status: typeof payload.status === "string" ? payload.status : "Ativo",
    dataUltimaInteracao
  };
}

export function createRuntimeBridge(app: FastifyInstance): RuntimeBridge {
  const io = new Server(app.server, {
    path: "/ws/socket.io",
    cors: {
      origin: true,
      credentials: true
    }
  });

  const apiClientsBySocketId = new Map<string, ApiWhatsappClient>();
  const apiClientsByToken = new Map<string, ApiWhatsappClient>();
  const atendentesBySocketId = new Map<string, AtendenteRecord>();
  const atendenteSocketIdById = new Map<string, string>();
  const atendimentosByKey = new Map<string, AtendimentoRecord>();

  function getApiSocket(token: string) {
    const client = apiClientsByToken.get(token);

    if (!client) {
      return null;
    }

    const socket = io.sockets.sockets.get(client.socketId);

    if (!socket) {
      apiClientsBySocketId.delete(client.socketId);
      apiClientsByToken.delete(client.token);
      return null;
    }

    return socket;
  }

  function upsertApiClient(socketId: string, userID: string, token: string) {
    const current = apiClientsBySocketId.get(socketId);
    const next: ApiWhatsappClient = {
      socketId,
      userID: userID || current?.userID || "",
      token,
      connectedAt: current?.connectedAt ?? nowIso(),
      lastSeenAt: nowIso()
    };

    if (current?.token && current.token !== token) {
      apiClientsByToken.delete(current.token);
    }

    const previousByToken = apiClientsByToken.get(token);

    if (previousByToken && previousByToken.socketId !== socketId) {
      apiClientsBySocketId.delete(previousByToken.socketId);
    }

    apiClientsBySocketId.set(socketId, next);
    apiClientsByToken.set(token, next);
    return next;
  }

  function removeApiClient(socketId: string) {
    const client = apiClientsBySocketId.get(socketId);

    if (!client) {
      return;
    }

    apiClientsBySocketId.delete(socketId);

    const currentByToken = apiClientsByToken.get(client.token);
    if (currentByToken?.socketId === socketId) {
      apiClientsByToken.delete(client.token);
    }
  }

  function listAtendentes() {
    return Array.from(atendentesBySocketId.values())
      .map((atendente) => sanitizeAtendente(atendente))
      .sort((left, right) => left.email.localeCompare(right.email));
  }

  function listAtendimentos() {
    return Array.from(atendimentosByKey.values()).sort(
      (left, right) => right.dataUltimaInteracao - left.dataUltimaInteracao
    );
  }

  function broadcastAtendentes() {
    io.emit("active-atendentes", listAtendentes());
  }

  function broadcastAtendimentos() {
    io.emit("active-atendimento", listAtendimentos());
  }

  function upsertAtendente(socketId: string, payload: unknown) {
    const current = atendentesBySocketId.get(socketId);
    const atendente = normalizeAtendente(payload, socketId, current);

    if (current?.id && current.id !== atendente.id) {
      atendenteSocketIdById.delete(current.id);
    }

    atendentesBySocketId.set(socketId, atendente);
    atendenteSocketIdById.set(atendente.id, socketId);
    return atendente;
  }

  function removeAtendente(socketId: string) {
    const atendente = atendentesBySocketId.get(socketId);

    if (!atendente) {
      return;
    }

    atendentesBySocketId.delete(socketId);

    const currentSocketId = atendenteSocketIdById.get(atendente.id);
    if (currentSocketId === socketId) {
      atendenteSocketIdById.delete(atendente.id);
    }
  }

  function upsertAtendimento(payload: unknown) {
    const atendimento = normalizeAtendimento(payload);

    if (!atendimento) {
      return null;
    }

    atendimentosByKey.set(atendimento.key, atendimento);
    return atendimento;
  }

  async function emitWithAck<T>(token: string, event: string, payload?: JsonRecord): Promise<T> {
    const socket = getApiSocket(token);

    if (!socket) {
      throw new Error("Cliente nao conectado.");
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Cliente conectado nao respondeu."));
      }, 5000);

      const ack = (response: T) => {
        clearTimeout(timer);
        resolve(response);
      };

      if (payload) {
        socket.emit(event, payload, ack);
        return;
      }

      socket.emit(event, ack);
    });
  }

  io.on("connection", (socket) => {
    socket.on("set-user", (userID: unknown, currentToken: unknown) => {
      const token =
        typeof currentToken === "string" && currentToken.trim()
          ? currentToken.trim()
          : createOpaqueToken("wa");
      const normalizedUserID = typeof userID === "string" ? userID : "";

      upsertApiClient(socket.id, normalizedUserID, token);
      socket.emit("capture-token", token);
    });

    socket.on("update-user-socket", (userID: unknown, tokenValue: unknown) => {
      const token =
        typeof tokenValue === "string" && tokenValue.trim()
          ? tokenValue.trim()
          : createOpaqueToken("wa");
      const normalizedUserID = typeof userID === "string" ? userID : "";

      upsertApiClient(socket.id, normalizedUserID, token);
    });

    socket.on("connect-atendente", (payload: unknown) => {
      const atendente = upsertAtendente(socket.id, payload);
      socket.emit("connected-atentende", {
        atendente: sanitizeAtendente(atendente),
        atendimentos: listAtendimentos()
      });
      broadcastAtendentes();
      broadcastAtendimentos();
    });

    socket.on("update-atendente", (payload: unknown) => {
      upsertAtendente(socket.id, payload);
      broadcastAtendentes();
    });

    socket.on("update-atendimento", (payload: unknown) => {
      if (upsertAtendimento(payload)) {
        broadcastAtendimentos();
      }
    });

    socket.on("transferir_atendimento", (transferPayload: unknown, atendimentoPayload: unknown) => {
      const atendimento = upsertAtendimento(atendimentoPayload);

      if (!isRecord(transferPayload)) {
        if (atendimento) {
          broadcastAtendimentos();
        }
        return;
      }

      const targetId = typeof transferPayload.attID === "string" ? transferPayload.attID : "";
      const targetSocketId = targetId ? atendenteSocketIdById.get(targetId) : null;

      if (targetSocketId) {
        io.to(targetSocketId).emit("transferir_atendimento", transferPayload);
      }

      if (atendimento) {
        broadcastAtendimentos();
      }
    });

    socket.on("disconnect", () => {
      removeApiClient(socket.id);
      removeAtendente(socket.id);
      broadcastAtendentes();
    });
  });

  return {
    async close() {
      await io.close();
    },
    emitApiEvent(token: string, event: string, payload: JsonRecord) {
      const socket = getApiSocket(token);

      if (!socket) {
        return false;
      }

      socket.emit(event, payload);
      return true;
    },
    getApiClient(token: string) {
      const client = apiClientsByToken.get(token);
      return client ? sanitizeApiClient(client) : null;
    },
    async requestApiLabels(token: string) {
      const response = await emitWithAck<unknown[]>(token, "get-etiquetas");
      return Array.isArray(response) ? response : [];
    },
    async requestApiAddOrRemoveLabels(token: string, payload: JsonRecord) {
      return emitWithAck<unknown>(token, "addOrRemoveLabels", payload);
    },
    resetMultiAtendimento(whatsappId?: string) {
      if (!whatsappId) {
        atendimentosByKey.clear();
      } else {
        for (const [key, atendimento] of atendimentosByKey.entries()) {
          if (atendimento.whatsappID === whatsappId) {
            atendimentosByKey.delete(key);
          }
        }
      }

      const atendimentos = listAtendimentos();
      broadcastAtendimentos();
      return atendimentos;
    }
  };
}
