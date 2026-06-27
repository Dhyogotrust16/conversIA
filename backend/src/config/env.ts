import { config as loadEnv } from "dotenv";

loadEnv();

export type Env = {
  DATABASE_URL: string;
  HOST: string;
  PORT: number;
  APP_BASE_URL: string;
  CORS_ORIGINS: string[];
  DOM_SELECTOR_SOURCE_URL: string;
  EXTENSION_CHROME_STORE_ID: string;
  EXTENSION_CRIPT_KEY: string;
  SEED_ADMIN_EMAIL: string;
  SEED_ADMIN_PASSWORD: string;
  SEED_ADMIN_NAME: string;
  SEED_ADMIN_STATUS: string;
  MIGRATION_ACTIVE: boolean;
  MIGRATION_BLOCK_DATE: string;
  MIGRATION_TUTORIAL_URL: string;
};

function readRequired(name: string, fallback = ""): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadAppEnv(): Env {
  return {
    DATABASE_URL: readRequired("DATABASE_URL"),
    HOST: process.env.HOST ?? "0.0.0.0",
    PORT: Number(process.env.PORT ?? 8787),
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://127.0.0.1:8787",
    CORS_ORIGINS: parseList(process.env.CORS_ORIGINS ?? "https://web.whatsapp.com,chrome-extension://*"),
    DOM_SELECTOR_SOURCE_URL:
      process.env.DOM_SELECTOR_SOURCE_URL ?? "https://painel-new.wascript.com.br/extend/domSelector.json",
    EXTENSION_CHROME_STORE_ID: process.env.EXTENSION_CHROME_STORE_ID ?? "balkfdkhbcjjmhndnblgmlmcabnapogp",
    EXTENSION_CRIPT_KEY: process.env.EXTENSION_CRIPT_KEY ?? "ffce211a-7b07-4d91-ba5d-c40bb4034a83",
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL ?? "admin@waspeed.local",
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? "admin123",
    SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME ?? "Administrador WaSpeed",
    SEED_ADMIN_STATUS: process.env.SEED_ADMIN_STATUS ?? "active",
    MIGRATION_ACTIVE: (process.env.MIGRATION_ACTIVE ?? "false").toLowerCase() === "true",
    MIGRATION_BLOCK_DATE: process.env.MIGRATION_BLOCK_DATE ?? "",
    MIGRATION_TUTORIAL_URL: process.env.MIGRATION_TUTORIAL_URL ?? "http://127.0.0.1:8787/docs"
  };
}
