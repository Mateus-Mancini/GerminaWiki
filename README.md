This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

The app is a **static export** (`output: "export"` → `out/`) hosted on **Firebase Hosting** (free Spark plan) at https://germinawiki.web.app. There is no Next.js server in production: data comes from the GerminaWiki API in the browser.

- **Pull requests** run `lint-build` (lint + static build), which is required to merge.
- **Merges to `main`** publish automatically (`.github/workflows/release.yml`).

Pipeline design and one-time setup: [`docs/ci-cd.md`](https://github.com/Mateus-Mancini/ms-germina-wiki/blob/main/docs/ci-cd.md) and [`specs/003-ci-cd`](https://github.com/Mateus-Mancini/ms-germina-wiki/tree/main/specs/003-ci-cd) in the backend repository.
