type AgentStatus = "opened" | "closed";

export type LocalAiAgentRecord = {
  id: string;
  whatsappID: string;
  phone: string;
  status: AgentStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const localAiAgents = new Map<string, LocalAiAgentRecord>();

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildKey(whatsappID: string, phone: string) {
  return `${whatsappID}::${normalizePhone(phone)}`;
}

function createAgentId() {
  return `ag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function setLocalAiAgentAction(input: {
  status: string;
  phone: string;
  whatsappID: string;
}) {
  const phone = normalizePhone(input.phone);
  const whatsappID = normalizePhone(input.whatsappID);
  const status: AgentStatus = input.status === "closed" ? "closed" : "opened";
  const key = buildKey(whatsappID, phone);
  const current = localAiAgents.get(key);
  const now = new Date().toISOString();

  const next: LocalAiAgentRecord = {
    id: current?.id ?? createAgentId(),
    whatsappID,
    phone,
    status,
    active: status === "opened",
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };

  localAiAgents.set(key, next);
  return next;
}

export function listLocalAiAgents() {
  return Array.from(localAiAgents.values()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function getLocalAiAgent(whatsappID: string, phone: string) {
  return localAiAgents.get(buildKey(whatsappID, phone)) ?? null;
}
