# Backend compativel da extensao

Primeira base para substituir o backend remoto mantendo o frontend original da extensao.

## Stack

- Fastify
- TypeScript
- Prisma
- PostgreSQL
- XLSX

## Escopo desta fase

- Autenticacao compativel com `login`, `login-bearer` e `validation`
- `initial-data` para URLs, webhooks e migracao
- rotas de `install`, `notes`, `active-notes` e `uninstall`
- notificacoes remotas
- processamento e exportacao de planilhas em XLSX

## Subir localmente

1. Copie `.env.example` para `.env`
2. Se quiser rodar com Postgres, suba o banco:

```powershell
docker compose up -d
```

3. Instale as dependencias:

```powershell
npm install
```

4. Gere o client e aplique o schema:

```powershell
npm run db:generate
npm run db:push
```

5. Popule os dados iniciais:

```powershell
npm run db:seed
```

6. Rode o backend:

```powershell
npm run dev
```

## Modo local sem banco

Se o Postgres nao estiver disponivel, o backend ainda sobe e atende os fluxos principais da extensao em modo local:

- `login`
- `login-bearer`
- `validation`
- `initial-data`
- `install`
- `notes`
- `notify`

Nesse modo, o login usa as credenciais definidas em:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Com os valores padrao deste repositorio:

- `admin@waspeed.local`
- `admin123`

Esse modo e suficiente para testar a extensao apontada para `http://127.0.0.1:8787` sem depender de Docker.

## Usuario inicial

O seed cria um usuario inicial com os dados definidos em:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_NAME`

## Endpoints principais

- `GET /health`
- `POST /api/auth/login/:chromeStoreId`
- `GET /api/auth/login-bearer/:chromeStoreId`
- `POST /api/auth/validation/:chromeStoreId`
- `GET /api/services/initial-data/:chromeStoreId`
- `GET /api/notify/get/:tier/:chromeStoreId`
- `GET /api/modelosCRM/get`
- `POST /api/clientesRegistrados/set`
- `GET /ws/api/reset/:whatsappId`
- `POST /api/audio/convert-ptt-file`
- `POST /api/XLSX/exporttab`
- `POST /api/XLSX/exportFunil`
- `POST /api/XLSX/contactprofile`
- `POST /api/XLSX/envioEmMassa`
- `GET /api/XLSX/gabarito`
- `POST /api/XLSX/exportrelatorio`
- `POST /api/XLSX/processPlanilha`

## Proximo passo

Depois desta base, o proximo corte natural e apontar a extensao para este backend proprio e cobrir modulos ainda dependentes de websocket, audio e automacoes externas.
