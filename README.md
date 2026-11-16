# Dimas Panca Pamungkas — Portfolio

Personal portfolio website of **Dimas Panca Pamungkas** — Informatics student, software · AI · IoT builder, student-organization leader.

> **Status:** planning complete, implementation not started.
> The full product spec lives in [`docs/PRD.md`](docs/PRD.md). Content seed (from the CV): [`docs/seed/content.seed.json`](docs/seed/content.seed.json). Source portrait: [`design/source/Dimas.png`](design/source/Dimas.png).

## Plan at a glance

- **Public site** (`apps/web`): Astro 7 static site — HTML-first, fully usable without JS; GSAP + Lenis motion, an OGL WebGL hero, Howler sound, all lazy-loaded behind quality tiers so it stays light.
- **Admin app** (`apps/admin`): a *separate* app/deployment (Vite + React PWA, Supabase Auth + MFA) to add achievements, projects and other content without touching code.
- **Backend**: Supabase (Postgres + RLS, Storage, Edge Functions); hosting on Cloudflare Pages.
- **Rules**: performance budgets are CI gates; every fact comes from the CV data; placeholders are flagged.

## Requirements (once implementation starts)

- Node.js **≥ 22.23.4** (see PRD §9.2), pnpm.

## Ringkas (Bahasa Indonesia)

Website portofolio pribadi Dimas Panca Pamungkas. Spesifikasi lengkap ada di [`docs/PRD.md`](docs/PRD.md). Konten awal diambil dari CV dan disimpan di `docs/seed/content.seed.json`; bagian yang belum ada datanya ditandai sebagai *placeholder*.

## License

All rights reserved © 2026 Dimas Panca Pamungkas, unless a file states otherwise. Third-party assets (fonts, audio) keep their own licenses and are listed on the `/credits` page once added.
