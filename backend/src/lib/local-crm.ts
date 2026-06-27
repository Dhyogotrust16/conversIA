type LocalCrmTab = {
  chats: Array<{ id: string; name: string }>;
  color: string;
  hide: boolean;
  id: string;
  profile: number;
  profileCalculated: boolean;
  tag: string;
};

type LocalCrmModel = {
  arquivo: string;
  id: number;
  nome: string;
};

function createTabs(entries: Array<{ color: string; id: string; tag: string }>): LocalCrmTab[] {
  return entries.map((entry) => ({
    chats: [],
    color: entry.color,
    hide: false,
    id: entry.id,
    profile: 0,
    profileCalculated: false,
    tag: entry.tag
  }));
}

function createModel(
  id: number,
  nome: string,
  entries: Array<{ color: string; id: string; tag: string }>
): LocalCrmModel {
  return {
    arquivo: JSON.stringify({
      categoria: [],
      guardaMsg: [],
      medias: [],
      userTabs: createTabs(entries)
    }),
    id,
    nome
  };
}

export function buildLocalCrmModels(): LocalCrmModel[] {
  return [
    createModel(1, "Comercial", [
      {
        color: "#2563eb",
        id: "eec3a710-5d59-4e0f-9ab8-1e1f7d1f0001",
        tag: "Leads"
      },
      {
        color: "#7c3aed",
        id: "eec3a710-5d59-4e0f-9ab8-1e1f7d1f0002",
        tag: "Qualificacao"
      },
      {
        color: "#f97316",
        id: "eec3a710-5d59-4e0f-9ab8-1e1f7d1f0003",
        tag: "Proposta"
      },
      {
        color: "#16a34a",
        id: "eec3a710-5d59-4e0f-9ab8-1e1f7d1f0004",
        tag: "Fechamento"
      }
    ]),
    createModel(2, "Atendimento", [
      {
        color: "#0f766e",
        id: "2b4c40d0-a9b7-4f7f-8d8b-6eb49a6f0001",
        tag: "Novo atendimento"
      },
      {
        color: "#2563eb",
        id: "2b4c40d0-a9b7-4f7f-8d8b-6eb49a6f0002",
        tag: "Em andamento"
      },
      {
        color: "#ca8a04",
        id: "2b4c40d0-a9b7-4f7f-8d8b-6eb49a6f0003",
        tag: "Aguardando cliente"
      },
      {
        color: "#16a34a",
        id: "2b4c40d0-a9b7-4f7f-8d8b-6eb49a6f0004",
        tag: "Resolvido"
      }
    ]),
    createModel(3, "Pos-venda", [
      {
        color: "#2563eb",
        id: "7ad2f810-0caa-4e7c-8ee3-f0d6f8850001",
        tag: "Boas-vindas"
      },
      {
        color: "#9333ea",
        id: "7ad2f810-0caa-4e7c-8ee3-f0d6f8850002",
        tag: "Onboarding"
      },
      {
        color: "#f97316",
        id: "7ad2f810-0caa-4e7c-8ee3-f0d6f8850003",
        tag: "Follow-up"
      },
      {
        color: "#16a34a",
        id: "7ad2f810-0caa-4e7c-8ee3-f0d6f8850004",
        tag: "Fidelizacao"
      }
    ])
  ];
}
