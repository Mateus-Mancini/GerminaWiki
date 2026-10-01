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

## Deploy

The app is hosted on **Firebase Hosting** (free Spark plan) at https://germinawiki.web.app. There's no server of its own: data comes from the GerminaWiki API, called from the browser.

- **Pull requests** run `lint-build` (type-check, tests, static build), which is required to merge.
- **Merges to `main`** publish automatically (`.github/workflows/release.yml`).

Pipeline design and one-time setup: [`docs/ci-cd.md`](https://github.com/Mateus-Mancini/ms-germina-wiki/blob/main/docs/ci-cd.md) and [`specs/003-ci-cd`](https://github.com/Mateus-Mancini/ms-germina-wiki/tree/main/specs/003-ci-cd) in the API repository.
## Integração com API

O frontend tenta carregar pastas e páginas automaticamente ao abrir. Em desenvolvimento,
usa `http://localhost:8080` por padrão; em produção, configure `VITE_API_BASE_URL` com a
URL base do backend no ambiente de build. O Vite roda na porta `3000`, liberada pelo CORS
local do backend. Sem a variável de produção, o frontend mostra um erro de configuração em
vez de tentar acessar o `localhost` de cada visitante.

Todas as pastas, páginas, matérias e conteúdos exibidos vêm da API. Se ela estiver
indisponível ou negar acesso, o frontend mostra o erro e não substitui os dados por conteúdo
de demonstração. O backend exige um principal autenticado para criar conteúdo; o mecanismo
de autenticação é responsabilidade da infraestrutura e não está definido pela API.
O esquema do banco não inclui dados iniciais de matérias. As pastas e páginas precisam ser
cadastradas no backend para aparecer no site. Contribuições são publicadas como páginas
novas em `POST /api/pages`, dentro da pasta da página aberta.
