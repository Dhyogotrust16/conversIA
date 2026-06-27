import { PrismaClient } from "@prisma/client";
import { loadAppEnv } from "./config/env.js";
import { buildApp } from "./app.js";

const env = loadAppEnv();
const prisma = new PrismaClient();

async function start() {
  const app = await buildApp({ env, prisma });

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
