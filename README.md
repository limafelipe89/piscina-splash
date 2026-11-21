# Piscina Splash · Tratamento e checklist

Site para o celular com o guia de tratamento da piscina (Splash Italiana, 44.800 L, fibra, aquecimento solar) e um checklist que salva data, hora, quem fez, medições (cloro livre, pH, alcalinidade, temperatura), tarefas marcadas, produtos aplicados, gasto e observações.

- **Endereço:** https://manutencaopiscina.felipe-488.workers.dev
- **Hospedagem:** Cloudflare Worker com arquivos estáticos (deploy automático a cada push na `main`, configurado em `wrangler.jsonc`)
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
src/index.js            entrada do Worker: /api/* usa as rotas de functions/api, o resto vem de public/
wrangler.jsonc          nome do Worker, pasta public/ e banco D1 `piscina` (binding DB)
```

## Configuração no Cloudflare (uma vez)

O Worker `manutencaopiscina` está ligado a este repositório (Settings → Builds). O `wrangler.jsonc` já define a pasta `public/` e o banco D1 `piscina`, então não é preciso criar bindings no painel.

- **Settings → Builds:** *Deploy command* `npx wrangler deploy`, *Build command* vazio.
- Variáveis e segredos: **Settings → Variables and secrets** (ver abaixo). O `keep_vars` no `wrangler.jsonc` preserva o que for criado no painel.

## Login com Google

### No Google Cloud (console.cloud.google.com)

1. Crie um projeto (ex.: `Piscina`).
2. **APIs e serviços → Tela de consentimento OAuth** (ou *Google Auth Platform*): tipo **Externo**, nome do app, e-mail de suporte. Em **Público-alvo**, clique em **Publicar app** (os escopos usados — e-mail, perfil — não exigem verificação). Se preferir deixar em *Teste*, cadastre cada e-mail em *Usuários de teste*.
3. **Credenciais / Clientes → Criar cliente OAuth → Aplicativo da Web**.
   - **URIs de redirecionamento autorizados:** `https://manutencaopiscina.felipe-488.workers.dev/api/auth/callback`
   - **Origens JavaScript autorizadas:** `https://manutencaopiscina.felipe-488.workers.dev`
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.

### No Cloudflare → Worker `manutencaopiscina` → Settings → Variables and secrets

| Nome | Tipo | Valor |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Text | ID do cliente |
| `GOOGLE_CLIENT_SECRET` | Secret | Chave secreta do cliente |
| `ALLOWED_EMAILS` | Text | e-mails autorizados separados por vírgula, ex.: `voce@gmail.com, outra@gmail.com` |

As variáveis valem a partir do próximo deploy (salvar no painel já gera um). Para incluir ou tirar alguém, edite `ALLOWED_EMAILS` e salve; quem sair da lista perde o acesso na hora.

> Sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, o site usa o código de acesso `ACCESS_CODE` (se existir) ou fica aberto.

## Rodar localmente (opcional)

```
npx wrangler dev   # variáveis locais em .dev.vars
```

## Ajustes comuns

- **Tarefas do checklist:** `TAREFAS` em `public/app.js`. Não renomeie os IDs existentes (o histórico usa eles); só o texto.
- **Faixas de cloro/pH/alcalinidade:** função `avaliar()` em `public/app.js`.
- **Texto do guia:** aba Guia em `public/index.html`.
- Ao mudar arquivos do site, troque `CACHE = "piscina-v2"` em `public/sw.js` para a próxima versão se algum celular insistir na versão antiga.
