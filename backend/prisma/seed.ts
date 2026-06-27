import { PrismaClient, NotificationViewer, AudienceTier } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { hashPassword } from "../src/lib/auth.js";

loadEnv();

const prisma = new PrismaClient();

async function main() {
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:8787";
  const chromeStoreId = process.env.EXTENSION_CHROME_STORE_ID ?? "balkfdkhbcjjmhndnblgmlmcabnapogp";
  const cryptKey = process.env.EXTENSION_CRIPT_KEY ?? "ffce211a-7b07-4d91-ba5d-c40bb4034a83";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@waspeed.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador WaSpeed";
  const adminStatus = process.env.SEED_ADMIN_STATUS ?? "active";
  const migrationActive = (process.env.MIGRATION_ACTIVE ?? "false").toLowerCase() === "true";
  const migrationBlockDate = process.env.MIGRATION_BLOCK_DATE
    ? new Date(process.env.MIGRATION_BLOCK_DATE)
    : null;
  const migrationTutorialUrl = process.env.MIGRATION_TUTORIAL_URL ?? `${appBaseUrl}/docs`;

  const whiteLabel = await prisma.whiteLabel.upsert({
    where: { chromeStoreId },
    update: {
      nameId: "waspeed",
      firstName: "WaSpeed",
      displayName: "WaSpeed: Superpoderes para o seu WhatsApp, CRM e muito mais.",
      language: "pt",
      description: "Backend próprio compatível com a estrutura da extensão.",
      cryptKey,
      appBaseUrl
    },
    create: {
      chromeStoreId,
      nameId: "waspeed",
      firstName: "WaSpeed",
      displayName: "WaSpeed: Superpoderes para o seu WhatsApp, CRM e muito mais.",
      language: "pt",
      description: "Backend próprio compatível com a estrutura da extensão.",
      cryptKey,
      appBaseUrl
    }
  });

  await prisma.migrationSetting.upsert({
    where: { whiteLabelId: whiteLabel.id },
    update: {
      active: migrationActive,
      blockDate: migrationBlockDate,
      linkTutorial: migrationTutorialUrl
    },
    create: {
      whiteLabelId: whiteLabel.id,
      active: migrationActive,
      blockDate: migrationBlockDate,
      linkTutorial: migrationTutorialUrl
    }
  });

  const urlEntries = [
    {
      section: "principais",
      entryId: "checkout",
      link: `${appBaseUrl}/app/${chromeStoreId}/register`,
      active: true
    },
    {
      section: "principais",
      entryId: "suporte_premium",
      link: `${appBaseUrl}/docs`,
      active: true
    },
    {
      section: "principais",
      entryId: "suporte_gratuitos",
      link: `${appBaseUrl}/docs`,
      active: true
    },
    {
      section: "tutoriais",
      entryId: "api",
      link: `${appBaseUrl}/docs`,
      active: true
    },
    {
      section: "tutoriais",
      entryId: "follow_up",
      link: `${appBaseUrl}/docs`,
      active: true
    }
  ];

  for (const entry of urlEntries) {
    await prisma.urlEntry.upsert({
      where: {
        whiteLabelId_section_entryId: {
          whiteLabelId: whiteLabel.id,
          section: entry.section,
          entryId: entry.entryId
        }
      },
      update: entry,
      create: {
        whiteLabelId: whiteLabel.id,
        ...entry
      }
    });
  }

  const webhookEntries = [
    {
      webhookId: "login_plugin",
      link: `${appBaseUrl}/webhooks/login-plugin`,
      active: false
    },
    {
      webhookId: "open_functions",
      link: `${appBaseUrl}/webhooks/open-functions`,
      active: false
    }
  ];

  for (const entry of webhookEntries) {
    await prisma.webhookEntry.upsert({
      where: {
        whiteLabelId_webhookId: {
          whiteLabelId: whiteLabel.id,
          webhookId: entry.webhookId
        }
      },
      update: entry,
      create: {
        whiteLabelId: whiteLabel.id,
        ...entry
      }
    });
  }

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: {
      whiteLabelId_email: {
        whiteLabelId: whiteLabel.id,
        email: adminEmail
      }
    },
    update: {
      name: adminName,
      passwordHash,
      userStatus: adminStatus,
      premiumReleaseAt: new Date(),
      path: `/${chromeStoreId}`,
      authGoogle: { email_auth: adminEmail },
      cookies: {}
    },
    create: {
      whiteLabelId: whiteLabel.id,
      email: adminEmail,
      name: adminName,
      passwordHash,
      userStatus: adminStatus,
      premiumReleaseAt: new Date(),
      path: `/${chromeStoreId}`,
      authGoogle: { email_auth: adminEmail },
      cookies: {}
    }
  });

  const existingNotification = await prisma.notification.findFirst({
    where: {
      whiteLabelId: whiteLabel.id,
      title: "Backend próprio ativo"
    }
  });

  if (!existingNotification) {
    await prisma.notification.create({
      data: {
        whiteLabelId: whiteLabel.id,
        audience: AudienceTier.ALL,
        viewer: NotificationViewer.INBOX,
        title: "Backend próprio ativo",
        statement: "O backend compatível já está pronto para autenticação, URLs, notas e planilhas.",
        btnName: "Abrir documentação",
        link: `${appBaseUrl}/docs`,
        active: true,
        openOnUpdate: false
      }
    });
  }

  console.log(`White-label pronta: ${whiteLabel.chromeStoreId}`);
  console.log(`Usuário inicial: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
