# Piscina Splash · Tratamento e checklist

Site para o celular com o guia de tratamento da piscina (Splash Italiana, 44.800 L, fibra, aquecimento solar) e um checklist que salva data, hora, quem fez, medições (cloro livre, pH, alcalinidade, temperatura), tarefas marcadas, produtos aplicados, gasto e observações.

- **Endereço:** https://manutencaopiscina.pages.dev
- **Hospedagem:** Cloudflare Pages (deploy automático a cada push na `main`)
- **Banco:** Cloudflare D1 (binding `DB`), tabela criada automaticamente
- **Acesso:** login com Google, só para os e-mails da lista `ALLOWED_EMAILS` (cada registro guarda o e-mail de quem lançou e de quem editou)
- **Sem internet:** registros novos ficam no celular e são enviados quando a conexão voltar

## Estrutura

```
public/                 site estático (sem build)
  index.html            telas: Login, Início, Guia, Checklist, Histórico
  styles.css
  app.js                lógica do app, faixas de referência e lista de tarefas
  sw.js                 service worker (funciona offline)
functions/api/          API (Cloudflare Pages Functions)
  _middleware.js        controle de acesso + criação/migração da tabela
  _auth.js              OAuth Google, sessão em cookie assinado, lista de e-mails
  _lib.js               validação e schema
  auth/login.js         redireciona para o Google
  auth/callback.js      volta do Google, confere o e-mail e cria a sessão
  auth/me.js            quem está logado
  auth/logout.js        sair
  registros/index.js    GET lista · POST cria
  registros/[id].js     GET · PUT · DELETE
schema.sql              referência da tabela
```

## Configuração no Cloudflare (uma vez)

1. **Workers & Pages → Create → Pages → Connect to Git** → escolha `limafelipe89/piscina-splash`.
2. Build settings: **Framework preset** `None`, **Build command** vazio, **Build output directory** `public`.
3. **Storage & Databases → D1 → Create database** com o nome `piscina`.
4. No projeto Pages: **Settings → Bindings → Add → D1 database**, nome da variável **`DB`**, banco `piscina`.
5. Configure o login com Google (abaixo).
6. **Deployments → … → Retry deployment** para aplicar binding e variáveis.

## Login com Google

### No Google Cloud (console.cloud.google.com)

1. Crie um projeto (ex.: `Piscina`).
2. **APIs e serviços → Tela de consentimento OAuth** (ou *Google Auth Platform*): tipo **Externo**, nome do app, e-mail de suporte. Em **Público-alvo**, clique em **Publicar app** (os escopos usados — e-mail, perfil — não exigem verificação). Se preferir deixar em *Teste*, cadastre cada e-mail em *Usuários de teste*.
3. **Credenciais / Clientes → Criar cliente OAuth → Aplicativo da Web**.
   - **URIs de redirecionamento autorizados:** `https://manutencaopiscina.pages.dev/api/auth/callback`
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.

### No Cloudflare Pages → Settings → Variables and Secrets

| Nome | Tipo | Valor |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Text | ID do cliente |
| `GOOGLE_CLIENT_SECRET` | Secret | Chave secreta do cliente |
| `ALLOWED_EMAILS` | Text | e-mails autorizados separados por vírgula, ex.: `voce@gmail.com, outra@gmail.com` |

Depois faça **Retry deployment**. Para incluir ou tirar alguém, edite `ALLOWED_EMAILS` e refaça o deploy; quem sair da lista perde o acesso na hora.

> Sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, o site usa o código de acesso `ACCESS_CODE` (se existir) ou fica aberto.

## Rodar localmente (opcional)

```
npx wrangler pages dev public --d1 DB --binding ACCESS_CODE=1234
```

## Ajustes comuns

- **Tarefas do checklist:** `TAREFAS` em `public/app.js`. Não renomeie os IDs existentes (o histórico usa eles); só o texto.
- **Faixas de cloro/pH/alcalinidade:** função `avaliar()` em `public/app.js`.
- **Texto do guia:** aba Guia em `public/index.html`.
- Ao mudar arquivos do site, troque `CACHE = "piscina-v2"` em `public/sw.js` para a próxima versão se algum celular insistir na versão antiga.
