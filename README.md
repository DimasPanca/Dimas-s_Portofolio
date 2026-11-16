# Dimas Panca Pamungkas — Portfolio

Personal portfolio website of **Dimas Panca Pamungkas** — Informatics student, software · AI · IoT builder, student-organization leader, and 1st-place winner at the International FAPERTA FAIR 2026 (Chiang Mai University, Thailand).

> **Status:** planning complete (PRD v1.1), implementation not started.
> The full product spec lives in [`docs/PRD.md`](docs/PRD.md). Content seed: [`docs/seed/content.seed.json`](docs/seed/content.seed.json). Source portrait: [`design/source/Dimas.jpg`](design/source/Dimas.jpg).

## Plan at a glance

- **Public site** (`apps/web`): Astro 7 static site — HTML-first, fully usable without JS; GSAP + Lenis motion, an OGL WebGL hero and Howler sound, all lazy-loaded behind quality tiers so it stays light.
- **Admin app** (`apps/admin`): a *separate* app/deployment (Vite + React PWA, Supabase Auth + MFA) to add achievements, projects and other content without touching code.
- **Backend**: Supabase (Postgres + RLS, Storage, Edge Functions).
- **Hosting**: Vercel (free Hobby plan, `*.vercel.app`) — one project for the site, one for the admin.
- **Rules**: performance budgets are CI gates; every fact comes from Dimas's own data; placeholders are flagged.

## Requirements (once implementation starts)

- Node.js **24 LTS** (minimum 22.23.4, see PRD §9.2) and pnpm.

## Ringkas (Bahasa Indonesia)

Website portofolio pribadi Dimas Panca Pamungkas. Spesifikasi lengkap ada di [`docs/PRD.md`](docs/PRD.md). Konten awal diambil dari CV dan jawaban Dimas, disimpan di `docs/seed/content.seed.json`; bagian yang belum ada datanya ditandai sebagai *placeholder*. Hosting memakai Vercel (gratis).

## License

All rights reserved © 2026 Dimas Panca Pamungkas, unless a file states otherwise. Third-party assets (fonts, audio) keep their own licenses and are listed on the `/credits` page once added.
