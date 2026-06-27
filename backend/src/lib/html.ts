import type { Notification, WhiteLabel } from "@prisma/client";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLayout(title: string, description: string, content: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f1e8;
      --panel: #fffdf8;
      --text: #1f1a14;
      --muted: #6d6258;
      --line: #dbcfc1;
      --accent: #155eef;
      --accent-soft: #e3ecff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top left, #efe4d5 0, transparent 28%),
        linear-gradient(180deg, #f8f4ed 0%, var(--bg) 100%);
      color: var(--text);
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 48px 20px 72px;
    }
    .hero {
      border: 1px solid var(--line);
      background: rgba(255, 253, 248, 0.92);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(48, 35, 19, 0.08);
    }
    .eyebrow {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }
    h1 {
      margin: 16px 0 12px;
      font-size: clamp(32px, 6vw, 58px);
      line-height: 0.95;
      letter-spacing: -0.03em;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.6;
    }
    .grid {
      margin-top: 24px;
      display: grid;
      gap: 16px;
    }
    .card {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 18px;
      padding: 18px;
    }
    .card h2 {
      margin: 0 0 10px;
      font-size: 22px;
    }
    .card a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
    }
    .note {
      display: grid;
      gap: 8px;
      padding: 18px 0;
      border-top: 1px solid var(--line);
    }
    .note:first-child {
      border-top: 0;
      padding-top: 0;
    }
    .meta {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .actions {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 999px;
      text-decoration: none;
      background: var(--accent);
      color: white;
      font-weight: 700;
    }
    .button.secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--line);
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <span class="eyebrow">${escapeHtml(title)}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    <section class="grid">
      ${content}
    </section>
  </main>
</body>
</html>`;
}

export function renderDocsPage(baseUrl: string) {
  return renderLayout(
    "Backend compatível",
    "Primeira versão pronta para manter a extensão operando sobre infraestrutura própria.",
    `
      <article class="card">
        <h2>Rotas principais</h2>
        <p><strong>Auth:</strong> <code>/api/auth/login/:chromeStoreId</code>, <code>/api/auth/login-bearer/:chromeStoreId</code>, <code>/api/auth/validation/:chromeStoreId</code></p>
        <p><strong>Config:</strong> <code>/api/services/initial-data/:chromeStoreId</code>, <code>/api/notify/get/:tier/:chromeStoreId</code></p>
        <p><strong>Planilhas:</strong> <code>/api/XLSX/*</code></p>
        <p><strong>URLs:</strong> <code>/api/urls/install/:chromeStoreId</code>, <code>/api/urls/notes/:chromeStoreId</code>, <code>/api/urls/uninstall/:chromeStoreId</code></p>
      </article>
      <article class="card">
        <h2>Base pública</h2>
        <p>URL atual: <a href="${escapeHtml(baseUrl)}">${escapeHtml(baseUrl)}</a></p>
      </article>
    `
  );
}

export function renderApiDocsPage(baseUrl: string) {
  const escapedBaseUrl = escapeHtml(baseUrl);
  const exampleCurl = escapeHtml(`curl -X POST ${baseUrl}/api/bridge/send-text \\
  -H "Content-Type: application/json" \\
  -d '{"token":"wa_xxx","phone":"5511999999999@c.us","message":"Teste local"}'`);

  return renderLayout(
    "API local do WhatsApp",
    "Ponte local entre o backend proprio e a extensao conectada no WhatsApp Web.",
    `
      <article class="card">
        <h2>Fluxo</h2>
        <p>1. Abra o WhatsApp Web com a extensao carregada.</p>
        <p>2. Gere um token em API local dentro da extensao.</p>
        <p>3. Use as rotas abaixo para acionar envio, notas e etiquetas pelo navegador conectado.</p>
      </article>
      <article class="card">
        <h2>Endpoints</h2>
        <p><code>GET ${escapedBaseUrl}/api/bridge/client/:token</code></p>
        <p><code>GET ${escapedBaseUrl}/api/bridge/labels/:token</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/labels</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/send-text</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/send-image</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/send-video</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/send-audio</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/send-document</code></p>
        <p><code>POST ${escapedBaseUrl}/api/bridge/create-note</code></p>
      </article>
      <article class="card">
        <h2>Exemplo</h2>
        <p>Envio de texto usando a ponte local:</p>
        <pre style="margin: 12px 0 0; white-space: pre-wrap; word-break: break-word;"><code>${exampleCurl}</code></pre>
      </article>
    `
  );
}

export function renderAiAgentsPage(
  chromeStoreId: string,
  baseUrl: string,
  agents: Array<{
    phone: string;
    whatsappID: string;
    status: string;
    active: boolean;
    updatedAt: string;
  }>
) {
  const agentCards =
    agents.length === 0
      ? `
        <article class="card">
          <h2>Nenhum agente local configurado</h2>
          <p>Use a opcao Agente IA dentro do WhatsApp Web para iniciar ou parar um agente por chat. As acoes vao aparecer aqui.</p>
        </article>
      `
      : `
        ${agents
          .map(
            (agent) => `
              <article class="card">
                <h2>${agent.active ? "Agente ativo" : "Agente pausado"}</h2>
                <p><strong>Chat:</strong> ${escapeHtml(agent.phone)}</p>
                <p><strong>WhatsApp:</strong> ${escapeHtml(agent.whatsappID)}</p>
                <p><strong>Status:</strong> ${escapeHtml(agent.status)}</p>
                <p><strong>Atualizado em:</strong> ${escapeHtml(
                  new Date(agent.updatedAt).toLocaleString("pt-BR")
                )}</p>
              </article>
            `
          )
          .join("")}
      `;

  return renderLayout(
    `Agentes IA ${chromeStoreId}`,
    "Painel local para acompanhar os agentes de IA acionados pela extensao.",
    `
      <article class="card">
        <h2>Visao geral</h2>
        <p>Esta pagina recebe as acoes do menu Agente IA da extensao e registra o estado por chat localmente.</p>
        <div class="actions">
          <a class="button" href="${escapeHtml(baseUrl)}/api/ia/agents">Ver JSON</a>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/api-docs">API local</a>
        </div>
      </article>
      ${agentCards}
    `
  );
}

type ManagerLoginPageOptions = {
  chromeStoreId: string;
  baseUrl: string;
  extensionCryptKey: string;
  localCredentials?: {
    email: string;
    password: string;
  } | null;
};

type ManagerPanelPageOptions = {
  chromeStoreId: string;
  baseUrl: string;
  bearerToken: string;
  email: string;
  name: string;
  source: "database" | "local";
  whiteLabelName: string;
};

function renderExtensionBridgeScript(extensionId: string) {
  return `
    <script>
      (() => {
        const extensionId = ${JSON.stringify(extensionId)};

        function isSupported() {
          return Boolean(
            window.chrome &&
              window.chrome.runtime &&
              typeof window.chrome.runtime.sendMessage === "function"
          );
        }

        function send(action, payload = {}) {
          return new Promise((resolve, reject) => {
            if (!isSupported()) {
              reject(new Error("chrome.runtime.sendMessage indisponivel nesta pagina."));
              return;
            }

            window.chrome.runtime.sendMessage(extensionId, { action, ...payload }, (response) => {
              const runtimeError = window.chrome.runtime.lastError;

              if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
              }

              resolve(response ?? null);
            });
          });
        }

        window.__managerExtensionBridge = {
          isSupported,
          send
        };
      })();
    </script>
  `;
}

export function renderManagerLoginPage(options: ManagerLoginPageOptions) {
  const { chromeStoreId, baseUrl, extensionCryptKey, localCredentials } = options;
  const loginEndpoint = `${baseUrl}/api/auth/login/${chromeStoreId}`;
  const authPanelUrl = `${baseUrl}/app/${chromeStoreId}/auth-painel`;

  return renderLayout(
    `Painel do gestor ${chromeStoreId}`,
    "Acesso web local para abrir o painel do gestor sem depender do dominio antigo.",
    `
      <article class="card">
        <h2>Entrar no painel</h2>
        <p>Use o mesmo login da extensao. Quando a autenticacao der certo, esta pagina tenta sincronizar a sessao direto com a extensao e depois abre o painel do gestor local.</p>
        <form data-manager-login-form style="margin-top: 16px; display: grid; gap: 12px;">
          <label style="display: grid; gap: 6px;">
            <span class="meta">Email</span>
            <input
              name="email"
              type="email"
              autocomplete="username"
              placeholder="voce@empresa.com"
              value="${escapeHtml(localCredentials?.email ?? "")}"
              style="padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; font: inherit; background: white;"
            />
          </label>
          <label style="display: grid; gap: 6px;">
            <span class="meta">Senha</span>
            <input
              name="senha"
              type="password"
              autocomplete="current-password"
              placeholder="Sua senha"
              value="${escapeHtml(localCredentials?.password ?? "")}"
              style="padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; font: inherit; background: white;"
            />
          </label>
          <div class="actions">
            <button class="button" type="submit" style="border: 0; cursor: pointer;">Entrar</button>
            <a class="button secondary" href="${escapeHtml(
              `${baseUrl}/app/${chromeStoreId}/register`
            )}">Cadastro</a>
            <a class="button secondary" href="${escapeHtml(
              `${baseUrl}/app/${chromeStoreId}/recovery`
            )}">Recuperacao</a>
          </div>
          <p data-manager-login-status class="meta">Preencha email e senha para autenticar.</p>
        </form>
      </article>
      ${
        localCredentials
          ? `
            <article class="card">
              <h2>Modo local ativo</h2>
              <p>Como esta base esta em fallback local, as credenciais de teste ja foram preenchidas para acelerar a validacao do painel do gestor.</p>
              <p style="margin-top: 10px;"><strong>Email:</strong> ${escapeHtml(localCredentials.email)}</p>
              <p><strong>Senha:</strong> ${escapeHtml(localCredentials.password)}</p>
            </article>
          `
          : ""
      }
      <article class="card">
        <h2>Atalhos</h2>
        <div class="actions">
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/api-docs`)}">API local</a>
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/docs`)}">Documentacao</a>
        </div>
      </article>
      ${renderExtensionBridgeScript(chromeStoreId)}
      <script>
        (() => {
          const form = document.querySelector("[data-manager-login-form]");
          const status = document.querySelector("[data-manager-login-status]");
          const bridge = window.__managerExtensionBridge;

          if (!form || !status) {
            return;
          }

          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            status.textContent = "Autenticando...";

            const formData = new FormData(form);
            const email = String(formData.get("email") ?? "").trim();
            const senha = String(formData.get("senha") ?? "");

            if (!email || !senha) {
              status.textContent = "Preencha email e senha.";
              return;
            }

            try {
              const response = await fetch(${JSON.stringify(loginEndpoint)}, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "accept": "application/json",
                  "access-token": ${JSON.stringify(extensionCryptKey)}
                },
                body: JSON.stringify({ email, senha })
              });
              const payload = await response.json();

              if (!payload.success || !payload.user || !payload.user.bearer_token) {
                status.textContent = payload.msg_id || payload.message || "Nao foi possivel entrar no painel.";
                return;
              }

              const bearerToken = String(payload.user.bearer_token);

              if (bridge && bridge.isSupported()) {
                try {
                  status.textContent = "Login concluido. Sincronizando com a extensao...";
                  await bridge.send("user_auth", {
                    bearer_token: bearerToken,
                    close_painel: false
                  });
                  status.textContent = "Sessao sincronizada com a extensao.";
                } catch (extensionError) {
                  console.warn("Nao foi possivel sincronizar a sessao com a extensao", extensionError);
                  status.textContent = "Login concluido. Abrindo o painel web local.";
                }
              } else {
                status.textContent = "Login concluido. Abrindo o painel web local.";
              }

              window.location.href = ${JSON.stringify(authPanelUrl)} + "?" + encodeURIComponent(bearerToken);
            } catch (error) {
              console.error("Erro ao autenticar no painel do gestor", error);
              status.textContent = "Erro ao autenticar no painel.";
            }
          });
        })();
      </script>
    `
  );
}

export function renderManagerPanelPage(options: ManagerPanelPageOptions) {
  const { chromeStoreId, baseUrl, bearerToken, email, name, source, whiteLabelName } = options;
  const whatsappUrl = `https://web.whatsapp.com?bearer_token=${encodeURIComponent(bearerToken)}`;

  return renderLayout(
    `Painel do gestor ${whiteLabelName}`,
    "Sessao validada com sucesso no backend local.",
    `
      <article class="card">
        <h2>Sessao ativa</h2>
        <p><strong>Nome:</strong> ${escapeHtml(name || "Gestor")}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>White-label:</strong> ${escapeHtml(whiteLabelName)}</p>
        <p><strong>Origem:</strong> ${escapeHtml(source === "local" ? "Modo local" : "Banco de dados")}</p>
        <p data-extension-status class="meta" style="margin-top: 12px;">Aguardando sincronizacao com a extensao...</p>
        <div class="actions">
          <button data-sync-extension class="button" type="button" style="border: 0; cursor: pointer;">Sincronizar extensao</button>
          <button data-open-whatsapp class="button secondary" type="button" style="cursor: pointer;">Abrir no WhatsApp</button>
          <a class="button secondary" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noreferrer">Abrir WhatsApp Web</a>
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/app/${chromeStoreId}/login`)}">Trocar login</a>
        </div>
      </article>
      <article class="card">
        <h2>Painel do gestor</h2>
        <p>Este ponto substitui a rota antiga do painel. Aqui voce pode concentrar atalhos do gestor sem depender do dominio externo.</p>
        <div class="actions">
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/app/${chromeStoreId}/ia-agents`)}">Agentes IA</a>
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/api-docs`)}">API local</a>
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/api/urls/notes/${chromeStoreId}`)}">Notas</a>
          <a class="button secondary" href="${escapeHtml(`${baseUrl}/docs`)}">Documentacao</a>
        </div>
      </article>
      <article class="card">
        <h2>Bearer token atual</h2>
        <p>Se precisar validar integracao ou depurar a sessao, este e o token resolvido para o gestor.</p>
        <pre style="margin: 12px 0 0; white-space: pre-wrap; word-break: break-word;"><code>${escapeHtml(
          bearerToken
        )}</code></pre>
      </article>
      ${renderExtensionBridgeScript(chromeStoreId)}
      <script>
        (() => {
          const bridge = window.__managerExtensionBridge;
          const status = document.querySelector("[data-extension-status]");
          const syncButton = document.querySelector("[data-sync-extension]");
          const openWhatsappButton = document.querySelector("[data-open-whatsapp]");
          const bearerToken = ${JSON.stringify(bearerToken)};
          const fallbackWhatsappUrl = ${JSON.stringify(whatsappUrl)};

          if (!status || !syncButton || !openWhatsappButton) {
            return;
          }

          const setStatus = (message) => {
            status.textContent = message;
          };

          const setBusy = (button, busy) => {
            button.disabled = busy;
            button.style.opacity = busy ? "0.7" : "1";
          };

          const syncWithExtension = async (closePanel = false) => {
            if (!bridge || !bridge.isSupported()) {
              throw new Error("Extensao nao detectada nesta pagina.");
            }

            await bridge.send("user_auth", {
              bearer_token: bearerToken,
              close_painel: closePanel
            });
          };

          syncButton.addEventListener("click", async () => {
            setBusy(syncButton, true);
            setStatus("Sincronizando a sessao com a extensao...");

            try {
              await syncWithExtension(false);
              setStatus("Sessao sincronizada com a extensao.");
            } catch (error) {
              console.error("Falha ao sincronizar com a extensao", error);
              setStatus("Nao foi possivel sincronizar a extensao neste navegador.");
            } finally {
              setBusy(syncButton, false);
            }
          });

          openWhatsappButton.addEventListener("click", async () => {
            setBusy(openWhatsappButton, true);
            setStatus("Pedindo para a extensao abrir o WhatsApp...");

            try {
              if (!bridge || !bridge.isSupported()) {
                throw new Error("Extensao nao detectada nesta pagina.");
              }

              await bridge.send("open_whatsapp", {
                bearer: bearerToken
              });
              setStatus("WhatsApp solicitado para a extensao.");
            } catch (error) {
              console.error("Falha ao pedir abertura do WhatsApp", error);
              setStatus("Nao foi possivel abrir pela extensao. Abrindo o WhatsApp Web.");
              window.open(fallbackWhatsappUrl, "_blank", "noopener,noreferrer");
            } finally {
              setBusy(openWhatsappButton, false);
            }
          });

          if (bridge && bridge.isSupported()) {
            syncWithExtension(false)
              .then(() => {
                setStatus("Sessao sincronizada automaticamente com a extensao.");
              })
              .catch((error) => {
                console.warn("Sincronizacao automatica indisponivel", error);
                setStatus("Painel pronto. Use os botoes acima para integrar com a extensao.");
              });
          } else {
            setStatus("Painel pronto. Extensao nao detectada nesta pagina.");
          }
        })();
      </script>
    `
  );
}

export function renderWelcomePage(whiteLabel: WhiteLabel) {
  return renderLayout(
    `${whiteLabel.firstName} instalada`,
    "A extensão já pode usar backend, banco, notas e planilhas na sua própria infraestrutura.",
    `
      <article class="card">
        <h2>Próximos passos</h2>
        <p>1. Suba o backend.</p>
        <p>2. Aplique o schema e seed do banco.</p>
        <p>3. Aponte a extensão para esta base.</p>
      </article>
    `
  );
}

export function renderPlaceholderPanelPage(
  title: string,
  description: string,
  actionLabel?: string,
  actionHref?: string
) {
  return renderLayout(
    title,
    description,
    `
      <article class="card">
        <h2>Estrutura pronta</h2>
        <p>Esta rota já existe para encaixar o frontend original. A UI completa do painel pode ser construída aqui sem alterar o contrato da extensão.</p>
        ${
          actionLabel && actionHref
            ? `<div class="actions"><a class="button" href="${escapeHtml(actionHref)}">${escapeHtml(
                actionLabel
              )}</a></div>`
            : ""
        }
      </article>
    `
  );
}

export function renderNotesPage(whiteLabel: WhiteLabel, notifications: Notification[]) {
  const content =
    notifications.length === 0
      ? `
        <article class="card">
          <h2>Nenhuma nota publicada</h2>
          <p>O backend está ativo, mas ainda não há comunicados cadastrados para esta white-label.</p>
        </article>
      `
      : `
        <article class="card">
          <h2>Atualizações</h2>
          ${notifications
            .map(
              (notification) => `
                <section class="note">
                  <span class="meta">${notification.viewer} · ${notification.createdAt.toLocaleString("pt-BR")}</span>
                  <strong>${escapeHtml(notification.title)}</strong>
                  <p>${escapeHtml(notification.statement)}</p>
                  ${
                    notification.link
                      ? `<div class="actions"><a class="button secondary" href="${escapeHtml(
                          notification.link
                        )}">${escapeHtml(notification.btnName || "Abrir")}</a></div>`
                      : ""
                  }
                </section>
              `
            )
            .join("")}
        </article>
      `;

  return renderLayout(
    `${whiteLabel.firstName} updates`,
    "Página compatível com a área de notas/atualizações aberta pela extensão.",
    content
  );
}

export function renderUninstallPage(whiteLabel: WhiteLabel) {
  return renderLayout(
    `${whiteLabel.firstName} desinstalada`,
    "O evento foi registrado no backend próprio. Se quiser, esta página pode virar uma pesquisa de cancelamento depois.",
    `
      <article class="card">
        <h2>Evento recebido</h2>
        <p>A remoção da extensão foi registrada com sucesso.</p>
      </article>
    `
  );
}
