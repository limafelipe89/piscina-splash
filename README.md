# Piscina Splash · Tratamento e checklist

Site para o celular com o guia de tratamento da piscina (Splash Italiana, 44.800 L, fibra, aquecimento solar) e um checklist que salva data, hora, quem fez, medições (cloro livre, pH, alcalinidade, temperatura), tarefas marcadas, produtos aplicados, gasto e observações.

- **Endereço:** https://manutencaopiscina.felipe-488.workers.dev
- **Hospedagem:** Cloudflare Worker com arquivos estáticos (deploy automático a cada push na `main`, configurado em `wrangler.jsonc`)
- **Banco:** Cloudflare D1 (binding `DB`), tabela criada automaticamente
- **Acesso:** login com Google. Quem não está liberado pede acesso ao entrar; o administrador (`ALLOWED_EMAILS` / `ADMIN_EMAILS`) libera ou recusa na tela **Acessos** (menu da foto). Cada registro guarda quem lançou e quem editou
- **Tela inicial:** aviso da água em cores (pode liberar / ajustar / não liberar) e 6 botões grandes: Registrar, Está acabando, Comprei, Gastos, Histórico e Guia. Cada tela tem botão Voltar
- **Registrar em 3 passos:** medição tocando nos valores do kit (cloro, pH e, se medir, alcalinidade) → o que foi feito → produtos colocados; quem fez e data vêm preenchidos. Ao salvar, mostra se pode liberar o banho
- **Está acabando / Comprei / Gastos:** qualquer um avisa o que está faltando; quem compra toca no item em *Comprei* e informa o valor, que entra nos gastos do mês (total por pessoa e CSV para prestação de contas)
- **Exclusão lógica:** registros, compras e itens da lista não são apagados do banco; só quem criou pode excluir (marcados com `excluido_em`/`excluido_por`)
- **Atividades:** log de logins, pedidos de acesso, criações, edições (com o que mudou), exclusões e tentativas bloqueadas — tela no menu da foto, só administrador
- **Cores:** azul #2A519F, preto #1B1B1C, cinza #666666
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
  acessos/index.js      pedidos de acesso e membros (só administrador)
  custos/index.js       GET lista · POST lança compra
  custos/[id].js        PUT · DELETE (exclusão lógica)
  lista/index.js        GET faltando/comprados · POST avisar que acabou
  lista/[id].js         PUT comprar (gera o gasto) · DELETE tirar da lista
  logs/index.js         GET atividades (só administrador)
  _log.js               gravação do log e regra de quem pode excluir
  _db.js                criação das tabelas registros, acessos, custos, lista_compras e logs
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
| `ALLOWED_EMAILS` | Text | o **primeiro** e-mail é o administrador (aprova novos membros); os demais ficam liberados direto. Ex.: `lima.felipe@gmail.com, outra@gmail.com` |
| `ADMIN_EMAILS` | Text | opcional: lista explícita de administradores (substitui a regra do primeiro e-mail) |

As variáveis valem a partir do próximo deploy (salvar no painel já gera um). Não é preciso colocar todo mundo nessa variável: quem não estiver nela pede acesso pelo próprio login e o administrador libera na tela **Acessos**. Remover alguém corta o acesso na hora.

> Sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, o site usa o código de acesso `ACCESS_CODE` (se existir) ou fica aberto.

## Rodar localmente (opcional)

```
npx wrangler dev   # variáveis locais em .dev.vars
```

## Ajustes comuns

- **O que foi feito (serviços):** `TAREFAS` em `public/app.js`. Não renomeie os IDs existentes (o histórico usa eles); só o texto.
- **Faixas de cloro/pH/alcalinidade:** função `avaliar()` em `public/app.js`.
- **Valores dos botões de medição:** atributo `data-valores` em `public/index.html` (ex.: `0,5;1;1,5;2;3;5`).
- **Texto do guia:** aba Guia em `public/index.html`.
- Ao mudar arquivos do site, troque `CACHE = "piscina-v2"` em `public/sw.js` para a próxima versão se algum celular insistir na versão antiga.
