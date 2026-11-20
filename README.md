# Piscina Splash · Tratamento e checklist

Site para o celular com o guia de tratamento da piscina (Splash Italiana, 44.800 L, fibra, aquecimento solar) e um checklist que salva data, hora, quem fez, medições (cloro livre, pH, alcalinidade, temperatura), tarefas marcadas, produtos aplicados, gasto e observações.

- **Hospedagem:** Cloudflare Pages (deploy automático a cada push na `main`)
- **Banco:** Cloudflare D1 (binding `DB`), tabela criada automaticamente
- **Proteção:** código de acesso opcional (variável `ACCESS_CODE`)
- **Sem internet:** registros novos ficam no celular e são enviados quando a conexão voltar

## Estrutura

```
public/                 site estático (sem build)
  index.html            telas: Início, Guia, Checklist, Histórico
  styles.css
  app.js                lógica do app, faixas de referência e lista de tarefas
  sw.js                 service worker (funciona offline)
functions/api/          API (Cloudflare Pages Functions)
  _middleware.js        código de acesso + criação da tabela
  _lib.js               validação e schema
  registros/index.js    GET lista · POST cria
  registros/[id].js     GET · PUT · DELETE
schema.sql              referência da tabela
```

## Configuração no Cloudflare (uma vez)

1. **Workers & Pages → Create → Pages → Connect to Git** → escolha `limafelipe89/piscina-splash`.
2. Build settings: **Framework preset** `None`, **Build command** vazio, **Build output directory** `public`. Salve e faça o deploy.
3. **Storage & Databases → D1 → Create database** com o nome `piscina`.
4. No projeto Pages: **Settings → Bindings → Add → D1 database**, nome da variável **`DB`**, banco `piscina` (em Production e Preview).
5. **Settings → Variables and Secrets → Add**: nome **`ACCESS_CODE`**, tipo *Secret*, valor = o código que a família vai digitar.
6. **Deployments → … → Retry deployment** para aplicar binding e variável.

## Rodar localmente (opcional)

```
npx wrangler pages dev public --d1 DB --binding ACCESS_CODE=1234
```

## Ajustes comuns

- **Tarefas do checklist:** `TAREFAS` em `public/app.js`. Não renomeie os IDs existentes (o histórico usa eles); só o texto.
- **Faixas de cloro/pH/alcalinidade:** função `avaliar()` em `public/app.js`.
- **Texto do guia:** aba Guia em `public/index.html`.
- Ao mudar arquivos do site, troque `CACHE = "piscina-v1"` em `public/sw.js` para `v2`, `v3`… se algum celular insistir na versão antiga.
