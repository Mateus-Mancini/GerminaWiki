# GerminaWiki — web app

A wiki where students of Germinare (Instituto J&F) document their experience at the school. This repository holds the **web app**. The API lives in [ms-germina-wiki](https://github.com/Mateus-Mancini/ms-germina-wiki).

**Stack:** Vite · React 19 · TypeScript (strict) · Vitest. It's built as a static single-page app and hosted on Firebase Hosting.

## Development

Requires Node 22.

```bash
npm ci
npm run dev        # http://localhost:3000 (the local origin the API allows)
npm run typecheck
npm test           # Vitest
npm run build      # static build to frontend/dist
npm run preview    # serve the build on :3000
```

Code lives in `frontend/` (`index.html`, `src/`, `tests/`, `public/`).

## Spec-Driven Development

Features follow Spec Kit (`specify → clarify → plan → tasks → analyze → implement`). Specs are in [`specs/`](specs/), and the principles are in the [constitution](.specify/memory/constitution.md).

## Page editor

**Editar página** on a page opens a block editor (BlockNote) in place of the reading view. Its spec, plan and contracts are in [`specs/002-page-editor`](specs/002-page-editor/).

- **Saving** sends the page's `ETag` as `If-Match`. If someone saved first, the API answers 412 and the editor shows a **conflict screen** with both versions. You can discard yours, keep editing on top of the published one, or replace it after an explicit confirmation. Nothing is overwritten silently.
- **Drafts** are kept in this browser per member, page and tab until you save or discard them, and they're offered back when you edit again. When the session expires mid-edit, you sign in inside the editor and the same save is retried. Logging out deletes your drafts.
- **Stored format:** pages are Markdown. Each block is preceded by its comment anchor, `<!--b:<uuid>-->`, which comments point to. Wikilinks are `[[slug]]`, and images are `<API>/api/images/{id}`. The editor rewrites only the blocks you changed: an untouched page saves byte for byte, and anchors stay with their blocks. Content the editor can't represent appears as **Markdown avançado** and is kept as written.
- **Loading:** the editor is a separate chunk, downloaded only when someone edits. Reading pages doesn't load it.

## Deploy

The app is hosted on **Firebase Hosting** (free Spark plan) at https://germinawiki.web.app. There's no server of its own: data comes from the GerminaWiki API, called from the browser.

- **Pull requests** run `lint-build` (type-check, tests, static build), which is required to merge.
- **Merges to `main`** publish automatically (`.github/workflows/release.yml`).

Pipeline design and one-time setup: [`docs/ci-cd.md`](https://github.com/Mateus-Mancini/ms-germina-wiki/blob/main/docs/ci-cd.md) and [`specs/003-ci-cd`](https://github.com/Mateus-Mancini/ms-germina-wiki/tree/main/specs/003-ci-cd) in the API repository.
## Integração com API

O frontend tenta carregar pastas e páginas automaticamente ao abrir. Em desenvolvimento,
usa a API de produção (`frontend/.env.development`; para um backend local, defina
`VITE_API_BASE_URL=http://localhost:8080` em `frontend/.env.development.local`); em produção, configure `VITE_API_BASE_URL` com a
URL base do backend no ambiente de build. O Vite roda na porta `3000`, liberada pelo CORS
local do backend. Sem a variável de produção, o frontend mostra um erro de configuração em
vez de tentar acessar o `localhost` de cada visitante.
O workflow de publicação usa a variável `VITE_API_BASE_URL` do ambiente GitHub Actions
`production`, com a URL oficial da API como padrão.

O login envia e-mail e senha para `POST /api/auth/login`. O token Bearer fica em
`sessionStorage` somente até o vencimento informado pela API ou até o usuário sair; ele é
incluído nas chamadas autenticadas de pastas, páginas, busca, contribuições e perfil. Ao
receber `401`, a sessão é descartada e o frontend volta para a tela de login. O perfil próprio
é carregado por `GET /api/users/me` e pode ser atualizado por `PATCH /api/users/me`.

Todas as pastas, páginas, matérias e conteúdos exibidos vêm da API. Se ela estiver
indisponível, o frontend mostra o erro e não substitui os dados por conteúdo de demonstração.
O `@AdminOnly` do backend é um mecanismo de autorização para operações que o backend marcar;
ele não cria rotas administrativas por si só. O esquema do banco não inclui dados iniciais de
matérias. As pastas e páginas precisam ser cadastradas no backend para aparecer no site.
Contribuições são publicadas como páginas novas em `POST /api/pages`, dentro da pasta aberta.
