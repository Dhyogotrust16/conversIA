import type { Env } from "../config/env.js";
import { addDays, createOpaqueToken } from "./auth.js";

type LocalSession = {
  accessTokenPlugin: string;
  bearerToken: string;
  email: string;
  expiresAt: Date;
};

const LOCAL_CREATED_AT = new Date("2026-03-30T00:00:00.000Z");
const sessionsByEmail = new Map<string, LocalSession>();
const sessionsByBearer = new Map<string, LocalSession>();
const sessionsByPlugin = new Map<string, LocalSession>();

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function clearSession(session: LocalSession | undefined) {
  if (!session) {
    return;
  }

  sessionsByEmail.delete(session.email);
  sessionsByBearer.delete(session.bearerToken);
  sessionsByPlugin.delete(session.accessTokenPlugin);
}

function cleanupExpiredSessions() {
  const now = new Date();

  for (const session of sessionsByEmail.values()) {
    if (session.expiresAt <= now) {
      clearSession(session);
    }
  }
}

export function buildLocalWhiteLabel(env: Env, chromeStoreId: string) {
  return {
    appBaseUrl: env.APP_BASE_URL,
    chromeStoreId,
    cryptKey: env.EXTENSION_CRIPT_KEY,
    description: "Modo local sem Postgres para testes da extensao.",
    displayName: "WaSpeed: Superpoderes para o seu WhatsApp, CRM e muito mais.",
    firstName: "WaSpeed",
    language: "pt",
    nameId: "waspeed"
  };
}

export function validateLocalCredentials(env: Env, email: string, password: string) {
  return (
    normalizeEmail(email) === normalizeEmail(env.SEED_ADMIN_EMAIL) &&
    password === env.SEED_ADMIN_PASSWORD
  );
}

export function issueLocalSession(env: Env) {
  cleanupExpiredSessions();

  const email = normalizeEmail(env.SEED_ADMIN_EMAIL);
  clearSession(sessionsByEmail.get(email));

  const session: LocalSession = {
    accessTokenPlugin: createOpaqueToken("pl"),
    bearerToken: createOpaqueToken("br"),
    email,
    expiresAt: addDays(30)
  };

  sessionsByEmail.set(email, session);
  sessionsByBearer.set(session.bearerToken, session);
  sessionsByPlugin.set(session.accessTokenPlugin, session);

  return session;
}

export function getLocalSessionByBearer(token: string) {
  cleanupExpiredSessions();
  return sessionsByBearer.get(token) ?? null;
}

export function getLocalSessionByPlugin(email: string, accessTokenPlugin: string) {
  cleanupExpiredSessions();

  const session = sessionsByPlugin.get(accessTokenPlugin);

  if (!session) {
    return null;
  }

  if (session.email !== normalizeEmail(email)) {
    return null;
  }

  return session;
}

export function buildLocalUserPayload(
  env: Env,
  chromeStoreId: string,
  session: Pick<LocalSession, "accessTokenPlugin" | "bearerToken">
) {
  return {
    access_token_plugin: session.accessTokenPlugin,
    afiliado: "",
    bearer_token: session.bearerToken,
    campanhaID: "",
    cookies: {},
    dataCadastro: LOCAL_CREATED_AT.toISOString(),
    email: env.SEED_ADMIN_EMAIL,
    name: env.SEED_ADMIN_NAME,
    path: `/${chromeStoreId}`,
    user_id: `local-${chromeStoreId}`,
    user_premium: {
      data_liberacao: LOCAL_CREATED_AT.toISOString()
    },
    whatsapp_plugin: "",
    whatsapp_registro: "",
    wl_id: chromeStoreId
  };
}

export function buildLocalAuthGoogle(env: Env) {
  return {
    email_auth: env.SEED_ADMIN_EMAIL
  };
}

export function buildLocalInitialData(env: Env, chromeStoreId: string) {
  return {
    meet: {},
    migration: {
      active: env.MIGRATION_ACTIVE,
      block_date: env.MIGRATION_BLOCK_DATE
        ? new Date(env.MIGRATION_BLOCK_DATE).toISOString()
        : "",
      link_tutorial: env.MIGRATION_TUTORIAL_URL
    },
    urls: {
      principais: [
        {
          active: true,
          btnName: "",
          id: "checkout",
          link: `${env.APP_BASE_URL}/app/${chromeStoreId}/register`,
          msg: "",
          redirect: false
        },
        {
          active: true,
          btnName: "",
          id: "suporte_premium",
          link: `${env.APP_BASE_URL}/docs`,
          msg: "",
          redirect: false
        },
        {
          active: true,
          btnName: "",
          id: "suporte_gratuitos",
          link: `${env.APP_BASE_URL}/docs`,
          msg: "",
          redirect: false
        },
        {
          active: true,
          btnName: "",
          id: "iawascript",
          link: `${env.APP_BASE_URL}/app/${chromeStoreId}/ia-agents`,
          msg: "",
          redirect: false
        }
      ],
      redes_sociais: [
        {
          active: true,
          btnName: "",
          id: "youtube",
          link: `${env.APP_BASE_URL}/docs`,
          msg: "",
          redirect: false
        }
      ],
      tutoriais: [
        {
          active: true,
          btnName: "",
          id: "api",
          link: `${env.APP_BASE_URL}/docs`,
          msg: "",
          redirect: false
        },
        {
          active: true,
          btnName: "",
          id: "follow_up",
          link: `${env.APP_BASE_URL}/docs`,
          msg: "",
          redirect: false
        }
      ]
    },
    webhooks: [
      {
        active: false,
        id: "login_plugin",
        link: `${env.APP_BASE_URL}/webhooks/login-plugin`
      },
      {
        active: false,
        id: "open_functions",
        link: `${env.APP_BASE_URL}/webhooks/open-functions`
      }
    ]
  };
}
