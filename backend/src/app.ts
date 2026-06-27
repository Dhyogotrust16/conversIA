import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { PrismaClient, WhiteLabel } from "@prisma/client";
import { addDays, createOpaqueToken, verifyPassword } from "./lib/auth.js";
import {
  buildAuthGooglePayload,
  buildUserPayload,
  groupUrlEntries,
  mapNotification,
  mapWebhookEntries,
  matchesAudience,
  serializeMigration
} from "./lib/compat.js";
import {
  buildLocalAuthGoogle,
  buildLocalInitialData,
  buildLocalUserPayload,
  buildLocalWhiteLabel,
  getLocalSessionByBearer,
  getLocalSessionByPlugin,
  issueLocalSession,
  validateLocalCredentials
} from "./lib/local-mode.js";
import {
  renderAiAgentsPage,
  renderApiDocsPage,
  renderDocsPage,
  renderManagerLoginPage,
  renderManagerPanelPage,
  renderNotesPage,
  renderPlaceholderPanelPage,
  renderUninstallPage,
  renderWelcomePage
} from "./lib/html.js";
import { listLocalAiAgents, setLocalAiAgentAction } from "./lib/local-ai-agents.js";
import { buildLocalCrmModels } from "./lib/local-crm.js";
import { createRuntimeBridge } from "./lib/socket-runtime.js";
import { mergeDomSelector } from "./lib/dom-selector.js";
import { parseColumnsFromWorkbookBase64, rowsToWorkbookBase64, sheetsToWorkbookBase64 } from "./lib/xlsx.js";
import type { Env } from "./config/env.js";

type AppOptions = {
  env: Env;
  prisma: PrismaClient;
};

type ResolvedBearerSession =
  | {
      success: true;
      source: "database" | "local";
      loginResponse: {
        success: true;
        user: Record<string, unknown>;
        auth_google: Record<string, unknown>;
        user_status: string;
      };
      bearerToken: string;
      email: string;
      name: string;
      whiteLabelName: string;
    }
  | {
      success: false;
      msg_id: string;
      origin?: string;
    };

const localRegisteredClients: Array<Record<string, unknown>> = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAuthorizationHeader(headerValue?: string): string {
  return headerValue?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

async function getWhiteLabel(prisma: PrismaClient, chromeStoreId: string) {
  try {
    return await prisma.whiteLabel.findUnique({
      where: { chromeStoreId }
    });
  } catch {
    return null;
  }
}

function hasValidExtensionAccess(
  request: FastifyRequest,
  whiteLabel: WhiteLabel | null,
  fallbackCryptKey = ""
) {
  const accessToken = String(request.headers["access-token"] ?? "");
  const expectedCryptKey = whiteLabel?.cryptKey ?? fallbackCryptKey;
  return Boolean(expectedCryptKey) && accessToken === expectedCryptKey;
}

async function resolveOrCreateBearerToken(prisma: PrismaClient, userId: string) {
  const token = await prisma.authToken.findFirst({
    where: {
      userId,
      kind: "BEARER",
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (token) {
    return token.token;
  }

  const createdToken = await prisma.authToken.create({
    data: {
      userId,
      kind: "BEARER",
      token: createOpaqueToken("br"),
      expiresAt: addDays(30)
    }
  });

  return createdToken.token;
}

async function createFreshSessionTokens(prisma: PrismaClient, userId: string) {
  await prisma.authToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      kind: { in: ["BEARER", "PLUGIN"] }
    },
    data: {
      revokedAt: new Date()
    }
  });

  const bearerToken = createOpaqueToken("br");
  const accessTokenPlugin = createOpaqueToken("pl");

  await prisma.authToken.createMany({
    data: [
      {
        userId,
        kind: "BEARER",
        token: bearerToken,
        expiresAt: addDays(30)
      },
      {
        userId,
        kind: "PLUGIN",
        token: accessTokenPlugin,
        expiresAt: addDays(30)
      }
    ]
  });

  return {
    bearerToken,
    accessTokenPlugin
  };
}

function readPanelBearerToken(request: FastifyRequest) {
  const query = (request.query ?? {}) as Record<string, unknown>;

  for (const key of ["bearer_token", "token", "bearer"]) {
    const candidate = query[key];

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return decodeURIComponent(candidate).trim();
    }
  }

  const rawUrl = request.raw.url ?? "";
  const rawQuery = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1).trim() : "";

  if (!rawQuery) {
    return "";
  }

  if (!rawQuery.includes("=")) {
    return decodeURIComponent(rawQuery).trim();
  }

  const params = new URLSearchParams(rawQuery);

  for (const key of ["bearer_token", "token", "bearer"]) {
    const candidate = params.get(key);

    if (candidate?.trim()) {
      return decodeURIComponent(candidate).trim();
    }
  }

  return "";
}

async function resolveBearerSession(
  prisma: PrismaClient,
  env: Env,
  chromeStoreId: string,
  tokenValue: string,
  log?: Pick<FastifyReply["log"], "warn">
): Promise<ResolvedBearerSession> {
  if (!tokenValue) {
    return { success: false, msg_id: "login_not_found" };
  }

  const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

  if (!whiteLabel) {
    const session = getLocalSessionByBearer(tokenValue);

    if (!session) {
      return { success: false, msg_id: "login_not_found" };
    }

    return {
      success: true,
      source: "local",
      loginResponse: {
        success: true,
        user: buildLocalUserPayload(env, chromeStoreId, session),
        auth_google: buildLocalAuthGoogle(env),
        user_status: env.SEED_ADMIN_STATUS
      },
      bearerToken: session.bearerToken,
      email: env.SEED_ADMIN_EMAIL,
      name: env.SEED_ADMIN_NAME,
      whiteLabelName: buildLocalWhiteLabel(env, chromeStoreId).displayName
    };
  }

  try {
    const token = await prisma.authToken.findFirst({
      where: {
        kind: "BEARER",
        token: tokenValue,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: {
            whiteLabel: true,
            authTokens: {
              where: {
                revokedAt: null,
                expiresAt: { gt: new Date() }
              }
            }
          }
        }
      }
    });

    if (!token) {
      return { success: false, msg_id: "login_not_found" };
    }

    if (token.user.whiteLabel.chromeStoreId !== chromeStoreId) {
      return {
        success: false,
        msg_id: "login_other_white_label",
        origin: token.user.whiteLabel.chromeStoreId
      };
    }

    const accessTokenPlugin = token.user.authTokens.find((item) => item.kind === "PLUGIN")?.token ?? "";

    return {
      success: true,
      source: "database",
      loginResponse: {
        success: true,
        user: buildUserPayload(token.user, {
          bearerToken: token.token,
          accessTokenPlugin
        }),
        auth_google: buildAuthGooglePayload(token.user),
        user_status: token.user.userStatus
      },
      bearerToken: token.token,
      email: token.user.email,
      name: token.user.name,
      whiteLabelName: token.user.whiteLabel.displayName || token.user.whiteLabel.firstName
    };
  } catch (error) {
    log?.warn({ error, chromeStoreId }, "Database bearer login failed; using local fallback");

    const session = getLocalSessionByBearer(tokenValue);

    if (!session) {
      return { success: false, msg_id: "login_not_found" };
    }

    return {
      success: true,
      source: "local",
      loginResponse: {
        success: true,
        user: buildLocalUserPayload(env, chromeStoreId, session),
        auth_google: buildLocalAuthGoogle(env),
        user_status: env.SEED_ADMIN_STATUS
      },
      bearerToken: session.bearerToken,
      email: env.SEED_ADMIN_EMAIL,
      name: env.SEED_ADMIN_NAME,
      whiteLabelName: buildLocalWhiteLabel(env, chromeStoreId).displayName
    };
  }
}

function contactRowsFromPayload(body: Record<string, unknown>) {
  if (Array.isArray(body.contacts)) {
    return body.contacts as Array<Record<string, unknown>>;
  }

  if (Array.isArray(body.profiles)) {
    return body.profiles as Array<Record<string, unknown>>;
  }

  return [];
}

function getFallbackWhiteLabel(chromeStoreId: string, appBaseUrl: string): WhiteLabel {
  return {
    id: "",
    chromeStoreId,
    nameId: "app",
    firstName: "Extensão",
    displayName: "Extensão",
    language: "pt",
    description: "",
    cryptKey: "",
    appBaseUrl,
    meetConfig: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function toFiniteNumber(value: unknown) {
  const parsedValue = Number(value ?? 0);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function buildFunilSheetRows(items: Array<Record<string, unknown>>, typeLabel: string) {
  return items.map((item) => ({
    Contatos: toFiniteNumber(item.contacts),
    Cor: String(item.color ?? ""),
    Nome: String(item.name ?? item.id ?? ""),
    Tipo: typeLabel,
    Valor: toFiniteNumber(item.value)
  }));
}

function buildFunilSummaryRows(
  crmData: Array<Record<string, unknown>>,
  userTabsData: Array<Record<string, unknown>>,
  labelsData: Array<Record<string, unknown>>
) {
  const sections = [
    { items: crmData, section: "CRM" },
    { items: userTabsData, section: "Abas" },
    { items: labelsData, section: "Etiquetas" }
  ];

  return sections.map(({ items, section }) => ({
    Contatos: items.reduce((total, item) => total + toFiniteNumber(item.contacts), 0),
    Itens: items.length,
    Secao: section,
    Valor: items.reduce((total, item) => total + toFiniteNumber(item.value), 0)
  }));
}

function buildFunilFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `funil_${timestamp}.xlsx`;
}

export async function buildApp({ env, prisma }: AppOptions) {
  const app = Fastify({
    logger: true
  });
  const runtime = createRuntimeBridge(app);

  await app.register(cors, {
    origin: true,
    credentials: true
  });
  await app.register(multipart);

  app.get("/health", async () => ({
    success: true,
    service: "waspeed-compat-backend",
    time: new Date().toISOString()
  }));

  app.get("/docs", async (_, reply) => {
    reply.type("text/html; charset=utf-8");
    return renderDocsPage(env.APP_BASE_URL);
  });

  app.get("/api-docs", async (_, reply) => {
    reply.type("text/html; charset=utf-8");
    return renderApiDocsPage(env.APP_BASE_URL);
  });

  app.get("/api/bridge/client/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const client = runtime.getApiClient(token);

    if (!client) {
      reply.code(404);
      return {
        success: false,
        message: "Cliente nao conectado."
      };
    }

    return {
      success: true,
      client
    };
  });

  app.get("/api/bridge/labels/:token", async (request, reply) => {
    const { token } = request.params as { token: string };

    try {
      const labels = await runtime.requestApiLabels(token);
      return {
        success: true,
        labels
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao buscar etiquetas.";
      reply.code(message === "Cliente nao conectado." ? 404 : 502);
      return {
        success: false,
        message
      };
    }
  });

  app.post("/api/bridge/labels", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const id = readNonEmptyString(body, "id");
    const label = body.label;

    if (!token || !id || !Array.isArray(label)) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para etiquetas."
      };
    }

    try {
      const result = await runtime.requestApiAddOrRemoveLabels(token, { id, label });
      return {
        success: true,
        result
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar etiquetas.";
      reply.code(message === "Cliente nao conectado." ? 404 : 502);
      return {
        success: false,
        message
      };
    }
  });

  app.post("/api/bridge/send-text", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const phone = readNonEmptyString(body, "phone");
    const message = typeof body.message === "string" ? body.message : "";

    if (!token || !phone || !message) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para envio de texto."
      };
    }

    const sent = runtime.emitApiEvent(token, "sendText", { phone, message });

    if (!sent) {
      reply.code(404);
      return { success: false, message: "Cliente nao conectado." };
    }

    return { success: true };
  });

  app.post("/api/bridge/send-image", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const phone = readNonEmptyString(body, "phone");
    const base64 = readNonEmptyString(body, "base64");
    const message = typeof body.message === "string" ? body.message : "";

    if (!token || !phone || !base64) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para envio de imagem."
      };
    }

    const sent = runtime.emitApiEvent(token, "sendImage", { phone, base64, message });

    if (!sent) {
      reply.code(404);
      return { success: false, message: "Cliente nao conectado." };
    }

    return { success: true };
  });

  app.post("/api/bridge/send-video", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const phone = readNonEmptyString(body, "phone");
    const base64 = readNonEmptyString(body, "base64");
    const message = typeof body.message === "string" ? body.message : "";

    if (!token || !phone || !base64) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para envio de video."
      };
    }

    const sent = runtime.emitApiEvent(token, "sendVideo", { phone, base64, message });

    if (!sent) {
      reply.code(404);
      return { success: false, message: "Cliente nao conectado." };
    }

    return { success: true };
  });

  app.post("/api/bridge/send-audio", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const phone = readNonEmptyString(body, "phone");
    const base64 = readNonEmptyString(body, "base64");

    if (!token || !phone || !base64) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para envio de audio."
      };
    }

    const sent = runtime.emitApiEvent(token, "sendAudio", { phone, base64 });

    if (!sent) {
      reply.code(404);
      return { success: false, message: "Cliente nao conectado." };
    }

    return { success: true };
  });

  app.post("/api/bridge/send-document", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const phone = readNonEmptyString(body, "phone");
    const base64 = readNonEmptyString(body, "base64");
    const name = readNonEmptyString(body, "name");

    if (!token || !phone || !base64 || !name) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para envio de documento."
      };
    }

    const sent = runtime.emitApiEvent(token, "sendDoc", { phone, base64, name });

    if (!sent) {
      reply.code(404);
      return { success: false, message: "Cliente nao conectado." };
    }

    return { success: true };
  });

  app.post("/api/bridge/create-note", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const token = readNonEmptyString(body, "token");
    const userID = readNonEmptyString(body, "userID");
    const text = typeof body.text === "string" ? body.text : "";
    const base64 = typeof body.base64 === "string" ? body.base64 : "";

    if (!token || !userID || (!text && !base64)) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para criacao de nota."
      };
    }

    const sent = runtime.emitApiEvent(token, "createNote", { userID, text, base64 });

    if (!sent) {
      reply.code(404);
      return { success: false, message: "Cliente nao conectado." };
    }

    return { success: true };
  });

  app.get("/api/ia/agents", async () => ({
    success: true,
    agents: listLocalAiAgents()
  }));

  app.post("/api/ia/agents/chat-action", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const status = readNonEmptyString(body, "status");
    const phone = readNonEmptyString(body, "phone");
    const whatsappID = readNonEmptyString(body, "whatsappID");

    if (!status || !phone || !whatsappID || !["opened", "closed"].includes(status)) {
      reply.code(400);
      return {
        success: false,
        message: "Payload invalido para acao do agente."
      };
    }

    return {
      success: true,
      agent: setLocalAiAgentAction({ status, phone, whatsappID })
    };
  });

  app.get("/extend/domSelector.json", async (_, reply) => {
    let remoteDomSelector: unknown = null;

    try {
      const domSelectorResponse = await fetch(env.DOM_SELECTOR_SOURCE_URL);

      if (domSelectorResponse.ok) {
        remoteDomSelector = await domSelectorResponse.json();
      } else {
        app.log.warn(
          { statusCode: domSelectorResponse.status },
          "Remote dom selector source unavailable, using local fallback"
        );
      }
    } catch (error) {
      app.log.warn({ error }, "Failed to load remote dom selector source, using local fallback");
    }

    reply.header("cache-control", "public, max-age=300");
    return mergeDomSelector(remoteDomSelector);
  });

  app.get("/app/:chromeStoreId/welcome", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    reply.type("text/html; charset=utf-8");
    return renderWelcomePage(
      whiteLabel ??
        ({
          ...getFallbackWhiteLabel(chromeStoreId, env.APP_BASE_URL),
          ...buildLocalWhiteLabel(env, chromeStoreId)
        } as WhiteLabel)
    );
  });

  app.get("/app/:chromeStoreId/register", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    reply.type("text/html; charset=utf-8");
    return renderPlaceholderPanelPage(
      `Cadastro ${chromeStoreId}`,
      "Ponto pronto para o seu painel próprio de cadastro.",
      "Abrir documentação",
      `${env.APP_BASE_URL}/docs`
    );
  });

  app.get("/app/:chromeStoreId/recovery", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    reply.type("text/html; charset=utf-8");
    return renderPlaceholderPanelPage(
      `Recuperação ${chromeStoreId}`,
      "Ponto pronto para fluxo próprio de recuperação de acesso.",
      "Abrir documentação",
      `${env.APP_BASE_URL}/docs`
    );
  });

  app.get("/app/:chromeStoreId/login", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    reply.type("text/html; charset=utf-8");
    return renderManagerLoginPage({
      chromeStoreId,
      baseUrl: env.APP_BASE_URL,
      extensionCryptKey: whiteLabel?.cryptKey ?? env.EXTENSION_CRIPT_KEY,
      localCredentials: !whiteLabel
        ? {
            email: env.SEED_ADMIN_EMAIL,
            password: env.SEED_ADMIN_PASSWORD
          }
        : null
    });
  });

  app.get("/app/:chromeStoreId/auth-plugin", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const { bearer_token: bearerToken } = request.query as { bearer_token?: string };

    reply.type("text/html; charset=utf-8");
    return renderPlaceholderPanelPage(
      `Auth plugin ${chromeStoreId}`,
      bearerToken
        ? "Token recebido. Você já pode usar este fluxo para devolver o bearer token ao WhatsApp Web."
        : "Ponto pronto para autenticação externa do plugin.",
      bearerToken ? "Abrir WhatsApp Web" : "Abrir documentação",
      bearerToken ? `https://web.whatsapp.com?bearer_token=${encodeURIComponent(bearerToken)}` : `${env.APP_BASE_URL}/docs`
    );
  });

  app.get("/app/:chromeStoreId/auth-painel", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const bearerToken = readPanelBearerToken(request);
    const resolvedSession = await resolveBearerSession(
      prisma,
      env,
      chromeStoreId,
      bearerToken,
      reply.log
    );

    reply.type("text/html; charset=utf-8");

    if (!resolvedSession.success) {
      return renderPlaceholderPanelPage(
        `Painel do gestor ${chromeStoreId}`,
        resolvedSession.msg_id === "login_other_white_label" && resolvedSession.origin
          ? `Esta sessao pertence a outra white-label: ${resolvedSession.origin}.`
          : "Sessao invalida ou expirada. Entre novamente para abrir o painel do gestor.",
        "Abrir login",
        `${env.APP_BASE_URL}/app/${chromeStoreId}/login`
      );
    }

    return renderManagerPanelPage({
      chromeStoreId,
      baseUrl: env.APP_BASE_URL,
      bearerToken: resolvedSession.bearerToken,
      email: resolvedSession.email,
      name: resolvedSession.name,
      source: resolvedSession.source,
      whiteLabelName: resolvedSession.whiteLabelName
    });
  });

  app.get("/app/:chromeStoreId/ia-agents", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };

    reply.type("text/html; charset=utf-8");
    return renderAiAgentsPage(chromeStoreId, env.APP_BASE_URL, listLocalAiAgents());
  });

  app.post("/api/auth/login/:chromeStoreId", async (request) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const { email = "", senha = "" } = (request.body ?? {}) as { email?: string; senha?: string };

    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    if (!hasValidExtensionAccess(request, whiteLabel, env.EXTENSION_CRIPT_KEY)) {
      return { success: false, msg_id: "login_error_server" };
    }

    if (!whiteLabel) {
      if (!validateLocalCredentials(env, email, senha)) {
        return { success: false, msg_id: "login_not_found" };
      }

      const session = issueLocalSession(env);

      return {
        success: true,
        user: buildLocalUserPayload(env, chromeStoreId, session),
        auth_google: buildLocalAuthGoogle(env),
        user_status: env.SEED_ADMIN_STATUS
      };
    }

    let user;
    try {
      user = await prisma.user.findFirst({
        where: {
          email
        },
        include: {
          whiteLabel: true
        }
      });
    } catch (error) {
      app.log.warn({ error, chromeStoreId }, "Database login failed; using local fallback");

      if (!validateLocalCredentials(env, email, senha)) {
        return { success: false, msg_id: "login_not_found" };
      }

      const session = issueLocalSession(env);

      return {
        success: true,
        user: buildLocalUserPayload(env, chromeStoreId, session),
        auth_google: buildLocalAuthGoogle(env),
        user_status: env.SEED_ADMIN_STATUS
      };
    }

    if (!user) {
      return { success: false, msg_id: "login_not_found" };
    }

    if (user.whiteLabel.chromeStoreId !== chromeStoreId) {
      return {
        success: false,
        msg_id: "login_other_white_label",
        origin: user.whiteLabel.chromeStoreId
      };
    }

    const passwordMatches = await verifyPassword(senha, user.passwordHash);

    if (!passwordMatches) {
      return { success: false, msg_id: "login_not_found" };
    }

    const tokens = await createFreshSessionTokens(prisma, user.id);

    return {
      success: true,
      user: buildUserPayload(user, tokens),
      auth_google: buildAuthGooglePayload(user),
      user_status: user.userStatus
    };
  });

  app.get("/api/auth/login-bearer/:chromeStoreId", async (request) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    if (!hasValidExtensionAccess(request, whiteLabel, env.EXTENSION_CRIPT_KEY)) {
      return { success: false, msg_id: "login_error_server" };
    }

    const tokenValue = normalizeAuthorizationHeader(String(request.headers.authorization ?? ""));
    const resolvedSession = await resolveBearerSession(
      prisma,
      env,
      chromeStoreId,
      tokenValue,
      app.log
    );

    if (!resolvedSession.success) {
      return resolvedSession;
    }

    return resolvedSession.loginResponse;
  });

  app.post("/api/auth/validation/:chromeStoreId", async (request) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const { email = "", access_token_plugin: accessTokenPlugin = "" } = (request.body ?? {}) as {
      email?: string;
      access_token_plugin?: string;
    };

    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    if (!hasValidExtensionAccess(request, whiteLabel, env.EXTENSION_CRIPT_KEY)) {
      return { success: false, msg_id: "login_error_server" };
    }

    if (!whiteLabel) {
      const session = getLocalSessionByPlugin(email, accessTokenPlugin);

      if (!session) {
        return { success: false, msg_id: "invalid_token_in_validation" };
      }

      return {
        success: true,
        user: buildLocalUserPayload(env, chromeStoreId, session),
        auth_google: buildLocalAuthGoogle(env),
        user_status: env.SEED_ADMIN_STATUS
      };
    }

    let user;
    try {
      user = await prisma.user.findFirst({
        where: {
          email
        },
        include: {
          whiteLabel: true,
          authTokens: {
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() }
            }
          }
        }
      });
    } catch (error) {
      app.log.warn({ error, chromeStoreId }, "Database validation failed; using local fallback");

      const session = getLocalSessionByPlugin(email, accessTokenPlugin);

      if (!session) {
        return { success: false, msg_id: "invalid_token_in_validation" };
      }

      return {
        success: true,
        user: buildLocalUserPayload(env, chromeStoreId, session),
        auth_google: buildLocalAuthGoogle(env),
        user_status: env.SEED_ADMIN_STATUS
      };
    }

    if (!user) {
      return { success: false, msg_id: "login_not_found" };
    }

    if (user.whiteLabel.chromeStoreId !== chromeStoreId) {
      return {
        success: false,
        msg_id: "login_other_white_label",
        origin: user.whiteLabel.chromeStoreId
      };
    }

    const validPluginToken = user.authTokens.find(
      (token) => token.kind === "PLUGIN" && token.token === accessTokenPlugin
    );

    if (!validPluginToken) {
      return { success: false, msg_id: "invalid_token_in_validation" };
    }

    const bearerToken = await resolveOrCreateBearerToken(prisma, user.id);

    return {
      success: true,
      user: buildUserPayload(user, {
        bearerToken,
        accessTokenPlugin: validPluginToken.token
      }),
      auth_google: buildAuthGooglePayload(user),
      user_status: user.userStatus
    };
  });

  app.get("/api/services/initial-data/:chromeStoreId", async (request) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    let whiteLabel = null;

    try {
      whiteLabel = await prisma.whiteLabel.findUnique({
        where: { chromeStoreId },
        include: {
          urlEntries: true,
          webhookEntries: true,
          migrationSetting: true
        }
      });
    } catch (error) {
      app.log.warn({ error, chromeStoreId }, "Failed to load initial data; using fallback");
    }

    if (!hasValidExtensionAccess(request, whiteLabel, env.EXTENSION_CRIPT_KEY)) {
      return {
        webhooks: [],
        meet: {},
        urls: {},
        migration: serializeMigration(null, env.MIGRATION_TUTORIAL_URL)
      };
    }

    if (!whiteLabel) {
      return buildLocalInitialData(env, chromeStoreId);
    }

    return {
      webhooks: mapWebhookEntries(whiteLabel.webhookEntries),
      meet: (whiteLabel.meetConfig ?? {}) as Record<string, unknown>,
      urls: groupUrlEntries(whiteLabel.urlEntries),
      migration: serializeMigration(whiteLabel.migrationSetting, env.MIGRATION_TUTORIAL_URL)
    };
  });

  app.all("/api/services/update", async () => ({ success: true }));
  app.all("/api/urls/update", async () => ({ success: true }));

  app.get("/api/urls/install/:chromeStoreId", async (request) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    if (whiteLabel) {
      try {
        await prisma.installEvent.create({
          data: {
            whiteLabelId: whiteLabel.id,
            eventType: "install",
            userAgent: String(request.headers["user-agent"] ?? ""),
            origin: String(request.headers.origin ?? "")
          }
        });
      } catch (error) {
        app.log.warn({ error, chromeStoreId }, "Failed to persist install event");
      }
    }

    return {
      success: true,
      url: `${env.APP_BASE_URL}/app/${chromeStoreId}/welcome`
    };
  });

  app.get("/api/urls/active-notes/:chromeStoreId", async (request) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    let whiteLabel = null;

    try {
      whiteLabel = await prisma.whiteLabel.findUnique({
        where: { chromeStoreId },
        include: {
          notifications: {
            where: {
              active: true,
              openOnUpdate: true
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 1
          }
        }
      });
    } catch (error) {
      app.log.warn({ error, chromeStoreId }, "Failed to load active notes; using fallback");
    }

    return {
      success: true,
      path_note_update: {
        redirect: Boolean(whiteLabel?.notifications.length)
      }
    };
  });

  app.get("/api/urls/notes/:chromeStoreId", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    let whiteLabel = null;

    try {
      whiteLabel = await prisma.whiteLabel.findUnique({
        where: { chromeStoreId },
        include: {
          notifications: {
            where: { active: true },
            orderBy: { createdAt: "desc" }
          }
        }
      });
    } catch (error) {
      app.log.warn({ error, chromeStoreId }, "Failed to load notes page; using fallback");
    }

    reply.type("text/html; charset=utf-8");

    if (!whiteLabel) {
      return renderPlaceholderPanelPage(
        "Notas não encontradas",
        "A white-label informada ainda não foi cadastrada."
      );
    }

    return renderNotesPage(whiteLabel, whiteLabel.notifications);
  });

  app.get("/api/urls/uninstall/:chromeStoreId", async (request, reply) => {
    const { chromeStoreId } = request.params as { chromeStoreId: string };
    const whiteLabel = await getWhiteLabel(prisma, chromeStoreId);

    if (whiteLabel) {
      try {
        await prisma.installEvent.create({
          data: {
            whiteLabelId: whiteLabel.id,
            eventType: "uninstall",
            userAgent: String(request.headers["user-agent"] ?? ""),
            origin: String(request.headers.origin ?? "")
          }
        });
      } catch (error) {
        app.log.warn({ error, chromeStoreId }, "Failed to persist uninstall event");
      }
    }

    reply.type("text/html; charset=utf-8");
    return renderUninstallPage(whiteLabel ?? getFallbackWhiteLabel(chromeStoreId, env.APP_BASE_URL));
  });

  app.get("/api/notify/get/:tier/:chromeStoreId", async (request) => {
    const { tier, chromeStoreId } = request.params as { tier: string; chromeStoreId: string };
    let whiteLabel = null;

    try {
      whiteLabel = await prisma.whiteLabel.findUnique({
        where: { chromeStoreId },
        include: {
          notifications: {
            where: { active: true },
            orderBy: { createdAt: "desc" }
          }
        }
      });
    } catch (error) {
      app.log.warn({ error, chromeStoreId }, "Failed to load notifications; using fallback");
    }

    if (!hasValidExtensionAccess(request, whiteLabel, env.EXTENSION_CRIPT_KEY)) {
      return {
        success: true,
        notify: []
      };
    }

    if (!whiteLabel) {
      return {
        success: true,
        notify: []
      };
    }

    return {
      success: true,
      notify: whiteLabel.notifications
        .filter((notification) => matchesAudience(notification.audience, tier))
        .map(mapNotification)
    };
  });

  app.get("/api/modelosCRM/get", async () => ({
    success: true,
    modelos: buildLocalCrmModels()
  }));

  app.post("/api/clientesRegistrados/set", async (request) => {
    const payload = (request.body ?? {}) as Record<string, unknown>;
    const entry: Record<string, unknown> = {
      ...payload,
      createdAt: new Date().toISOString()
    };

    localRegisteredClients.unshift(entry);

    if (localRegisteredClients.length > 200) {
      localRegisteredClients.length = 200;
    }

    app.log.info(
      {
        segmento: entry.segmento,
        whatsapp: entry.whatsapp,
        wl_id: entry.wl_id
      },
      "Registered CRM client locally"
    );

    return {
      success: true
    };
  });

  app.get("/ws/api/reset/:whatsappId", async (request) => {
    const { whatsappId } = request.params as { whatsappId: string };
    const atendimentos = runtime.resetMultiAtendimento(whatsappId);

    return {
      atendimentos,
      success: true,
      whatsappId
    };
  });

  app.post("/api/image/url-to-base64", async (request, reply) => {
    const { url = "" } = (request.body ?? {}) as { url?: string };

    if (!url) {
      reply.code(400);
      return { success: false, message: "URL ausente." };
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      success: true,
      base64: `data:${mimeType};base64,${base64}`
    };
  });

  app.post("/api/audio/convert-ptt-base64", async (request) => {
    const { base64 = "" } = (request.body ?? {}) as { base64?: string };
    return { success: true, base64 };
  });

  app.post("/api/audio/convert-ptt-file", async (request, reply) => {
    const audioFile = await request.file();

    if (!audioFile) {
      reply.code(400);
      return {
        success: false,
        message: "Arquivo de audio ausente."
      };
    }

    const buffer = await audioFile.toBuffer();

    if (buffer.length === 0) {
      reply.code(400);
      return {
        success: false,
        message: "Arquivo de audio vazio."
      };
    }

    return {
      success: true,
      base64: `data:${audioFile.mimetype || "application/octet-stream"};base64,${buffer.toString("base64")}`
    };
  });

  app.post("/api/XLSX/exporttab", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const contacts = contactRowsFromPayload(body);

    if (contacts.length === 0) {
      reply.code(400);
      return { success: false, message: "Nenhum contato recebido." };
    }

    const rows = contacts.map((contact) => ({
      Nome: String(contact.name ?? ""),
      WhatsApp: String(contact.id ?? ""),
      Tag: String(body.tag ?? "")
    }));

    return {
      success: true,
      XLSXbase64: rowsToWorkbookBase64(rows, "Contatos")
    };
  });

  app.post("/api/XLSX/contactprofile", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const profiles = contactRowsFromPayload(body);

    if (profiles.length === 0) {
      reply.code(400);
      return { success: false, message: "Nenhum perfil recebido." };
    }

    return {
      success: true,
      XLSXbase64: rowsToWorkbookBase64(profiles, "Perfis")
    };
  });

  app.post("/api/XLSX/envioEmMassa", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const contacts = contactRowsFromPayload(body);

    if (contacts.length === 0) {
      reply.code(400);
      return { success: false, message: "Nenhum contato recebido." };
    }

    return {
      success: true,
      XLSXbase64: rowsToWorkbookBase64(contacts, "EnvioEmMassa")
    };
  });

  app.get("/api/XLSX/gabarito", async () => ({
    success: true,
    XLSXbase64: rowsToWorkbookBase64(
      [
        { NOME: "Maria Silva", NUMERO: "5599999999999", EMAIL: "maria@exemplo.com" },
        { NOME: "Joao Souza", NUMERO: "5588999999999", EMAIL: "joao@exemplo.com" }
      ],
      "Gabarito"
    )
  }));

  app.post("/api/XLSX/exportFunil", async (request) => {
    const body = (request.body ?? {}) as {
      crmData?: Array<Record<string, unknown>>;
      labelsData?: Array<Record<string, unknown>>;
      userTabsData?: Array<Record<string, unknown>>;
    };

    const crmData = Array.isArray(body.crmData) ? body.crmData : [];
    const userTabsData = Array.isArray(body.userTabsData) ? body.userTabsData : [];
    const labelsData = Array.isArray(body.labelsData) ? body.labelsData : [];

    return {
      success: true,
      filename: buildFunilFilename(),
      XLSXbase64: sheetsToWorkbookBase64([
        {
          name: "Resumo",
          rows: buildFunilSummaryRows(crmData, userTabsData, labelsData)
        },
        {
          name: "CRM",
          rows: buildFunilSheetRows(crmData, "CRM")
        },
        {
          name: "Abas",
          rows: buildFunilSheetRows(userTabsData, "Abas")
        },
        {
          name: "Etiquetas",
          rows: buildFunilSheetRows(labelsData, "Etiquetas")
        }
      ])
    };
  });

  app.post("/api/XLSX/exportrelatorio", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const contacts = contactRowsFromPayload(body);

    if (contacts.length === 0) {
      reply.code(400);
      return { success: false, message: "Nenhum item para relatório." };
    }

    return {
      success: true,
      XLSXbase64: rowsToWorkbookBase64(contacts, "Relatorio")
    };
  });

  app.post("/api/XLSX/bulkSendMessage/exportReport", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const contacts = contactRowsFromPayload(body);

    if (contacts.length === 0) {
      reply.code(400);
      return { success: false, message: "Nenhum item para relatório." };
    }

    return {
      success: true,
      XLSXbase64: rowsToWorkbookBase64(contacts, "Relatorio")
    };
  });

  app.post("/api/XLSX/processPlanilha", async (request, reply) => {
    const { data = "" } = (request.body ?? {}) as { data?: string };

    if (!data) {
      reply.code(400);
      return { success: false, message: "Payload da planilha ausente." };
    }

    try {
      const colunas = parseColumnsFromWorkbookBase64(data);
      return { success: true, colunas };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Falha ao processar planilha."
      };
    }
  });

  app.setNotFoundHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404);
    return {
      success: false,
      message: "Rota não encontrada."
    };
  });

  app.addHook("onClose", async () => {
    await runtime.close();
  });

  // Rota de seed protegida por secret — só para primeiro setup
  app.post("/api/setup/seed", async (request, reply) => {
    const { secret } = request.body as { secret?: string };
    if (!secret || secret !== env.EXTENSION_CRIPT_KEY) {
      reply.code(401);
      return { success: false, message: "Unauthorized" };
    }
    try {
      const { hashPassword } = await import("./lib/auth.js");
      const { NotificationViewer, AudienceTier } = await import("@prisma/client");
      const chromeStoreId = env.EXTENSION_CHROME_STORE_ID;
      const whiteLabel = await prisma.whiteLabel.upsert({
        where: { chromeStoreId },
        update: { nameId: "waspeed", firstName: "WaSpeed", displayName: "WaSpeed: Superpoderes para o seu WhatsApp, CRM e muito mais.", language: "pt", description: "Backend próprio compatível com a estrutura da extensão.", cryptKey: env.EXTENSION_CRIPT_KEY, appBaseUrl: env.APP_BASE_URL },
        create: { chromeStoreId, nameId: "waspeed", firstName: "WaSpeed", displayName: "WaSpeed: Superpoderes para o seu WhatsApp, CRM e muito mais.", language: "pt", description: "Backend próprio compatível com a estrutura da extensão.", cryptKey: env.EXTENSION_CRIPT_KEY, appBaseUrl: env.APP_BASE_URL }
      });
      await prisma.migrationSetting.upsert({
        where: { whiteLabelId: whiteLabel.id },
        update: { active: env.MIGRATION_ACTIVE, blockDate: env.MIGRATION_BLOCK_DATE ? new Date(env.MIGRATION_BLOCK_DATE) : null, linkTutorial: env.MIGRATION_TUTORIAL_URL },
        create: { whiteLabelId: whiteLabel.id, active: env.MIGRATION_ACTIVE, blockDate: env.MIGRATION_BLOCK_DATE ? new Date(env.MIGRATION_BLOCK_DATE) : null, linkTutorial: env.MIGRATION_TUTORIAL_URL }
      });
      const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
      const admin = await prisma.user.upsert({
        where: { whiteLabelId_email: { whiteLabelId: whiteLabel.id, email: env.SEED_ADMIN_EMAIL } },
        update: { name: env.SEED_ADMIN_NAME, passwordHash, userStatus: env.SEED_ADMIN_STATUS, premiumReleaseAt: new Date(), path: `/${chromeStoreId}`, authGoogle: { email_auth: env.SEED_ADMIN_EMAIL }, cookies: {} },
        create: { whiteLabelId: whiteLabel.id, email: env.SEED_ADMIN_EMAIL, name: env.SEED_ADMIN_NAME, passwordHash, userStatus: env.SEED_ADMIN_STATUS, premiumReleaseAt: new Date(), path: `/${chromeStoreId}`, authGoogle: { email_auth: env.SEED_ADMIN_EMAIL }, cookies: {} }
      });
      const existingNotif = await prisma.notification.findFirst({ where: { whiteLabelId: whiteLabel.id, title: "Backend próprio ativo" } });
      if (!existingNotif) {
        await prisma.notification.create({ data: { whiteLabelId: whiteLabel.id, audience: AudienceTier.ALL, viewer: NotificationViewer.INBOX, title: "Backend próprio ativo", statement: "O backend compatível já está pronto.", btnName: "Abrir documentação", link: `${env.APP_BASE_URL}/docs`, active: true, openOnUpdate: false } });
      }
      return { success: true, whiteLabel: whiteLabel.chromeStoreId, admin: admin.email };
    } catch (err) {
      reply.code(500);
      return { success: false, message: String(err) };
    }
  });

  return app;
}
