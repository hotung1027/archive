# OmniSearch

OmniSearch is a Grand Archive TCG card search and deck builder built with Next.js, Bun, SQLite, Drizzle ORM, and React.

The app supports rich card filtering, deck construction, card printing details, effect text rendering, and static GitHub Pages deployment.

## Features

- Search cards by name and effect text.
- Filter by element, class, type, subtype, and reserve cost.
- Include/exclude Type and Subtype values with `+` and `-` controls.
- Build main, material, and sideboard lists with copy-limit validation.
- Inspect card printings, art variants, effects, rules, flavor text, and source payloads.
- Export a static JSON card dataset for GitHub Pages hosting.
- Fetch on-demand card prices from TCG Player (via TCG Tracking) with a single click (prices cached in the browser, no API key required).

## Requirements

- Bun 1.3 or newer
- Git

## Local Development

Install dependencies:

```bash
bun install
```

Create and seed the local SQLite database:

```bash
bun run db:migrate
bun run db:seed
```

Run the web app:

```bash
bun run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
bun run build        # Build the Next.js app
bun run test         # Run Bun tests
bun run db:migrate   # Apply database migrations
bun run db:seed      # Fetch Grand Archive card data into SQLite
bun run static:data  # Export apps/web/public/data/cards.json from SQLite
bun run static:build # Build the static GitHub Pages site
```

## Static Export

GitHub Pages cannot run the Next.js API routes or SQLite database, so static deployment uses a generated JSON file at `apps/web/public/data/cards.json`.

Generate static data locally:

```bash
bun run db:migrate
bun run db:seed
bun run static:data
```

Build the static site for a project Pages URL such as `/omnisearch`:

```bash
NEXT_PUBLIC_BASE_PATH=/omnisearch bun run static:build
```

PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH = "/omnisearch"
bun run static:build
Remove-Item Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue
```

The static output is written to `apps/web/out`.

For a user or organization Pages site like `username.github.io`, set `NEXT_PUBLIC_BASE_PATH` to an empty value.

The `static:build` script builds from a temporary copy of the web app without `apps/web/src/app/api`, because GitHub Pages cannot host server-side API route handlers.

## GitHub Pages Deployment

This repository includes `.github/workflows/deploy-pages.yml`.

The workflow runs on pushes to `main` and can also be started manually from the Actions tab. It:

1. Installs dependencies with Bun.
2. Restores this week's cached `cards.json` when available.
3. Runs database migrations and fetches Grand Archive card data only when the cache is missing or manually refreshed.
4. Exports and saves `cards.json` for future workflow runs.
5. Builds the Next.js app with `output: export` using `bun run static:build`.
6. Deploys `apps/web/out` to GitHub Pages.

When starting the workflow manually, enable `refresh_cards` to force a new card-data fetch and replace the cache used by later runs in the same week.

Before the first deployment, enable GitHub Pages in the repository settings and choose **GitHub Actions** as the source.

## Project Structure

```text
apps/web/              Next.js application
packages/db/           SQLite + Drizzle schema and migrations
packages/types/        Shared TypeScript types
scripts/fetch-cards.ts Grand Archive API crawler and DB seeder
scripts/export-static-data.ts Static JSON export for GitHub Pages
data/                  Local SQLite database files
```

## Notes

- Local development uses `/api/cards` and `/api/editions` backed by SQLite.
- Static GitHub Pages builds use `public/data/cards.json` and client-side filtering.
- SQLite database files and generated static data are intentionally ignored by git.