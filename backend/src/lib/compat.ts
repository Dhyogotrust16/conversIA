import type {
  AudienceTier,
  AuthToken,
  MigrationSetting,
  Notification,
  UrlEntry,
  User,
  WebhookEntry,
  WhiteLabel
} from "@prisma/client";

type UserWithRelations = User & {
  whiteLabel: WhiteLabel;
  authTokens?: AuthToken[];
};

export function buildUserPayload(
  user: UserWithRelations,
  tokens?: {
    bearerToken?: string;
    accessTokenPlugin?: string;
  }
) {
  const bearerToken =
    tokens?.bearerToken ??
    user.authTokens?.find((token) => token.kind === "BEARER" && token.revokedAt === null)?.token ??
    "";

  const accessTokenPlugin =
    tokens?.accessTokenPlugin ??
    user.authTokens?.find((token) => token.kind === "PLUGIN" && token.revokedAt === null)?.token ??
    "";

  return {
    user_id: user.id,
    name: user.name,
    email: user.email,
    wl_id: user.whiteLabel.chromeStoreId,
    bearer_token: bearerToken,
    access_token_plugin: accessTokenPlugin,
    user_premium: user.premiumReleaseAt
      ? {
          data_liberacao: user.premiumReleaseAt.toISOString()
        }
      : null,
    dataCadastro: user.createdAt.toISOString(),
    whatsapp_registro: user.whatsappRegistration ?? "",
    whatsapp_plugin: user.whatsappPlugin ?? "",
    path: user.path ?? `/${user.whiteLabel.chromeStoreId}`,
    afiliado: user.affiliateCode ?? "",
    campanhaID: user.campaignId ?? "",
    cookies: user.cookies ?? {}
  };
}

export function buildAuthGooglePayload(user: User) {
  return (user.authGoogle ?? { email_auth: user.email }) as Record<string, unknown>;
}

export function groupUrlEntries(entries: UrlEntry[]) {
  return entries.reduce<Record<string, Array<Record<string, unknown>>>>((accumulator, entry) => {
    const current = accumulator[entry.section] ?? [];

    current.push({
      id: entry.entryId,
      link: entry.link,
      active: entry.active,
      redirect: entry.redirect,
      msg: entry.msg ?? "",
      btnName: entry.btnName ?? ""
    });

    accumulator[entry.section] = current;
    return accumulator;
  }, {});
}

export function mapWebhookEntries(entries: WebhookEntry[]) {
  return entries.map((entry) => ({
    id: entry.webhookId,
    link: entry.link,
    active: entry.active
  }));
}

export function serializeMigration(
  migration: MigrationSetting | null | undefined,
  fallbackTutorialUrl: string
) {
  return {
    active: migration?.active ?? false,
    block_date: migration?.blockDate?.toISOString() ?? "",
    link_tutorial: migration?.linkTutorial ?? fallbackTutorialUrl
  };
}

export function matchesAudience(notificationAudience: AudienceTier, requestedTier: string) {
  if (notificationAudience === "ALL") {
    return true;
  }

  if (requestedTier === "premium") {
    return notificationAudience === "PREMIUM";
  }

  if (requestedTier === "free") {
    return notificationAudience === "FREE";
  }

  return false;
}

export function mapNotification(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    statement: notification.statement,
    viewer: notification.viewer,
    link: notification.link ?? "",
    btnName: notification.btnName ?? "",
    active: notification.active,
    data: notification.createdAt.getTime()
  };
}
