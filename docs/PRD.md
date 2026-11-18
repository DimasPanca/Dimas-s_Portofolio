# Product Requirements Document — Dimas Panca Pamungkas Portfolio

> **Codename:** `SYSTEMS ONLINE`
> **Version:** 1.4 · **Date:** 2026-11-19 · **Owner / Author of record:** Dimas Panca Pamungkas
> **Audience of this document:** the implementer (an AI agent or an engineer) who will generate the whole product from this file and the files it points to.
> **Status:** Ready for implementation. Anything not stated here is a decision for the implementer *within the hard rules in §0.3*.

---

## Table of contents

0. [How to use this PRD · Hard rules](#0-how-to-use-this-prd--hard-rules)
1. [Product overview](#1-product-overview)
2. [Source of truth — Dimas's data](#2-source-of-truth--dimass-data)
3. [Reference analysis (the only design references)](#3-reference-analysis-the-only-design-references)
4. [Creative direction](#4-creative-direction)
5. [Information architecture & page specifications](#5-information-architecture--page-specifications)
6. [Motion system](#6-motion-system)
7. [Sound system](#7-sound-system)
8. [Performance architecture ("light even though it is loud")](#8-performance-architecture-light-even-though-it-is-loud)
9. [Technical architecture](#9-technical-architecture)
10. [Content management — the separate Admin app](#10-content-management--the-separate-admin-app)
11. [Contact & messaging](#11-contact--messaging)
12. [SEO · i18n · analytics · privacy](#12-seo--i18n--analytics--privacy)
13. [Accessibility](#13-accessibility)
14. [Quality assurance & Definition of Done](#14-quality-assurance--definition-of-done)
15. [Delivery plan, git rules & deployment runbook](#15-delivery-plan-git-rules--deployment-runbook)
16. [Open questions (with defaults already applied)](#16-open-questions-with-defaults-already-applied)
17. [Appendices](#17-appendices)

---

## 0. How to use this PRD · Hard rules

### 0.1 Ringkasan untuk Dimas (Bahasa Indonesia)

Dokumen ini adalah "otak" untuk membangun portofolio kamu dari nol, dengan tiga prinsip:

1. **Semua fakta tentang kamu diambil dari CV yang kamu berikan** (lihat §2 dan `docs/seed/content.seed.json`). Selain itu semua *placeholder* dan ditandai jelas supaya tidak ada klaim palsu.
2. **Semua referensi desain hanya dari bahan yang kamu berikan**: website `pacomepertant.com`, 5 video rekaman layar, dan 1 gambar (lihat §3). Tidak ada referensi lain.
3. **Visual ramai tapi tetap ringan.** Efek WebGL, animasi, dan suara dibuat *lazy-loaded*, punya mode hemat otomatis, dan dikunci oleh anggaran performa (§8) yang dicek di CI.

Fitur utama: layar pembuka ala "boot sistem" dengan pilihan **masuk dengan / tanpa suara**, hero berisi **foto kamu (`Dimas.jpg`)** dengan nama raksasa dan efek cahaya mengikuti kursor, bagian **Pencapaian** bergaya "Achievement Unlocked", linimasa pengalaman, karya, skill, kontak — dan **halaman Admin terpisah** (aplikasi tersendiri) tempat kamu menambah pencapaian/proyek baru tanpa menyentuh kode. Semua commit atas nama kamu; **tidak ada atribusi AI di mana pun** (aturan keras #1). Hosting: **Vercel (gratis)** untuk web dan admin, database di Supabase.

### 0.2 Conventions

* **Requirement IDs** look like `FR-HERO-03` (functional), `NFR-PERF-02` (non-functional), `AC-…` (acceptance criterion).
* **Priority:** `P0` = launch blocker · `P1` = should ship in v1.0 · `P2` = post-launch.
* **MUST / SHOULD / MAY** are used as in RFC 2119.
* **Placeholders** are written `[PLACEHOLDER: …]` in this document and carry `is_placeholder: true` in data.
* **References** are cited as `R0…R6` (defined in §3).
* Dates are ISO (`YYYY-MM-DD`); "today" for this document is 2026-11-16.

### 0.3 Hard rules (non-negotiable)

| # | Rule |
|---|---|
| **HR-1** | **Authorship.** Every commit, tag, PR and release is authored and committed by **Dimas Panca Pamungkas** using the git identity configured on his machine. **No AI attribution anywhere**: no `Co-authored-by:` trailers, no "Generated with …" footers, no AI tool/bot as author, committer, contributor, PR author or reviewer, no AI credit in README, footer, comments or `CREDITS`. No dependency-update bots (use manual updates). Enforced by a `commit-msg` hook and a CI guard (§15.3). |
| **HR-2** | **Truthfulness.** Facts about Dimas come *only* from §2 / the seed file. Never invent employers, awards, dates, metrics, proficiency levels, testimonials, client names or numbers. Everything else is a flagged placeholder. |
| **HR-3** | **References.** Design inspiration is limited to §3 (R0–R6). Do **not** copy their code, fonts, images, logos, sounds, copy or layout 1:1; reuse *patterns*, not assets. |
| **HR-4** | **Performance is a hard gate.** Budgets in §8 are enforced in CI. If an effect conflicts with a budget, the *effect* degrades (quality tier), never the budget. |
| **HR-5** | **Progressive enhancement.** All content, navigation and the contact path MUST work with JavaScript disabled, WebGL unavailable, audio off and `prefers-reduced-motion: reduce`. |
| **HR-6** | **Sound consent.** No audio before an explicit user gesture. The mute control is always reachable; the choice is persisted. |
| **HR-7** | **Admin isolation.** The admin app is a separate app and separate deployment. The public site ships **zero** admin code and **zero** secrets. |
| **HR-8** | **Secrets.** No secrets in git. Only `.env.example`. Browser code may only use the Supabase *publishable/anon* key. |
| **HR-9** | **Third-party media licensing.** Every audio/font/image/icon taken from the internet MUST be free for commercial use, and MUST be recorded in the license ledger (§7.5, `tools/audio/LEDGER.json`, `/credits` page). Prefer CC0 / no-attribution licenses. |
| **HR-10** | **PII.** The phone number and any other private identifier from the CV are **not** committed to the public repo. Dimas chose to **show WhatsApp on the site** (Q-8): it is rendered as a `wa.me` link built from `site_settings.contact.whatsappNumber`, which is entered in the admin app or injected at seed time from the git-ignored env var `SEED_WHATSAPP_NUMBER` — never committed. The seed file deliberately omits it. |
| **HR-11** | **Placeholders are visible to the owner.** Placeholder content is flagged in data, badged in admin, ribboned in preview builds, and listed by `pnpm content:lint`. Production builds warn (and fail when `STRICT_PLACEHOLDERS=1`). |
| **HR-12** | **Language.** Site copy: **English is the default** (served at `/`) with **Indonesian** at `/id/` via a visible toggle. Code, comments, commit messages and docs: English. |

### 0.4 Reading order for the implementer

1. §0 → §2 (rules + data) → §3 (references) → §4 (look & feel).
2. §5–§7 (what to build, motion, sound) → §8 (budgets) → §9 (stack) → §10 (admin).
3. §14–§15 (QA + delivery plan). Execute the milestones in §15.1 in order; each has acceptance criteria.
4. Open `docs/seed/content.seed.json` and `design/source/Dimas.jpg` as inputs. Local-only reference media (not committed) is described in §3.5.

### 0.5 Decisions log — Dimas's answers (2026-11-16)

| ID | Decision (from Dimas) | Where it lands in this PRD |
|---|---|---|
| **D-1** | A new portrait was supplied: **1792 × 2400 px** studio photo (Q-1 answered). | §2.1, §4.7, §5.3 |
| **D-2** | Hosting is **Vercel, free (Hobby)** on `*.vercel.app` domains (Q-2). Replaces the earlier Cloudflare Pages plan. Hobby is for **personal, non-commercial** use. | §1.5, §9.2, §9.4–§9.7, §15.4, Appx F/I |
| **D-3** | Languages & frameworks to list: **Next.js, PHP, Laravel, Python, C++, JavaScript** (Q-4). | §2.7, §5.8 |
| **D-4** | The Edge-AI/IoT oyster-mushroom system **is** the FAPERTA FAIR 2026 1st-place entry, won in **Thailand at Chiang Mai University** (Q-5; A-2 resolved). | §2.5, §2.6, §5.3 ticker, §5.5, §5.7 |
| **D-5** | Availability text stays a **placeholder** (Q-7). | §5.3, A-5 |
| **D-6** | **WhatsApp is shown** on the site (Q-8). The number is *not* committed to the public repo. | HR-10, §5.10, Appx F |
| **D-7** | Socials: Email, **Instagram `@dimas_pancapamungkas`**, LinkedIn (+ GitHub from the CV). | §2.1, §5.10 |
| **D-8** | Next.js is one of Dimas's *skills*, not a requirement for this site. The public site stays **Astro** (lighter); Vercel hosts its static output natively. | §9.2 |
| **D-9** | Runtime target is **Node 24 LTS** (min 22.23.4): Astro 7 needs ≥ 22.23.4 and Vercel has retired Node 20. | §9.2 |
| **D-10** | **Default site language = English**, Indonesian secondary (Q-9). Routing: `/` = EN, `/id/` = ID. | HR-12, §5.1, §5.2, §12.1–§12.2 |
| **D-11** | Degree wording: **Informatics Engineering** (Q-3; A-1 resolved). | §2.3 |
| **D-12** | The FAPERTA FAIR entry was an **individual** entry → first-person ("I") wording is correct (Q-13). | §2.5, §5.4 |
| **D-13** | Achievements grew from 5 to **9**, each with month, host institution and type (Q-14). A **writing standard** normalizes how every competition is written. | §2.5, §2.5.1, §5.5, §10.2, Appx B/C |
| **D-14** | Proof links come **later**; the admin has a dedicated **Proofs** panel and a "missing proof" checklist (Q-6). | §5.5, §10.2, A-3 |
| **D-15** | Photos (Chiang Mai and others) come **later**; the admin has a **Gallery** screen with albums and bulk upload (Q-11). | §5.9, §10.2 |
| **D-16** | Professional anti-spam chosen: **Turnstile + honeypot + time-trap + rate limit**, with Resend for owner notifications (Q-10). | §9.2, §11 |
| **D-17** | Tone = **formal facts, playful interactions** (Q-12). | §4.10 |
| **D-18** | **All nine achievements are from 2026** — Dimas confirmed the year for the four that had only a month (Q-15; A-8 closed). | §2.5 |
| **D-19** | **No work titles are shown** for achievements, no extra descriptions are needed (summaries stay neutral one-liners), and Dimas is **not** updating the CV with the four newer achievements (Q-16; A-9 closed). The `work_title` field was removed from the model. | §2.5.1, §10.2, Appx B/C |


---

## 1. Product overview

### 1.1 Vision

A single, memorable website that lets a recruiter, a hackathon organizer or a collaborator understand **who Dimas is, what he has won, what he has built and how to reach him — in under 10 seconds of scrolling** — while feeling like a small, polished piece of interactive art. It replaces hopping between LinkedIn, Drive, a PDF CV and social profiles (the intent behind R6's caption: *"bikin HR auto scroll dan gak ribet pindah-pindah platform"*).

### 1.2 Positioning (derived strictly from the CV)

> **Informatics student who builds software, AI and IoT — and leads the teams that ship it.**
> Student-organization president (HMIF FT UNTIRTA), project manager of an internally-deployed multiplayer game for RedDoorz, and a multi-award competitor in 2026 — nine placements across essay, business, machine-learning and hackathon competitions, including an **international 1st place in Thailand**.

Interests stated in the CV: **software engineering, IoT, AI**. Hard skills stated: full-stack web apps, AI-powered solutions, IoT systems, database design, REST API integration, prompt engineering, RAG, ESP32 embedded systems, Git, Figma prototyping. Soft skills stated: leadership, collaboration, planning, communication, problem-solving, strategic decision-making.

### 1.3 Audiences

| ID | Audience | What they need | Design consequence |
|---|---|---|---|
| A1 | **HR / recruiter** (Indonesia first) | Scan in seconds: role, education + GPA, experience, proof (awards), CV download, contact | Gate is skippable in ≤1 action; stats strip; English copy with a one-click Indonesian toggle; `/cv` + PDF; no friction |
| A2 | **Hackathon / competition organizers & judges** | Evidence of achievements & teamwork | Achievements rail with proof links |
| A3 | **Collaborators / clients** | Projects, stack, how to contact | Works + case studies + contact form |
| A4 | **Peers / juniors (HMIF)** | Personality, leadership | Journey/organization section, gallery |

### 1.4 Goals

* **G1** — Instantly communicate identity + credibility (hero, stats, achievements).
* **G2** — Deliver a *feel*: cinematic boot sequence, cursor-lit portrait, tactile sound, game-like "Achievement Unlocked" moments.
* **G3** — Stay light: fast on mid-range phones and 4G (budgets in §8).
* **G4** — Zero-code content updates via a separate admin app (new achievement live in ≤ 90 s after "Publish").
* **G5** — Be accessible, indexable and shareable (SEO, OG images, JSON-LD).
* **G6** — Be maintainable by one person for years (small dependency surface, typed content model, CI gates).

### 1.5 Non-goals (v1.0)

* No e-commerce, blog/CMS-for-articles, comments, user accounts for visitors, or pricing tables (no pricing data exists; R4's pricing is deliberately *not* adopted).
* No ads, paid services or other commercial offerings: Vercel's free Hobby plan is restricted to **personal, non-commercial** use (a job-search portfolio qualifies).
* No third-party tracking cookies, no consent banner (cookie-less analytics only).
* No native mobile app (the admin is an installable PWA, §10).

### 1.6 Success metrics

| Metric | Target | How measured |
|---|---|---|
| Lighthouse (mobile, throttled) Performance / A11y / Best Practices / SEO | ≥ 90 / ≥ 100 / ≥ 100 / ≥ 100 | Lighthouse CI on every PR (§8.6) |
| Lighthouse (desktop) Performance | ≥ 95 | LHCI |
| LCP / CLS / INP (field, p75) | ≤ 2.0 s / ≤ 0.05 / ≤ 150 ms | Vercel Speed Insights (Web Vitals) |
| Initial transfer (HTML+CSS+JS+fonts+LCP image), no audio | ≤ 450 KB | CI size gate |
| Publish latency (admin "Publish" → visible on site) | ≤ 90 s p95 | publish_runs table |
| "Add an achievement from my phone" task | ≤ 2 min | manual UAT |
| Sound opt-in rate, CV downloads, contact conversions | tracked, no target | custom events (cookie-less) |

---

## 2. Source of truth — Dimas's data

> **Provenance:** `CV_Dimas Panca Pamungkas.pdf` (2 pages) provided by Dimas on 2026-11-16; the portrait `Dimas.jpg` (replaced 2026-11-16); and Dimas's written answers of 2026-11-16 (§0.5: languages/frameworks, Instagram handle, FAPERTA FAIR details). The full machine-readable version is **`docs/seed/content.seed.json`** (EN verbatim from the CV, ID drafted and flagged `needs_review`). If this section and the seed ever disagree, **the seed wins**, then fix this section.

### 2.1 Identity

| Field | Value | Notes |
|---|---|---|
| Name | **Dimas Panca Pamungkas** | CV spelling is "Pamungkas" (note: some local folder names say "Pamungka" — ignore) |
| Location | Serang, Banten, Indonesia | |
| Email | `dimaspanca2005@gmail.com` | from CV; Dimas typed it as `DimasPanca2005@gmail.com` — same address (case-insensitive); canonical form is lowercase |
| LinkedIn | `https://www.linkedin.com/in/dimas-panca-pamungkas-66609a208/` | from CV |
| GitHub | `https://github.com/DimasPanca` | from CV |
| Instagram | `@dimas_pancapamungkas` → `https://www.instagram.com/dimas_pancapamungkas/` | provided by Dimas (2026-11-16); handles are lowercase |
| WhatsApp | **shown on the site** as a `wa.me` link (D-6). The number is in the CV but is **not committed** to this public repo | HR-10 → `site_settings.contact.whatsappNumber` via admin, or `SEED_WHATSAPP_NUMBER` (git-ignored env) at seed time |
| Portrait | `design/source/Dimas.jpg` — **1792 × 2400 px** studio portrait (replaced the earlier 355×474 red-background ID photo on 2026-11-16): Dimas seated on a high stool, black blazer over a dark-teal tee, black trousers and shoes, looking toward camera-left; grey seamless backdrop, dark floor. ⚠ The supplied file was named `Dimas.png` but is a **JPEG** (no EXIF/GPS/XMP found), so it is stored as `.jpg` | see §4.7 pipeline |

### 2.2 Summary (verbatim from CV, third person)

> "Dimas Panca Pamungkas is an Informatics Engineering student at Sultan Ageng Tirtayasa University with experience in leadership, software development, and intelligent automation. He has served as an ANBK Operator and Technician, Educational Foundation Secretary, and Project Manager, while actively participating in student organizations. His interests include software engineering, IoT, and AI, supported by multiple national achievements in hackathons, business innovation, and essay competitions."

The site MUST show a first-person rewrite (flagged `needs_review`) *and* keep the verbatim text available in the CV/JSON-LD description.

### 2.3 Education

| Institution | Program (as written in CV) | Period | GPA |
|---|---|---|---|
| Universitas Sultan Ageng Tirtayasa — Banten, Indonesia | **Bachelor of Informatics Engineering** (the CV degree line says "Informatic System"; Dimas chose *Informatics Engineering* — A-1 resolved) | 2024-07 → 2027-11 (expected) | **3.89 / 4.00** |

### 2.4 Experience (work + organization)

| ID | Organization | Role | Period | Type |
|---|---|---|---|---|
| `reddoorz-pm` | RedDoorz — Indonesia | **Project Manager** | 2026-07 (single month as written) | Work |
| `hmif-president` | Himpunan Mahasiswa Informatika (HMIF FT UNTIRTA) — Cilegon, Banten | **President** | 2025-10 → present | Organization |
| `pkbm-abdi-pertiwi` | PKBM Abdi Pertiwi — Indonesia | **ANBK Operator & Technician / Secretary** | 2023-06 → 2026-06 | Work |
| `voucher-game-shop` | Voucher Game Shop | **Graphic Designer** | 2020-02 → 2021-05 | Work |

Bullets for each are in the seed (verbatim). Highlights worth surfacing: RedDoorz — *"Successfully delivered a production-ready application adopted for internal use by RedDoorz"*; HMIF — led the association, directed the executive board and multiple divisions, managed planning/budgeting, represented the association to university, external orgs and industry partners.

### 2.5 Achievements (2026) — 9 records

> **Sources:** rows 1, 4, 7, 8, 9 appear in the CV; rows 2, 3, 5, 6 were added by Dimas in chat on 2026-11-16 (not in the CV, which Dimas chose **not** to update — D-19). Months and host institutions were supplied by Dimas on 2026-11-16 (Q-14), and Dimas **confirmed that all nine are from 2026** (Q-15 → D-18).

| # | Slug | Rank | Event (official name) | Organizer (host) | Type · scope | When | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `faperta-fair-2026-1st` | **1st Place** | 10th International **FAPERTA FAIR** 2026 (Research, Technology, and Art) | Chiang Mai University — *Chiang Mai, Thailand* | Essay Competition · international | Aug 2026 | **Individual** entry (D-12). The entry is the Edge-AI + IoT oyster-mushroom system (§2.6) — link confirmed |
| 2 | `ipb-agri-volution-2026-1st` | **1st Place** | Agri-Volution: Redefining the Ordinary, Cultivating the Next Gen Agri-System | IPB University | Essay Competition | Oct 2026 | chat only |
| 3 | `brawijaya-sustainable-innovation-2026-1st` | **1st Place** | Brawijaya Sustainable Strategic Innovation Contest | Universitas Brawijaya | Essay Competition | Sep 2026 | chat only |
| 4 | `bmc-industrial-2026-1st` | **1st Place** | Industrial Competitions — Business Model Canvas Competition | Universitas Serang Raya | Business Model Canvas Competition | Jun 2026 | CV: innovative business model + commercialization strategy; market analysis, value-proposition design, business validation; pitched to the judges |
| 5 | `agridata-telepati-8-2026-2nd` | **2nd Place** | Agridata Telepati 8.0 | Politeknik Negeri Bandung (Polban) | Machine Learning Competition | Nov 2026 | chat only; "Politeknik Bandung" expanded to the official name |
| 6 | `gbic-gunadarma-2026-2nd` | **2nd Place** | UGP – GBIC Business Plan Competition | Universitas Gunadarma | Business Plan Competition | Oct 2026 | chat only |
| 7 | `geteksi-v3-2026-3rd` | **3rd Place** | GETEKSI Vol. 3 National Essay Competition | Institut Teknologi dan Bisnis STIKOM Bali | Essay Competition · national | Jul 2026 | CV: research-based innovation addressing real-world challenges through technology and strategic analysis |
| 8 | `innovate-astra-2026-top4` | **Top 4 Finalist** | IN:NOVATE National Hackathon | Astra University | Hackathon · national | Jun 2026 | CV: multidisciplinary team (team entry) |
| 9 | `bncc-binus-2026-top10` | **Top 10 Finalist** | National Hackathon Competition | BNCC — Bina Nusantara Computer Club (Binus) | Hackathon · national | Jul 2026 | CV: multidisciplinary team (team entry) |

The order above is the **default display order**: international first → rank → date (newest first); Dimas can override it by drag-reorder in the admin. **Derived stats (computed from data, never hard-coded):** 9 achievements · 4× 1st place · 2× 2nd place · 7 podium finishes.

#### 2.5.1 Writing standard — how every achievement is written (Dimas asked for a tidy, consistent structure)

Dimas supplied the list in free text (placement, event, month and organizer mixed together). Every record MUST be stored in the same structured shape, and the UI composes the display line from the fields:

`{Rank} — {Event} · {Organizer} · {Mon YYYY}` with chips `{Type}` · `{Scope}` · `{Location}`

| Field | Standard |
|---|---|
| **Rank label** | One of the canonical set: **1st Place · 2nd Place · 3rd Place · Top N Finalist** (ID: *Juara 1/2/3 · Finalis Top N*). Extra words such as "Winner" / "Essay Winner" are dropped — the **type** chip already says "Essay". |
| **Event title** | The **official event name only**: no placement, no "by <organizer>", no trailing year in parentheses unless the year is part of the official name (e.g. *FAPERTA FAIR 2026*). ALL CAPS → Title Case; keep acronyms and punctuation (*IN:NOVATE*, *UGP – GBIC*). |
| **Organizer (host)** | Full official institution name. Expand a shortened name only when certain (*Gunadarma* → Universitas Gunadarma, *IPB* → IPB University, *Polban* → Politeknik Negeri Bandung (Polban)); otherwise keep as written and flag `needs_review`. |
| **Type label + category** | Type label from a controlled list (*Essay Competition, Business Model Canvas Competition, Business Plan Competition, Machine Learning Competition, Hackathon, …*); `category` enum drives the filter chips: `essay · business · hackathon · ai-ml · research · certification · other`. |
| **When** | Month precision, stored ISO `YYYY-MM-01` (Dimas wrote months in Indonesian — *Agustus, Oktober …* — store ISO; display with `Intl` per locale: "Aug 2026" / "Agu 2026"). |
| **Location / scope** | Only when stated (city + country when outside Indonesia). **Never guess** scope: unknown ⇒ empty. |
| **Entry type** | `individual\|team`, when known. (Work titles are **not shown** anywhere — D-19.) |
| **Summary** | ≤ 280 chars, factual, first person allowed (D-12). When Dimas has not described a result, use one neutral sentence composed from the structured fields — no extra claims. Dimas confirmed no further descriptions are needed (D-19); the neutral line stays. |

Examples (as written by Dimas → standard form):

| As written | Standard form |
|---|---|
| *1st Place Winner – 10th International FAPERTA FAIR 2026 (Research, Technology, and Art) (Agustus) (Essay Competition) (Chang Mai University)* | **1st Place** — 10th International FAPERTA FAIR 2026 (Research, Technology, and Art) · Chiang Mai University · Aug 2026 · *Essay Competition* · international · Chiang Mai, Thailand |
| *1st Place Essay Winner - Agri-Volution: Redefining the Ordinary, Cultivating the Next Gen Agri-System (IPB) (Oktober) (Essay Competition)* | **1st Place** — Agri-Volution: Redefining the Ordinary, Cultivating the Next Gen Agri-System · IPB University · Oct 2026 · *Essay Competition* |
| *2nd Bisnis Plan Competition - UGP - GBIC Gunadarma (Oktober) (Gunadarma) (Bisnis Plan Competition)* | **2nd Place** — UGP – GBIC Business Plan Competition · Universitas Gunadarma · Oct 2026 · *Business Plan Competition* |

The admin form (§10.2) enforces this with **lint hints** (warns on placement words inside the title, ALL-CAPS titles, trailing "(2026)", missing organizer) and a **live preview of the display line**.


### 2.6 Projects (real items only)

| Slug | Title | Role | Year | Description (from CV) |
|---|---|---|---|---|
| `reddoorz-team-run` | **RedDoorz Team Run** | Project Manager | 2026 | Multiplayer co-op game delivered for **internal use** within RedDoorz; planning, sprints, cross-functional coordination (developers, designers, stakeholders), feature prioritization, QA/UAT, delivered production-ready |
| `edge-ai-oyster-mushroom` | **Fully-automated, near-zero-waste oyster-mushroom cultivation system (Edge AI + IoT)** | Proposer; designed system architecture, wiring and hardware selection | 2026 | Wording from the CV (a *proposal*). **This is the entry that won 1st place at FAPERTA FAIR 2026 (Chiang Mai University, Thailand)** — confirmed by Dimas; **featured** project |

### 2.7 Skills (only what the CV states)

* **Hard:** full-stack web application development · AI-powered solutions · IoT systems · database design · REST API integration · prompt engineering · retrieval-augmented generation (RAG) · embedded systems with ESP32 · version control with Git · UI prototyping with Figma.
* **Soft:** leadership · collaboration · project planning · effective communication · problem-solving · strategic decision-making · balancing multiple responsibilities · presentation/pitching (stated inside achievements).
* **Languages & frameworks (provided by Dimas on 2026-11-16, not in the CV):** Next.js · PHP · Laravel · Python · C++ · JavaScript. Shown as technology tiles (§5.8) with **no proficiency levels** (none were given). **Never** show proficiency percentages/bars.

### 2.8 Assumptions & inconsistencies register

| ID | Issue | Default applied | Resolve by |
|---|---|---|---|
| **A-1** | **Resolved 2026-11-16:** Dimas chose **Informatics Engineering**. | Education record: "Bachelor of Informatics Engineering"; the CV degree-line typo is not reproduced | closed |
| **A-2** | **Resolved 2026-11-16:** Dimas confirmed the Edge-AI oyster-mushroom system is the FAPERTA FAIR 2026 winning entry, won in Thailand at Chiang Mai University. | Records linked (`linkConfirmed: true`); achievement `location` = *Chiang Mai University, Thailand* | closed |
| **A-3** | CV contains two Google Drive proof links (not mapped to specific achievements); Dimas will supply proofs **later** (Q-6). | Not copied to the repo; every achievement has a **Proofs** panel in the admin (§10.2) and a "missing proof" checklist | Q-6 |
| **A-4** | RedDoorz period is only "Jul 2026". | Display "Jul 2026"; `end` omitted. | — |
| **A-5** | "Available for …" status not stated. | `[PLACEHOLDER: availability text]` e.g. "Open to internships & collaborations" shown in ticker/badge, editable in admin. | Q-7 |
| **A-6** | No photo of competitions/events, no project screenshots/links. | Generated placeholder art + `is_placeholder`. | Dimas uploads in admin |
| **A-7** | Dimas wrote the venue as "Chang Mai University"; the institution's official name is **Chiang Mai University** (Thailand). | Official spelling used | tell me if the venue wording should differ |
| **A-8** | **Resolved 2026-11-16:** Dimas confirmed all achievements, including the four that had only a month, are from **2026**. | Dates stored as `2026-MM-01`, month precision | closed |
| **A-9** | **Resolved 2026-11-16:** four of the nine achievements are not in the CV supplied earlier; Dimas decided **not** to update the CV. | The site uses the full list from §2.5; the CV file itself is out of scope | closed |

### 2.9 Placeholder register (everything *not* in the CV)

Marked `is_placeholder: true` in seed/data: 3 extra projects (generic cards), 6 gallery tiles, availability text, CV PDF file, project screenshots/links, event photos, OG/social images, testimonial block (not rendered in v1.0), Indonesian translations (`needs_review: true`, a *different* flag). *(Languages/frameworks and the WhatsApp number are no longer placeholders — supplied by Dimas on 2026-11-16.)*

---

## 3. Reference analysis (the only design references)

> Dimas provided **seven** references: the website **R0** and six local files **R1–R6** (five screen-recordings and one photo). They were studied on 2026-11-16. Descriptions below are factual observations; "→ Adopt" is what this product takes (as a *pattern*), "→ Avoid" is what it must not copy.

### 3.1 R0 — `https://pacomepertant.com/` (motion & sound designer portfolio)

**Observed behavior**

* **Gate/preloader:** dark screen, blue pill + word "hey" → "I'm Pacôme" → role line, then two buttons **"enter with sound" / "enter without sound"**; the choice unlocks audio. A smiley/orb mascot logo reacts to hover.
* **Navigation:** mascot logo top-left (hover reveals a tag), white **pill "menu •"** top-right opening an overlay (works / about / contact + email + socials), a **round sound toggle** bottom-right, a **rotating circular text badge** ("showreel • 2025 •") bottom-left with a thumbnail, a center switch toggling two *views* of the works (named "spiral" and "list").
* **Home:** full-screen WebGL canvas (console shows an "Experience" class and a "Raycaster" — i.e., a custom scene with pointer picking).
* **About:** centered paragraph whose words **scrub from grey to white as you scroll**, with small **inline 3D "sticker" icons** that pop in between words; below, a horizontal strip of colorful project cards; then very large stacked **social links** and a small credits line.
* **Smooth scroll:** Lenis (`html.lenis`). Framework: Nuxt. Font: *Indivisible* variable via Adobe Fonts (licensed — **do not use**).
* **Tokens (read from CSS custom properties):** `--color-black #0a0a0a`, `--color-white #fafafa`, `--color-pop-green #21ffc0`, bg-grey `#171717`; grid margin 30, gutter 16; radii 4/8/12/16/20/full; gaps 10/15/30/60/90/120/180; easing `ease-spring` (a long `linear()` spring curve), `quad-in-out cubic-bezier(.455,.03,.515,.955)`, `expo-out cubic-bezier(.19,1,.22,1)`.
* **Assets & sound taxonomy (names only):** 12 sticker WebPs; sound files for *ambient, hover, click, longclick, tick, switch, close, spiral, list, menu-home-link, menu-about-link, smiley ×4* — i.e., **one distinct cue per interaction type plus a looping ambient bed**, preloaded via range requests.
* **Background:** faint grid + noise over near-black.

→ **Adopt:** sound-choice gate; one-cue-per-interaction taxonomy + ambient bed; pill menu + round sound toggle; rotating text badge; scroll-scrubbed word reveal with inline stickers; spring easing; Lenis; dark-ink + single pop accent; big stacked social links; view-toggle idea (grid/list/rail for Works, P2).
→ **Avoid:** Indivisible font, its stickers, mascot, sounds, logo, copy, exact layout; a WebGL-only home (we are HTML-first, HR-5).

### 3.2 R1 — `WhatsApp Video 2026-11-16 at 3.45.29 PM.mp4` (portrait 576×1024, 39 s)

Light theme. **Huge condensed uppercase name** stacked on the left, **cut-out portrait** center-right, a glossy yellow-blue **3D ribbon/snake object** floating around the portrait and moving with scroll, small meta list under the name, small pill nav top-right. Later sections: **"Achievements"** (heading + large card with an event photo and a "1ST PLACE" label), **"Skills"**, **"Business"** (heading with a thin gradient underline), a project showcase, and a dark green stats band with large "+" counters.
→ **Adopt:** achievements as a *visual, photo-backed* section; floating 3D accent object around the portrait; stats counters; light "paper" sections interleaved with dark.

### 3.3 R2 — `WhatsApp Video 2026-11-16 at 3.45.30 PM.mp4` (landscape 1024×576, 36.6 s)

Black-on-white. Giant words **"… FULL STACK DEVELOPER …"** scrolling horizontally *behind* a cut-out portrait (person with a cap) with a small corner bio and a "Scroll ↓" cue; floating **pill navbar** (logo, links, dark CTA); a black **ticker band** ("DIGITAL PRODUCT AND BRAND ◆ AVAILABLE FOR 2026"); **"/WORKS"** heading (slash-prefixed) with intro text and a **horizontal slider of numbered cards** (image, title, subtitle, arrows); a dark **"DEFINE / DESIGN / DELIVER"** block (stacked words with greyed lines) next to a photo; small footer link columns.
→ **Adopt:** marquee-behind-portrait hero, availability ticker, slash-prefixed section titles (`/WORKS`), numbered card slider, stacked-words manifesto block (we use it for Dimas's own 3-word credo, §5.8).

### 3.4 R3 — `WhatsApp Video 2026-11-16 at 3.45.31 PM.mp4` (landscape, 76 s — a static hero held for the whole clip)

Light-grey background; a **cut-out portrait in a suit** standing on the bottom edge; behind it, giant **outline-only (stroke, no fill) text** sliding horizontally; a white blurred **floating pill navbar** (logo, links, dark CTA); tiny meta text on the left and vertical text on the right edge.
→ **Adopt:** stroke-only marquee text layered with the portrait; floating blurred pill nav; formal-suit portrait works well on this layout (matches `Dimas.jpg`).

### 3.5 R4 — `WhatsApp Video 2026-11-16 at 3.45.31 PM (1).mp4` (portrait 576×1024, 29 s — a "Portfolio Website" template promo)

Dark hero with an **orange/brown glow** and a greeting-style headline with a gradient-colored role line; sections: image-led intro, **three service cards with the middle one highlighted in the accent color**, a grid of image cards, a **three-tier pricing row** (middle highlighted), and a **contact section with a warm gradient background and a form card** (name/email/message + accent submit button), then footer.
→ **Adopt:** accent-highlighted middle card as the *featured* card pattern (used for the featured achievement/project, not pricing); gradient-glow contact section with a form card.
→ **Avoid:** pricing/services-for-hire framing (no data; HR-2).

### 3.6 R5 — `WhatsApp Video 2026-11-16 at 3.45.32 PM.mp4` (landscape 1024×576, 55 s)

Near-black with a **red radial glow**; small logo top-left; tiny uppercase nav; hero with a **giant name partially hidden behind a suit portrait** and a vertical social-icon rail; a **light rounded "ABOUT ME" card that slides up over the dark page** (card-stack transition) with a job-title list, a **"download CV"** button and a **grid of soft rounded tech-icon tiles**; **"ARCHIVED WORKS"** heading (white + accent italic) with project cards that have gradient-bottom overlays and titles, plus a "load more" button; a **certificate carousel** (focused center card, dimmed/blurred side cards with perspective); footer with a giant **"SOMETHING GREAT."** line, contact columns, a **live clock (HH:MM:SS)** and a **round red back-to-top button**.
→ **Adopt:** card-stack About slide-over, tech-icon tile grid, certificate-style carousel for achievements proof, "archive + load more", giant footer CTA with live clock and round back-to-top.

### 3.7 R6 — `WhatsApp Image 2026-11-16 at 3.45.32 PM.jpeg` (portfolio of an Indonesian marketing/data analyst, shown on a laptop; caption: "Day 1 coba lamar kerja pake website portofolio… Bikin HR auto scroll dan gak ribet pindah-pindah platform")

Dark hero: small nav (**Home · About · Karir · Keahlian · Portofolio · Layanan · Galeri**) with social icons (WhatsApp, LinkedIn, YouTube); left column: eyebrow role line, large name, 2-line pitch, **outlined pill CTA "Hubungi Saya"**; right: cut-out portrait over a blurred office with bokeh lights.
→ **Adopt:** the **goal** (HR scans one site instead of many platforms); the **Indonesian IA** (Karir, Keahlian, Portofolio, Galeri); eyebrow → name → pitch → outlined CTA hero rhythm; WhatsApp as a first-class contact.

### 3.8 Traceability matrix — every major feature → its reference

| Feature (section) | Source reference(s) |
|---|---|
| Sound-choice gate "Enter with sound / without sound" (§5.2) | R0 |
| Interaction-sound taxonomy + ambient bed (§7) | R0 |
| Cut-out portrait hero + giant layered name (§5.3) | R1, R2, R3, R5, R6 |
| Stroke-only (outline) marquee text (§5.3) | R3 |
| Availability ticker band (§5.3) | R2 |
| Floating blurred pill navbar + CTA (§5.1) | R2, R3, R0 (menu pill) |
| Round sound toggle, rotating text badge (§5.1) | R0 |
| Scroll-scrubbed word reveal + inline stickers (§5.4) | R0 |
| Card-stack "About" slide-over + tech-icon tiles (§5.4) | R5 |
| Achievements section, photo-backed card + "1ST PLACE" label (§5.5) | R1 |
| Certificate-style focus carousel for proof (§5.5) | R5 |
| Featured (accent-highlighted) card pattern (§5.5, §5.7) | R4 |
| Numbered horizontal works slider, slash-prefixed titles (§5.7) | R2 |
| Archive + "load more", gradient overlay cards (§5.7) | R5 |
| Stats counters (§5.3) | R1 |
| Stacked-words credo block (§5.8) | R2 |
| Contact glow + form card (§5.10) | R4 |
| Giant footer CTA + live clock + round back-to-top (§5.10) | R5 |
| Large stacked social links (§5.10) | R0 |
| Section set: career (Karir), skills (Keahlian), portfolio (Portofolio), gallery (Galeri) — labels English by default, Indonesian via the toggle (§5) | R6 |
| Dark ink + single accent + interleaved light "paper" sections (§4) | R0, R1, R5 |
| Spring easing, Lenis smooth scroll (§6) | R0 |
| Works view toggle grid/list/rail (P2) | R0 ("spiral"/"list") |

### 3.9 Do-not-copy list

Indivisible font and any R0 stickers/sounds/logo/mascot; any real person's name, photo or copy from R1–R6; the pricing/services framing of R4; layouts reproduced pixel-for-pixel.

### 3.10 Local reference media (not committed)

The five videos and the JPEG live **only** on Dimas's machine at `D:\Download\Kerjaan\Web_Porto\` (git-ignored: they are third-party content and ~16 MB). This section is the authoritative written analysis; the implementer does not need them to build.

---

## 4. Creative direction

### 4.1 Concept — "SYSTEMS ONLINE"

The visitor *boots* Dimas. The story arc of the page mirrors his profile — **builder → leader → winner**:

`BOOT` (gate) → `IDENTITY` (hero) → `WHO` (about) → `PROOF` (achievements = "Achievement Unlocked") → `PATH` (journey) → `BUILD` (works) → `TOOLKIT` (skills) → `CREDO` (Build · Lead · Win) → `MOMENTS` (gallery) → `CONNECT` (contact).

Why this works for *this* person: his record is literally a list of unlocks (nine 2026 placements, four of them 1st places), a game project (RedDoorz Team Run), IoT/embedded work and leadership. The HUD/"system" motif is a natural, non-childish wrapper: mono labels, counters, status dots, a boot log — over **giant condensed typography** and a **cut-out formal portrait** (R1–R3, R5, R6) with a **single electric accent**.

**Mood words:** precise · electric · confident · playful-but-professional · tactile (sound) · cinematic (light).
**Anti-mood:** childish game UI, neon-cyberpunk cliché, template look, clutter.

### 4.2 Color tokens (define as CSS custom properties; Tailwind v4 `@theme` maps to them)

```css
:root {
  /* Ink — dark surfaces */
  --ink-950:#0A0A0B; --ink-900:#101012; --ink-850:#141417; --ink-800:#18181B;
  --ink-700:#232327; --ink-600:#323238; --ink-500:#52525B; --ink-400:#71717A;
  --ink-300:#A1A1AA; --ink-200:#D4D4D8;
  /* Paper — light surfaces (interleaved sections: R1, R3, R5) */
  --paper-50:#FBFAF6; --paper-100:#F3F1EA; --paper-200:#E7E3D8; --paper-300:#D6D1C2;
  /* Accents */
  --volt-300:#E4FF7A; --volt-400:#D4FF3F; --volt-500:#C2EE1F; --volt-700:#7C9A00; /* signature accent */
  --flare-400:#FF6A4D; --flare-500:#FF4F2E;   /* live dot, errors, 3rd-place tint — sparing */
  --signal-400:#7C8CFF;                        /* cool glow for AI/IoT gradients — sparing */
  /* Semantic */
  --bg:var(--ink-950); --fg:#F5F5F2; --muted:var(--ink-300);
  --line:rgb(255 255 255 / .10); --accent:var(--volt-400); --danger:var(--flare-500);
}
```

Rules: accent covers **≤ 8 % of any viewport**; on `paper` surfaces volt is a *fill behind ink text only* (volt text on paper fails contrast); `--ink-400` is for ≥ 24 px / decorative text only (ratio ≈ 4.1:1); body text uses `--fg` / `--muted` (≥ 7:1 on `--bg`). Gradients: `volt → signal` (AI/IoT highlights) and `flare → volt` (achievement bursts) — max 2 gradient uses per viewport.

### 4.3 Typography (all self-hosted via Fontsource, **OFL** licenses)

| Role | Font | Notes |
|---|---|---|
| Display (names, section titles, rank numerals) | **Anton** (`@fontsource/anton`) | uppercase, condensed, heavy — closest free match to the R1/R2/R3/R5 look. Single weight → ~20 KB woff2 (Latin). |
| UI + body | **Geist Variable** (`@fontsource-variable/geist`) | Latin subset, weights 400–700 |
| Labels / HUD / numerals | **Geist Mono Variable** (`@fontsource-variable/geist-mono`) | uppercase labels, counters, clock; `font-variant-numeric: tabular-nums` |

Fluid scale (clamp; no media-query jumps):

| Token | Value | Use |
|---|---|---|
| `--fs-hero` | `clamp(4.25rem, 17.5vw, 19rem)` / lh .86 / ls −.01em | hero name lines |
| `--fs-title` | `clamp(3rem, 9vw, 9rem)` / lh .9 | section titles (`/KARYA`) |
| `--fs-xl` | `clamp(2rem, 5vw, 4.5rem)` / lh 1 | stats, rank numerals |
| `--fs-h3` | `clamp(1.25rem, 2vw, 1.75rem)` / lh 1.2, 600 | card titles |
| `--fs-lead` | `clamp(1.0625rem, 1.2vw, 1.25rem)` / lh 1.55 | lead paragraphs |
| `--fs-body` | `1rem` / lh 1.6 | body |
| `--fs-label` | `.75rem` / lh 1.2, mono, uppercase, ls .08em | HUD labels |

Loading: preload **Anton** and **Geist** only; `font-display: swap`; fallback faces with `size-adjust/ascent-override/descent-override` tuned so swap causes **CLS ≤ 0.01**; total font payload ≤ **90 KB**; Mono loads lazily (`font-display: swap`, not preloaded).

### 4.4 Layout, spacing, shape

* 12-column grid; `--page-margin: clamp(16px, 3vw, 48px)`; `--gutter: clamp(12px, 1.5vw, 24px)`; max content width 1680 px (hero may bleed full-width).
* 4-px spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192. Section vertical rhythm `clamp(96px, 14vw, 224px)`.
* Radii: 8 / 12 / 20 / 28 / full (pill). Borders 1 px `--line`. Elevation is **light-based** (glow/rim), not drop-shadow-heavy.
* **Glass** (`backdrop-filter`) only on the floating navbar (expensive); on `low` tier it becomes an opaque `--ink-850` bar.
* Breakpoints (min-width): 360 · 640 · 768 · 1024 · 1280 · 1536 · 1920. Mandatory test viewports: 360×740, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080, 2560×1440.

### 4.5 Texture & light language

* **Dot grid** (24 px, 6 % white) + **film grain** tile (128×128 PNG ≤ 4 KB, `mix-blend-mode: overlay`, 5–7 % opacity) on dark sections.
* **Glow blobs**: two static radial gradients (volt @ 8 %, signal @ 6 %) behind the hero; the WebGL layer animates the rim light, not the blobs (cheaper).
* **Rim light**: volt-colored edge highlight on the portrait, following the pointer (hero WebGL, §5.3).
* Soft **vignette** on hero bottom to seat the ticker band.

### 4.6 Iconography & stickers

* Icons: single inline **SVG sprite** (≤ 12 KB) of ~40 line icons (24 px grid, 1.75 stroke). Technology tiles use simple monochrome glyphs; **no icon fonts, no external icon CDNs**.
* **Stickers** (R0 pattern, *our own artwork*): 12 glossy volt/ink/flare mini-objects — chip, ESP32-style board, node-graph "brain", trophy, rocket, gamepad (RedDoorz Team Run), people, bolt, code brackets, laptop, mushroom (the IoT project), star. Export WebP 192 px with alpha, **≤ 8 KB each**; created from simple 3D primitives (Blender) or gradient SVG → raster. Until final art exists, ship SVG gradient glyphs flagged `is_placeholder`.

### 4.7 Portrait asset pipeline (`Dimas.jpg` → hero)

**Input:** `design/source/Dimas.jpg` — **1792 × 2400 px** (replaced 2026-11-16; resolves Q-1). Studio portrait: Dimas seated on a high stool, black blazer over a dark-teal tee, black trousers and leather shoes, a watch and a ring; he looks toward camera-left; smooth mid-grey seamless backdrop and a dark floor. The resolution is enough for a 1000–1400 px-tall hero at DPR 2 — **no AI upscaling is needed.** (The file was supplied as `Dimas.png` but is a JPEG; keep the `.jpg` name.)

**What the photo implies for the design**

* **Gaze toward camera-left ⇒ place the portrait on the *right* half of the hero** so he looks *into* the page, toward the name and pitch (same composition logic as R1–R3, R5, R6).
* Dark clothing on a mid-grey backdrop ⇒ the volt rim-light will read very well; matting is straightforward (no colour spill like the old red ID photo).
* Seated full-body pose ⇒ use **three crops** from one source:

| Crop | Framing | Used for |
|---|---|---|
| **hero** | head to mid-thigh, ≈ 4:5; the stool edge may show | hero cut-out (§5.3) |
| **full** | whole figure incl. stool, 3:4 | Credo block (§5.8), 404, OG compositions |
| **editorial** (no cut-out) | original grey backdrop, colour-graded | About card (§5.4) / Contact glow (§5.10) where the grey suits the palette |

**Pipeline** (offline, one-off, scripted in `tools/images/`):

| Step | What | Tooling |
|---|---|---|
| 1. Matte | Cut the figure from the grey backdrop → alpha (hair and blazer edges matter; keep the stool in the **full** variant). | `rembg` with a BiRefNet model (verify that model's license permits commercial use) or manual refinement in Photopea/Photoshop. **Do not use** `@imgly/background-removal` (non-permissive license). |
| 2. Edge decontamination | Light-grey backdrop leaves a pale fringe when the cut-out sits on `#0A0A0B`: shift edge-pixel colours toward the nearest interior colour; 2–3 px feather. | script (sharp/numpy) |
| 3. Colour grade | Modest contrast curve + cool-neutral grade so the teal tee harmonises with ink/volt. **No retouching** of face, skin or body — colour only. | script or manual |
| 4. Depth map | 8-bit grayscale 512×683 for the parallax shader (face/torso nearest, stool/legs farther). | Depth-Anything-V2-Small (Apache-2.0) one-off, or hand-painted gradient |
| 5. Export | `portrait-hero-{480,720,960,1280,1600}.avif` + `.webp` with alpha · `portrait-full-{720,1080}.*` · `portrait-depth-512.webp` · `portrait-editorial-{960,1600}.avif` · LQIP (≤ 400 B) · square crop for OG/JSON-LD. | sharp |
| 6. Acceptance | No grey halo at 200 % zoom on `#0A0A0B` **and** on `#F3F1EA`; hair detail kept; **hero 960 w AVIF ≤ 80 KB**; alt text per §13. | visual check + edge-pixel sampling script |

**Display rule:** hero crop ≈ 88 vh tall on desktop, anchored bottom-right; ≈ 70 vw wide on mobile. Never scale the source in CSS — always use the exported sets.

### 4.8 Brand mark

Monogram **"DP."** — "DP" in Anton + a volt dot that doubles as the *signal indicator* (pulses on audio, turns flare while sound is off). One SVG ≤ 1 KB (inline), favicon SVG with `prefers-color-scheme`, `apple-touch-icon` 180, maskable 192/512 (admin PWA).

### 4.9 Theme policy

Dark by default with **interleaved paper (light) sections** (About card, Journey, certificate/proof area) per R1/R5. No user theme toggle in v1.0 (P2). `color-scheme: dark light` set per section so native controls match.

### 4.10 Tone & voice — formal facts, playful interactions (D-17)

Dimas asked to **combine both**: the *content* is formal and precise; the *interaction layer* is light and witty.

| Zone | Voice | Where |
|---|---|---|
| **Formal** — precise, first person, no slang, no emoji | confident, concrete, understated; numbers as digits; past tense for achievements, present tense for current roles | hero pitch, About, achievements and experience content, education, skills, project case studies, `/cv`, privacy, form validation messages |
| **Playful** — short, HUD/mono voice, subtle humour | dry and brief; never at anyone's expense | gate + boot log, hover labels/tooltips, unlock toasts, copy/send confirmations, loading states, 404, tab title when away, easter egg |

**Rules:** never joke about people, other competitors, results or institutions; never trivialise an achievement; no emoji in factual copy (and ≤ 1 in playful microcopy, optional); every playful line must still be understandable at a glance; microcopy lives in `i18n/{en,id}.json` so Dimas can edit it. Sound follows the same rule: tactile and tasteful, not cartoonish (§7).

| Moment | EN (default) | ID |
|---|---|---|
| Boot log | `> booting dimas.sys …… ok` | `> memuat dimas.sys …… ok` |
| Loader enter | Click to enter / Tap to enter | Klik untuk masuk / Ketuk untuk masuk |
| Achievement unlock toast | Achievement unlocked — 1st Place · FAPERTA FAIR 2026 | Pencapaian terbuka — Juara 1 · FAPERTA FAIR 2026 |
| Email copied | Copied. Go ahead, paste it. | Tersalin. Silakan tempel. |
| Form sent | Message sent. I'll get back to you soon. | Pesan terkirim. Saya akan segera membalas. |
| Form failed | That didn't go through. Try again or email me directly. | Gagal terkirim. Coba lagi atau email saya langsung. |
| 404 | `> route not found …… this page didn't ship.` | `> rute tidak ditemukan …… halaman ini belum dirilis.` |
| Tab title when away | Still here — Dimas Panca Pamungkas | Masih di sini — Dimas Panca Pamungkas |
| Explorer badge | Explorer unlocked — you saw it all. | Penjelajah terbuka — kamu sudah lihat semuanya. |

Do **not** promise response times in microcopy (no data); do not claim anything not in §2.

---

## 5. Information architecture & page specifications

### 5.1 Sitemap

| Route | Purpose | Priority |
|---|---|---|
| `/` (**EN, default**) and `/id/` | Single long page, sections below | P0 |
| `/works/[slug]` · `/id/works/[slug]` | Project case study | P0 |
| `/achievements/[slug]` · `/id/achievements/[slug]` | Shareable achievement detail (own OG image) | P1 |
| `/cv` · `/id/cv` | Print-optimized CV generated from the same data (+ link to uploaded PDF) | P1 |
| `/credits` | Third-party license ledger (fonts, audio, libs) | P0 |
| `/privacy` | Privacy notice (contact form, analytics, localStorage) | P0 |
| `/thanks` · `/id/thanks` | Static, `noindex` confirmation after a no-JS contact post (§11) | P0 |
| `/404` | Playful not-found | P0 |
| `/sitemap-index.xml`, `/robots.txt`, `/manifest.webmanifest` | SEO/PWA metadata | P0 |

Admin lives at a **different origin** (§10), never as a route here.

Section order on `/` (HUD index in brackets; labels are English by default — Indonesian equivalents live in `i18n/id.json`: *Tentang, Pencapaian, Perjalanan, Karya, Keahlian, Galeri, Kontak*): **Gate** → `[01]` Hero (+ ticker) → `[02]` About (+ stats) → `[03]` Achievements → `[04]` Journey → `[05]` Works → `[06]` Skills (+ Credo interstitial) → `[07]` Gallery / Moments → `[08]` Contact (+ footer).

### 5.2 Global UI

#### FR-GATE — loading screen (P0) · R0 (revised v1.4, reference: basement.studio loader)

| Aspect | Spec |
|---|---|
| Presence | Full-screen overlay (`role="dialog"`, `aria-modal`), shown **once per session** on the home page only. Page content underneath is in the DOM but `inert` until entry (crawlers still read it). |
| Loading (silent) | Runs immediately, no choice: hand-drawn line loops (2D canvas, 7–10 curves) trace themselves in; the wordmark **"DIMAS."** (Anton) fills letter by letter from an outline; a mono status line cycles through the data-derived boot log (`booting dimas.sys — ok` … `mounting achievements — {N} found` …); a big `000–100 %` counter + hairline bar. Progress follows real readiness (fonts + hero portrait), floor 2.6 s, cap 7 s. Desktop: a crosshair with coordinates follows the pointer. |
| Ready | At 100 % the wordmark turns volt, a soft "ready" bell plays (if audio is unlocked) and a single pill **"Click to enter" / "Tap to enter"** (ID: *Klik / Ketuk untuk masuk*) appears with "Sound on — mute it anytime from the top bar". Clicking anywhere on the screen enters. |
| Sound | Browsers block audio before a gesture, so loading is silent unless the visitor taps during it — that tap unlocks audio and the remaining letters tick (`load_start`, `load_tick` ×letter, `load_ready`). Entering is the gesture that turns sound on and plays `boot_stinger` timed to the curtain. An explicit mute from the nav toggle (`dp:audio`) is respected. |
| Skip | `Esc` enters at any time; wheel / touch-move enter once loading is done (silently, as they are not audio gestures). `?intro=0` (or legacy `?mute=1`) skips the screen. |
| Exit | Content "charges" (letters flash volt, loops whirl outwards), then two curtains lift — ink panel first, volt band 140 ms later (1 s, `cubic-bezier(.76,0,.24,1)`). The hero intro is delayed to rise as the curtain uncovers it; `data-gate` goes `open → closing → done`. |
| Fallbacks | No-JS: never rendered. Static tier / reduced motion: no canvas or crosshair, short fade. |
| AC | Enter in **1 action**; never longer than 7 s before the enter control; no CLS; no horizontal overflow at 320 px. |

#### FR-NAV — floating pill navbar (P0) · R2, R3, R0

* Desktop: blurred pill centered at top: monogram · links (**About, Achievements, Journey, Works, Skills, Contact**) · language toggle `EN | ID` · **sound toggle** (round, with a 3-bar level visualizer fed by the audio analyser) · **CTA "Download CV"** (dark pill, volt hover).
* Active-section indicator: underline that slides with spring easing. Hides on scroll-down, reveals on scroll-up.
* Mobile (< 768): pill with "Menu •" → fullscreen overlay (R0): large links, email, socials, language + sound toggles; **focus trap**, `Esc` closes, scroll lock; the sound toggle is also a persistent **round FAB bottom-right** (R0).
* **Scroll progress** bar (2 px, volt) top edge; **section HUD** vertical on the left edge (desktop): `03 / 08` + section name.
* **Rotating text badge** bottom-left (R0), ≥ 1024 px: circular text "`OPEN TO OPPORTUNITIES • 2027 •`" ([PLACEHOLDER: from `site_settings.availability`]) around the monogram; click → scroll to Contact.
* Sound: `hover_tick`, `nav_link`, `menu_open/close`, `toggle_on/off`.

#### FR-CURSOR — custom cursor (P1, desktop `pointer: fine` only)

Dot 8 px + ring 36 px (lerp 0.18, `mix-blend-mode: difference`). States: default · link (ring 64 px) · **view** (label "VIEW" on cards) · **drag** (label "DRAG" on the rail) · press (scale .9). Never replaces the native cursor in text inputs; disabled under reduced-motion and on touch. Implemented with a single `rAF`-driven `quickTo`, no layout reads.

#### FR-HUD — explorer progress (P1)

Tiny HUD (bottom-left, above the badge on desktop): `EXPLORED 3/8`. Visiting all sections unlocks a one-time "Explorer" toast with the `unlock` cue. State in `localStorage`. Purely delight; must cost ≤ 1 KB JS.

### 5.3 `[01]` Hero (P0) · R1, R2, R3, R5, R6

**Layers (z-order, back → front):** dot-grid/grain/glow → **stroke-only marquee text** (R3) → **solid giant name** → **portrait** (WebGL canvas over an `<img>` fallback) → foreground UI (eyebrow, pitch, CTAs, stats, ticker).

| Element | Spec |
|---|---|
| Eyebrow (mono) | `INFORMATICS ENGINEERING · UNTIRTA · SERANG, BANTEN` (from education/location) |
| Name | Three stacked lines **DIMAS / PANCA / PAMUNGKAS** in Anton `--fs-hero`; line 1 solid `--fg`, line 2 **stroke-only** (1.5 px `--fg`, transparent fill), line 3 solid; the portrait overlaps the right ends of lines 2–3 (R5/R1). SplitText: letters rise from `y:110%` with 0.04 s stagger, `power4.out`, 0.9 s. |
| Pitch | EN: *"I build software, AI & IoT — and lead the teams that ship them."* ID: *"Saya membangun software, AI & IoT — dan memimpin tim yang merilisnya."* (draft, `needs_review`) |
| CTAs | Primary **"See achievements"** (volt fill) · secondary **"Contact me"** (outlined pill, R6) · tertiary text link **"Download CV"** |
| Stats strip | Four counters **derived from data, never hard-coded**: GPA `3.89/4.00` · `{n}` achievements (2026) · `{n}`× 1st place · `{n}` roles. Count-up 1.2 s `expo.out`, final values present in HTML (no-JS), `tabular-nums`. |
| Marquee | Stroke text behind portrait: `SOFTWARE ENGINEERING ◆ AI & RAG ◆ IoT & ESP32 ◆ PROJECT MANAGEMENT ◆ STUDENT LEADER ◆`; base speed 40 px/s, **scroll-velocity coupled** (speeds up + skews ≤ 6° on fast scroll, eases back). CSS-animated; velocity only adjusts `animation-duration`/transform via one tween. |
| Ticker band (R2) | Bottom edge, ink band, volt text, two **data-derived** items alternating: (1) `1ST PLACE ◆ INTERNATIONAL FAPERTA FAIR 2026 ◆ CHIANG MAI UNIVERSITY, THAILAND` — generated from the highest-ranked international achievement (rank label + short title + `location`); (2) `{availability}` ([PLACEHOLDER: availability]). |
| Portrait (WebGL, tier ≥ mid) | **Placement:** hero crop (§4.7), anchored bottom-right, ≈ 88 vh tall on desktop, looking *into* the page (gaze toward camera-left), bottom edge seated on the ticker band. One OGL plane with the cut-out + depth map: (a) **volt rim-light** following the pointer (lerp .08), (b) **depth parallax** ≤ 12 px at 1440 w, (c) animated **grain** at 12 fps, (d) **RGB split** ∝ scroll velocity (cap 2 px), (e) idle "breathing" scale ±0.3 %. Fade-in over the `<img>` only after the first rendered frame; `<img>` (the LCP element, `fetchpriority="high"`) is then `visibility:hidden`. |
| Pointer ink trail (tier = high, P1) | 128² ping-pong FBO that subtly distorts glow/grain near the cursor. Off on mid/low. |
| Floating stickers (P1) | 3–4 stickers drifting around the portrait with `data-speed` parallax (R1 floating-object pattern). |
| Mobile | Name lines at top, portrait below (hero crop, ≈ 70 vw), pitch + CTAs under it, stats 2×2, ticker at the bottom; WebGL only on `high` tier, otherwise CSS parallax from `deviceorientation` is **not** used (kept static). |
| Sound | `boot_stinger` (at gate), `hover_tick` on CTAs, `click_soft`. |
| AC | LCP element is the portrait `<img>`; LCP ≤ 2.0 s (mobile, throttled); the page is fully legible with WebGL off; no layout shift when the canvas mounts. |

### 5.4 `[02]` About (P0) · R0, R5

**A. Statement (scroll-scrubbed words, R0).** Centered paragraph; every word goes `--ink-500 → --fg` scrubbed to scroll (`scrub: 0.6`); **inline stickers** pop in at marked words with spring easing (+ tiny `hover_tick`). Draft copy (first-person, flagged `needs_review`):

* EN: *"I'm Dimas, an Informatics student from Serang who builds software, AI and IoT systems — and leads the teams around them. I'm the President of HMIF at UNTIRTA, I managed a multiplayer game delivered inside RedDoorz, and I keep turning ideas into things that win."*
* ID: *"Saya Dimas, mahasiswa Informatika dari Serang yang membangun software, AI, dan sistem IoT — sekaligus memimpin tim di sekitarnya. Saya Ketua HMIF FT UNTIRTA, memimpin proyek game multiplayer yang dipakai internal RedDoorz, dan terus mengubah ide menjadi karya yang menang."*

Sticker anchors: chip → "software, AI, IoT", gamepad → "multiplayer", people → "tim/teams", trophy → "menang/win".
No-JS: all words at full opacity.

**B. "About me" card-stack (R5).** A **paper** card (`--paper-100`, radius 28) slides up over the dark page (pinned 100 vh scrub, ≤ 0.8 s) with: facts list (Education + GPA, Location, Focus: *Software Eng · IoT · AI*, Now: *President HMIF · PM RedDoorz*), **"Download CV"** button (ink pill), and the **tech tile grid** (soft rounded tiles with monochrome glyphs, R5) built from `skills` (placeholder tile "Stack [PLACEHOLDER]"). Tile hover: lift 4 px + `hover_tick`.

**C. Stats** (if not already in hero on mobile): same counters.

AC: scrub is smooth at 60 fps on mid-range laptop; reduced-motion = static paragraph, card without pin.

### 5.5 `[03]` Achievements (P0) — *the showpiece* · R1, R5, R4

| Element | Spec |
|---|---|
| Header | `03 / ACHIEVEMENTS` mono label · huge title · live counter **"{unlocked}/{total} UNLOCKED"** · filter chips **All · Essay · Business · Hackathon · AI/ML** (P1; derived from `category`). |
| Layout ≥ 1024 px, fine pointer, motion OK | **Pinned horizontal rail** (GSAP ScrollTrigger, `scrub: 0.6`, snap to card centers) showing the **featured** achievements (default: the first 6 by sort order — §2.5). **Pin length ≤ 3× viewport height** so recruiters are never trapped in a long pin. Each card 420×540 at 1440 w. |
| Layout otherwise | Native `scroll-snap-x` carousel (touch) or vertical stack (reduced-motion). No JS required for the stack fallback. |
| Card | Big rank numeral in Anton (`1ST`, `2ND`, `3RD`, `TOP 4`, `TOP 10`) · event title (h3) · **type chip** (e.g. *Essay Competition*) · organizer · **Mon YYYY** · **location** (when set, e.g. *Chiang Mai, Thailand*) · scope chip · 2–3-line summary · expandable highlights · **"View proof ↗"** only when `proofs[]` is non-empty · cover image if provided else generated pattern art (SVG concentric rings + rank). **Podium tints:** tier 1 = volt, tier 2 = `--ink-200` ring, tier 3 = `--flare-400` tint. |
| Featured | `rank_tier = 1` cards use the **accent-highlighted middle-card pattern** (R4): volt border + soft glow + `unlock_gold`; tiers 2–3 use `unlock`. |
| Unlock moment | When a card crosses 60 % of the viewport width in the rail: ring-burst (CSS, 400 ms) + **`unlock`** cue (or `unlock_gold` for tier 1) + counter increments with a tick. Once per card per session. |
| Hover/focus | Tilt ±6° (pointer only) with glare highlight; focus ring 2 px volt. Click/Enter → `/achievements/[slug]` (view-transition morph) or dialog if JS-only. |
| Keyboard | `←/→` move between cards; `Tab` reaches links; rail has `role="region"` + `aria-label`; live-region announces "Achievement {i} of {n}". |
| Data | Published `achievements` in the default order (§2.5) unless overridden by `sort_order`; the rail uses `featured = true` items. New items appear automatically after publish. |
| Archive | Directly after the rail: **"All achievements"** — a filterable grid/list (chips by category, "Load more"; mobile shows the same list vertically) containing **every** published achievement, so nothing is hidden when there are more than 6. Archive cards have hover/focus tilt but **no unlock sound** (only rail cards unlock). |
| Proofs | Dimas adds proofs **later** (certificate image, photo, PDF or external link — e.g. Drive). Until then the card simply omits "View proof ↗"; the admin dashboard lists achievements with **missing proof** (non-blocking). On the detail page, certificate images render in the certificate-style carousel and links as buttons. |
| Detail page (P1) | Hero with rank numeral, meta grid (organizer, date, **location**, scope, category), **linked project card** (e.g. the oyster-mushroom system → `/works/edge-ai-oyster-mushroom`), description + highlights, proof image/PDF link, **certificate-style carousel** of proof images (center focused, sides dimmed/perspective — R5) when media exists, "Next achievement" link. |
| AC | All **9** seeded achievements render with correct ranks/labels/months; the rail shows the 6 featured, the archive shows all 9; rail works with keyboard; zero CLS; unlock fires once per rail card; reduced-motion shows a static vertical stack. |

### 5.6 `[04]` Journey (P0) · R6 ("Karir")

* **Vertical timeline**: sticky year label (Anton) on the left (desktop), center line drawn by an SVG path scrubbed to scroll; nodes pulse (volt) when active; **"NOW"** marker on current roles.
* **Filter tabs:** All · Work · Organization · Education · **Achievements**. Achievements appear as compact **milestone markers** on the same timeline (from `achieved_on`, month precision), clustered per month (e.g. "Oct 2026 · 2 wins") to avoid clutter; a marker links to its card in §5.5.
* **Card** (paper or ink alternating): organization, role, period, location, 2–3 *featured* bullets + `<details>` "Show all" for the rest (accessible expander).
* **Spotlight:** HMIF President card uses the accent-highlight pattern + live dot ("Currently").
* Education card last: UNTIRTA · program · period · **GPA 3.89/4.00**.
* Order: by `start` / `achieved_on` desc (experiences, education and achievement milestones interleaved). Data from `experiences` + `education` + `achievements`.
* Sound: `hover_tick` on cards, `section_enter` once.
* AC: content order identical with JS off; `details` works without JS.

### 5.7 `[05]` Works (P0) · R2, R5

* Slash-prefixed title **`/WORKS`**, intro line, arrows + `01/05` counter (R2).
* **Numbered horizontal slider** (native scroll-snap + arrow buttons; GSAP only for the number/parallax polish). Cards: cover, title, role, year, stack chips, short description, "View case study" CTA; the **featured** cards (RedDoorz Team Run, and the Edge-AI mushroom system with a "1ST PLACE · FAPERTA FAIR 2026" award chip pulled from its linked achievement) use the accent pattern (R4).
* Hover (pointer): image scale 1.04 + clip-reveal of the CTA, cursor label "VIEW", `hover_tick`; click → `/works/[slug]` with **native cross-document view transition** (shared `view-transition-name`).
* **Placeholders** show a "COMING SOON" ribbon, no fake links, and a generated cover (§4.6). They are counted in admin.
* If > 6 projects: **archive grid + "Load more"** (R5).
* **Detail page**: cover hero, meta grid (role, year, team size *[only if known]*, stack, links), *Context → Approach → Outcome* (markdown from admin), media gallery, "Next project". For `reddoorz-team-run`: use only CV facts (PM role; planning, sprints, QA/UAT, delivered for internal RedDoorz use). **No invented metrics.** For `edge-ai-oyster-mushroom` use only confirmed facts: a proposal for a fully automated, near-zero-waste oyster-mushroom cultivation system with Edge AI + IoT; Dimas designed the architecture, wiring and hardware selection; it won 1st place at FAPERTA FAIR 2026 (Chiang Mai University, Thailand). **No invented technical details** (sensors, models, accuracy).
* View toggle **grid / list / rail** (R0 "spiral/list" idea) — P2.

### 5.8 `[06]` Skills + Credo (P0/P1) · R5, R2

* **Tile groups** (R5): *AI & Data* (AI-powered solutions, prompt engineering, RAG) · *Web & Backend* (full-stack web apps, database design, REST API integration) · *IoT & Embedded* (IoT systems, ESP32) · *Tools & Design* (Git, Figma) · **Languages & frameworks** (Next.js · PHP · Laravel · Python · C++ · JavaScript — provided by Dimas) · *Leadership* (soft skills).
* **Two marquee rows** (opposite directions) of skill chips, velocity-coupled, pause on hover/focus; a static list exists for AT users (`aria-hidden` on the marquee).
* **Credo interstitial (R2):** dark block with stacked words **BUILD / LEAD / WIN** (greyed, the active word highlights as you scroll) + one sentence + the **full** portrait crop (seated figure, §4.7) as the visual anchor. (Words derived from CV: builds software/AI/IoT; leads HMIF & projects; wins competitions.)
* No proficiency bars/percentages (HR-2).

### 5.9 `[07]` Gallery / Moments (P1) · R6 ("Galeri")

Albums (e.g. *Chiang Mai 2026*) of event & team photos from `gallery_items`: masonry/auto-marquee, AVIF, lazy, blurhash LQIP, filter chips per album (P1). Click → accessible lightbox (focus trap, arrow keys, `Esc`, swipe). A photo can also be attached to an achievement (`achievement_id` / `gallery_media_ids`) and then appears on that achievement's detail page. **v1.0 ships 6 placeholder tiles** (gradient + caption "[PLACEHOLDER]") **and a ready-to-use admin Gallery screen for Dimas's later uploads** (bulk multi-select upload, drag-reorder, album, caption, **required alt text**, link to an achievement). Placeholder tiles only render to fill up to 6 slots and disappear as real photos are published.

### 5.10 `[08]` Contact + Footer (P0) · R4, R5, R0

* **Glow background** (warm→volt gradient) + **form card** (R4): name, email, message, honeypot, Turnstile (invisible/managed). Optional "Topic" select (Internship / Collaboration / Competition / Other).
* **Giant headline** (R5 pattern, own words): EN *"LET'S BUILD SOMETHING THAT MATTERS."* (default) · ID *"AYO BIKIN SESUATU YANG BERDAMPAK."* Letters respond to cursor proximity (≤ 24 letters, `quickTo`).
* **Direct channels** as **very large stacked links** (R0): email (click = copy + toast + `copy_ok`), **WhatsApp** (`wa.me/<number>` — **shown**, per D-6; rendered only when `site_settings.contact.whatsappNumber` is set), **Instagram** (`@dimas_pancapamungkas`), LinkedIn, GitHub.
* **Live clock** `SERANG · WIB HH:MM:SS` (Asia/Jakarta, `Intl.DateTimeFormat`, 1 s tick, paused when tab hidden) (R5) and a **round back-to-top** button (R5) with `click_soft`.
* **Footer:** sticky-reveal; `© 2026 Dimas Panca Pamungkas`; links: Credits · Privacy · Lite-mode toggle · language · sound. **No AI/tooling credit** (HR-1).
* Sound: `copy_ok`, `send_ok`, `error`.
* Form behavior in §11.

### 5.11 Other pages

* **FR-CV (P1)** `/cv`: single-column, print stylesheet (A4, ink on white, ≤ 2 pages), generated from published data; buttons "Print / Save as PDF" and "Download official PDF" (uploaded file). Always in sync with admin data.
* **FR-404 (P0):** boot-log style: `> route not found … ` with a link home and one tiny playful interaction (the monogram dot bounces; `error` cue only if sound on).
* **FR-LEGAL (P0):** `/privacy` + `/credits` (reads `tools/audio/LEDGER.json` + font/library licenses).
* **Konami / 5-click logo easter egg (P2):** "GOD MODE" — palette inversion for 6 s + `unlock_gold`.

### 5.12 Responsive & states checklist (applies to every section)

Loading (skeleton uses the final layout dimensions — no CLS) · empty (hide section header *and* nav link if a collection has 0 published items, except placeholders policy) · error (content fetch failure at build ⇒ build fails; runtime has none) · offline (static; contact form shows retry message) · focus-visible on every interactive element · tap targets ≥ 44×44 px · text zoom 200 % without loss.

---

## 6. Motion system

### 6.1 Tokens

```css
:root {
  --dur-instant:100ms; --dur-fast:180ms; --dur-base:320ms;
  --dur-slow:600ms; --dur-slower:900ms; --dur-hero:1400ms;
  --ease-out-expo:cubic-bezier(.16,1,.3,1);
  --ease-in-out:cubic-bezier(.45,0,.55,1);
  /* Spring: ~4% overshoot, settles ≤ 600 ms. Tune by eye with a linear() generator; this is a starting curve. */
  --ease-spring:linear(0,.009,.035 2.1%,.141 4.4%,.723 12.5%,.9 15.3%,1.003 21.3%,1.037 26%,1.025 31%,1.004 38%,.998 50%,1);
}
```
GSAP mapping: `--ease-out-expo` ≈ `expo.out`; `--ease-in-out` ≈ `power2.inOut`; spring via `CustomEase` (free in the current GSAP license) built from the same samples. **Never animate layout properties**; only `transform`, `opacity`, `clip-path`, and (sparingly) `filter` on small elements.

### 6.2 Engine rules

1. **One clock.** `gsap.ticker` drives **Lenis**, **ScrollTrigger** and the **OGL render loop**; `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`.
2. **Lenis** only on `pointer: fine` + motion-OK; native scrolling on touch. `autoRaf: false`.
3. **Pin budget:** at most **one** pinned section at a time (Achievements rail; About card is a short scrub pin).
4. **Parallax budget:** ≤ 8 parallax elements in the viewport (`data-speed`, ±0.1–0.3).
5. **Visibility gating:** `IntersectionObserver` pauses marquees (`animation-play-state`), WebGL, clocks and counters when off-screen or tab hidden.
6. **Batching:** read layout once per frame max; no `getBoundingClientRect` inside tick handlers (cache on resize via `ResizeObserver`).
7. **GSAP import hygiene:** import only `gsap`, `ScrollTrigger`, `SplitText` (and `CustomEase` if used) — dynamic-import per section island.

### 6.3 Timeline catalogue

| ID | Trigger | Choreography | Duration / ease | Sound | Reduced-motion |
|---|---|---|---|---|---|
| T-GATE-IN | load | log lines type (30 ms/char), counter ramps with readiness, monogram morph, buttons stagger in | ≤ 1.2 s, `expo.out` | — | instant |
| T-GATE-OUT | choice | circle clip-path from button | .8 s `--ease-out-expo` | `boot_stinger` | 200 ms fade |
| T-HERO-INTRO | gate exit (40 % overlap) | name letters rise (stagger .04), portrait fade/scale 1.06→1 + canvas mount, pitch/CTAs stagger, ticker slides up, stats count | 1.4 s total | — | fade only |
| T-HERO-IDLE | always (visible) | rim light follows pointer, breathing, grain, marquee | continuous | — | off |
| T-HERO-SCROLL | scroll | marquee velocity coupling, name parallax −8 %, portrait −4 % | scrub | — | off |
| T-ABOUT-SCRUB | enter | words grey→white; stickers spring-in | `scrub .6` | `hover_tick` per sticker (throttled) | static |
| T-ABOUT-CARD | enter | paper card slides over (pin 100 vh) | scrub, ≤ .8 s | `section_enter` | no pin |
| T-ACH-RAIL | scroll | horizontal translate with snap; progress bar | scrub .6 | `rail_tick` per snap | vertical stack |
| T-ACH-UNLOCK | card ≥ 60 % | ring burst, counter +1, badge pop (spring) | .4–.9 s | `unlock` / `unlock_gold` | instant state |
| T-JOURNEY-LINE | scroll | SVG path draw, node pulse, cards slide 24 px | scrub 1 | `section_enter` | static |
| T-WORKS-HOVER | pointer | image scale, CTA clip reveal, cursor label | .35 s | `hover_tick` | none |
| T-WORKS-DETAIL | navigate | native view transition (shared card→hero) | ≤ .35 s | `card_open` | none |
| T-SKILLS-MARQUEE | always (visible) | two rows, velocity coupled | continuous | — | static list |
| T-CREDO | scroll | greyed words, active word highlights | scrub | `section_enter` | static |
| T-CONTACT-HEADLINE | pointer | letters displace ≤ 8 px by proximity | quickTo .4 s | — | static |
| T-FOOTER-REVEAL | scroll end | footer uncovered under content | scrub | — | static |
| T-NAV-HIDE | scroll dir | translateY(-120 %) | .35 s | — | none |
| T-BTT | click | smooth scroll to top (Lenis) | 1.2 s `expo.inOut` | `click_soft` | instant |

### 6.4 Page transitions

Prefer **native cross-document View Transitions** (`@view-transition { navigation: auto }` + `view-transition-name` per card/hero) — **zero JS**, progressive (no-op where unsupported). Only adopt a client router (Astro's) if native transitions prove insufficient; verify the current API in the Astro 7 docs first. Cap any transition at 350 ms.

### 6.5 Reduced motion & user control

`@media (prefers-reduced-motion: reduce)`: disable Lenis, WebGL, marquees, scrubs, parallax, cursor, count-up (show final numbers), pinned rails (→ vertical), confetti/burst; keep **opacity fades ≤ 200 ms** and focus states. A footer **"Lite mode"** switch (ID: *Mode hemat*) forces `static` tier regardless of device (persisted).

---

## 7. Sound system

### 7.1 Principles

1. **Consent first** (HR-6): nothing plays before a gesture; entering from the loading screen (or tapping during it) is that gesture.
2. **Subtle, tactile, cohesive:** short transient blips + one ambient bed; everything tonal is tuned to the bed's key (**D**). Noise-like cues (clicks, whooshes) are key-agnostic.
3. **Never fatiguing:** round-robin variants, ±4 % pitch jitter, hover throttle, polyphony ≤ 6, SFX master ≈ −12 dB under peak.
4. **Meaningful:** each cue maps to an interaction type (R0's taxonomy): hover, click, toggle, menu, section, unlock, copy, send, error.
5. **Light:** sprite ≤ 120 KB, ambient ≤ 450 KB, both lazy; engine is a separate lazy chunk.

### 7.2 Flow & state machine

```
locked ──(gate: with sound)──▶ on ──(toggle)──▶ off
   │                            ▲                 │
   └──(gate: without sound)────▶ off ◀────────────┘
on ──(tab hidden / pagehide)──▶ suspended ──(visible)──▶ on
```
* Preference key `dp:audio` = `{"v":1,"enabled":true|false,"remember":true|false}` in `localStorage` (try/catch; works without it).
* Defaults: master 1.0 · SFX 0.6 · ambient 0.22 · ambient fade-in 2.5 s · fade-out 0.6 s on mute · **duck ambient −4 dB for 600 ms** whenever `unlock*`/`boot_stinger` plays.
* **Scroll-reactive ambient:** a Web Audio low-pass on the bed; cutoff maps scroll velocity 0→max to 900→6000 Hz (smoothed) — the page *breathes* with the user.
* iOS: use Web Audio unlock on the first gesture; note the hardware silent switch can mute Web Audio — show a one-line hint under the toggle on iOS only.
* Prefetch: after first paint and only if `!saveData` and `effectiveType` is 4g-ish, fetch the **sprite** at `idle`/low priority; the **ambient** is fetched only after "with sound".

### 7.3 Cue map

| Cue ID | Trigger | Character | Length | Gain | Variants |
|---|---|---|---|---|---|
| `boot_stinger` | gate → with sound | rising synth swell + soft impact ("power-up"), ends on D | ≤ 2.4 s | .70 | 1 |
| `gate_hover` | gate buttons hover | tiny tick | ≤ 60 ms | .35 | 2 |
| `hover_tick` | links/cards/chips hover | ultra-short soft tick | 30–60 ms | .35 | 3 (+ rate ±4 %, throttle 70 ms) |
| `click_soft` | buttons press | muted click | 60–120 ms | .55 | 2 |
| `nav_link` | nav click | tick + air | ≤ 150 ms | .50 | 1 |
| `toggle_on` / `toggle_off` | sound/lang/lite toggles | two-tone up / down | ≤ 140 ms | .55 | 1 each |
| `menu_open` / `menu_close` | mobile overlay | whoosh + tick | ≤ 300 ms | .50 | 1 each |
| `section_enter` | section crosses 50 % (once/session/section) | very soft airy swell | 400–600 ms | .25 | 2 |
| `rail_tick` | rail snaps to a card | soft detent | ≤ 40 ms | .35 | 2 |
| `unlock` | achievement unlock | bright 2–3-note chime + sparkle (in key D) | .8–1.1 s | .65 | 2 |
| `unlock_gold` | tier-1 unlock | `unlock` + short fanfare/shimmer | ≤ 1.4 s | .70 | 1 |
| `card_open` | open detail | swoosh | ≤ 200 ms | .45 | 1 |
| `copy_ok` | email copied | soft pop + ping | ≤ 180 ms | .55 | 1 |
| `send_ok` | message sent | rising 3-note | ≤ 600 ms | .60 | 1 |
| `error` | validation/send error | low, dull thud | ≤ 200 ms | .50 | 1 |
| `ambient_loop` | after gate (with sound) | dark ambient/electronic pad, subtle pulse, **seamless loop** | 60–90 s | .22 | 1 |
| `easter_egg` | konami / 5-click logo (P2) | glitchy rise + chime | ≤ 1.2 s | .65 | 1 |

### 7.4 Where to get the sounds ("ambil dari internet")

Approved sources, in order of preference (record **every** pick in the ledger, §7.5):

| Source | License (verified by search on 2026-11-16 — **re-verify on the download page**) | Use for | Notes |
|---|---|---|---|
| **Kenney — Interface Sounds** (`kenney.nl/assets/interface-sounds`, ~100 files) and **UI Audio** (`kenney.nl/assets/ui-audio`, ~50 files) | **CC0** (public domain; credit optional) | clicks, ticks, toggles, switches, confirm/back, errors | Safest primary source; no login |
| **Pixabay** Sound Effects / Music (`pixabay.com/sound-effects`, `/music`) | **Pixabay Content License**: free for commercial use, no attribution required; *do not redistribute the standalone file* | whooshes, risers, impacts, stingers, sparkle/chimes, ambient pads | Ship only the **processed sprite**, never the raw downloaded file; keep source URL in the ledger |
| **Freesound** (`freesound.org`) — filter **License = Creative Commons 0** only | CC0 | synth stingers, sparkle, risers | Download requires a free account (Dimas's or the implementer's) |
| **OpenGameArt** — filter CC0 | CC0 | fillers | |
| **Mixkit** (`mixkit.co/free-sound-effects`) | Mixkit license (read it at download time) | secondary fallback | Only if the license page confirms commercial/no-attribution use |

**Forbidden:** NC / ND / SA licenses, "free for personal use", unknown/unstated licenses, ripped game/film/YouTube audio, and *anything from R0*. CC-BY is allowed only if attribution is added to `/credits` (prefer avoiding).

**Search recipes** (examples): `ui tick soft`, `ui click muted`, `toggle switch on off`, `whoosh short air`, `riser synth short`, `power up boot sci-fi`, `sparkle chime short`, `achievement unlock chime`, `pop ping`, `soft thud error`, `ambient pad dark loop`, `ambient electronic pulse loop seamless`. Audition 2–3 candidates per cue; choose by cohesion, not by individual coolness.

**Fallback rule (no cue may block release):** if a suitable licensed file cannot be found, implement that cue **procedurally with Web Audio** (oscillator + envelope, ≤ 30 lines each), e.g. `hover_tick` = triangle 1.2 kHz, 25 ms exponential decay; `toggle_on` = two sine blips D5→A5, 60 ms each. Procedural cues cost 0 KB of download.

### 7.5 Processing pipeline & license ledger (`tools/audio/`)

1. Download to a **git-ignored** `tools/audio/raw/`. 2. Trim silence, mono, 48 kHz, high-pass 40 Hz, peak-normalize to **−3 dBTP**, per-cue gain from §7.3. 3. Build **one sprite** (`sfx.sprite.{webm|ogg|m4a}` + `sfx.sprite.json` with `{id: [offsetMs, durMs]}`), Opus ≈ 48–64 kbps, **AAC/M4A fallback for Safari**; ambient encoded separately (Opus 64–80 kbps, seamless loop verified with crossfade ≤ 30 ms). 4. Write `tools/audio/LEDGER.json`:

```json
{ "id":"hover_tick_1", "title":"…", "author":"…", "url":"https://…", "license":"CC0-1.0",
  "retrievedAt":"2026-11-16", "edits":"trim, normalize -3 dBTP, pitch +2 st" }
```
5. `/credits` renders the ledger; CI fails if a sprite cue has no ledger entry, or a license is not in the allow-list (`CC0-1.0`, `Pixabay-Content-License`, `Mixkit-License`, `CC-BY-4.0` with credit). Example `ffmpeg` commands: Appendix D.

### 7.6 Engine architecture (`apps/web/src/lib/audio/`)

* `engine.ts` — **lazy chunk** loaded only after "with sound" (or when the user toggles sound on later). Wraps **Howler.js** (sprite playback, unlock handling) and taps `Howler.ctx` for the **low-pass filter** + **AnalyserNode** (nav visualizer).
* `cues.ts` — registry `id → { sprite, gain, variants, rateJitter, throttleMs }`.
* `bind.ts` — a **single delegated listener** on `document` wires `data-sound="hover|click|nav|toggle"` attributes (no per-element listeners). Pointer-hover cues are ignored on touch.
* `prefs.ts` — read/write `dp:audio` safely.
* Public API: `init(prefs)`, `play(id, opts?)`, `setEnabled(bool)`, `duck(db, ms)`, `setScrollVelocity(v)`, `getLevel()`.
* Rules: polyphony ≤ 6; hover throttle 70 ms; pause on `document.hidden`; fade on `pagehide`; all failures swallowed (audio must never break the page).
* The nav sound toggle and visualizer render from static HTML (bars at rest) and become live when the engine loads.

---

## 8. Performance architecture ("light even though it is loud")

### 8.1 Strategy — layered progressive enhancement

| Layer | What | Loads | Needed for content? |
|---|---|---|---|
| **L0** | Static HTML + CSS (all content, nav, forms, no-JS fallbacks) | immediately | **Yes — this is the site** |
| **L1** | Core JS: gate, nav, reveal fallbacks, counters, quality detection | `type=module`, deferred | No |
| **L2** | Motion: GSAP (+ScrollTrigger, SplitText), Lenis | `import()` at `requestIdleCallback` after LCP | No |
| **L3** | WebGL hero (OGL) | `import()` only when tier ≥ mid **and** hero visible | No |
| **L4** | Audio engine (Howler) + sprite + ambient | `import()` only after "with sound" | No |

**The public site uses no UI framework** (no React/Vue hydration). Astro renders HTML; per-section "enhancer" modules (plain TypeScript) attach behavior. This is the single biggest reason the page can stay light while being visually dense.

### 8.2 Budgets — hard gates (enforced in CI, §8.6)

| ID | Budget | Limit (compressed) |
|---|---|---|
| NFR-PERF-01 | Initial HTML | ≤ 35 KB (br) |
| NFR-PERF-02 | CSS (critical inline ≤ 14 KB; total) | ≤ 30 KB (br) |
| NFR-PERF-03 | **L1** JS before first interaction | ≤ 28 KB (gz) |
| NFR-PERF-04 | **L2** motion chunk (GSAP core + ScrollTrigger + SplitText + Lenis) | ≤ 80 KB (gz) |
| NFR-PERF-05 | **L3** WebGL chunk (OGL subset + shaders) | ≤ 35 KB (gz) |
| NFR-PERF-06 | **L4** audio engine (Howler + glue) | ≤ 20 KB (gz) |
| NFR-PERF-07 | Fonts | ≤ 90 KB |
| NFR-PERF-08 | LCP image (portrait, 960 w AVIF) | ≤ 80 KB |
| NFR-PERF-09 | **Initial transfer** (L0 + L1 + fonts + LCP image; audio excluded) | ≤ 450 KB |
| NFR-PERF-10 | Whole home page fully scrolled (all lazy images; audio excluded) | ≤ 1.8 MB |
| NFR-PERF-11 | Audio: sprite / ambient (lazy) | ≤ 120 KB / ≤ 450 KB |
| NFR-PERF-12 | Lab (mobile, Slow-4G): LCP / TBT / CLS | ≤ 2.5 s / ≤ 200 ms / ≤ 0.05 |
| NFR-PERF-13 | Field p75: LCP / INP / CLS | ≤ 2.0 s / ≤ 150 ms / ≤ 0.05 |
| NFR-PERF-14 | Runtime: frame time p95 on `mid` tier | ≤ 16.7 ms (else the governor downgrades) |
| NFR-PERF-15 | JS heap after a full scroll / GPU texture memory | ≤ 60 MB / ≤ 64 MB |

> The chunk sizes above are **targets from library sizes** (GSAP core ≈ 27 KB gz, ScrollTrigger ≈ 12 KB, Lenis ≈ 3 KB, Howler ≈ 10 KB, OGL tree-shaken ≈ 15–25 KB). **Measure, don't assume.** If a chunk exceeds its budget, replace features with native browser APIs (CSS scroll-driven animations, WAAPI, `IntersectionObserver`, CSS `@keyframes` marquees) **before** asking to relax a budget.

### 8.3 Quality tiers (the "loud but light" mechanism)

| Tier | When | Features |
|---|---|---|
| **static** | `prefers-reduced-motion`, `Save-Data`, user **Lite mode**, no WebGL, `deviceMemory ≤ 2`, or governor fallback | L0 + L1 only: CSS fades ≤ 200 ms, no Lenis, no WebGL, no cursor, no marquee motion, no glass blur. **Sound remains available** (it is separate). |
| **low** | coarse pointer on weak/unknown devices; ≤ 4 cores & ≤ 4 GB | + GSAP reveals/scrubs, marquees, stickers (no parallax), no WebGL, no Lenis |
| **mid** | typical laptops / good phones | + WebGL hero (DPR ≤ 1.25), Lenis (desktop), parallax, custom cursor |
| **high** | strong GPU, desktop | + pointer ink-trail, DPR ≤ 1.5, floating-sticker parallax, tilt/glare |

**Detection (`lib/quality.ts`)** — three steps, no third-party GPU database:
1. **Sync heuristics** at load: `matchMedia('(prefers-reduced-motion)')`, `navigator.connection?.saveData`, `deviceMemory`, `hardwareConcurrency`, `pointer: coarse`, WebGL availability.
2. **Frame-time probe** during the gate's boot stage (≈ 400 ms of 20 dummy WebGL frames or `rAF` samples) to pick between mid/high.
3. **Runtime governor:** keep an EMA of frame time; if > 20 ms for 45 consecutive frames ⇒ downgrade one tier (dispose WebGL / stop trail / lower DPR). **Never upgrade within a session.**
Override with `?tier=static|low|mid|high` (also used by tests) and the footer **Lite mode** toggle (persisted `dp:lite`).

### 8.4 Loading & rendering rules

* **HTML-first:** SSG output, critical CSS inlined, Tailwind v4 CSS-first config (utilities generated only when used).
* **Scripts:** `type=module`, no blocking JS. L2/L3/L4 via dynamic `import()` triggered by `requestIdleCallback`, `IntersectionObserver` or the user's choice. Name the chunks `core`, `motion`, `webgl`, `audio` so size gates are stable.
* **Images:** `<picture>` AVIF + WebP; `srcset/sizes`; explicit `width/height`; LQIP/blurhash for lazy images; `loading="lazy" decoding="async"` below the fold; the LCP portrait gets `fetchpriority="high"` + `<link rel="preload" as="image" imagesrcset=…>`.
* **Below-the-fold:** `content-visibility: auto; contain-intrinsic-size: auto 800px` on heavy sections.
* **Fonts:** self-hosted, preload Anton + Geist, metric-matched fallbacks (§4.3).
* **Video:** none autoplaying on mobile; project previews are lazy `<video preload="none" poster>` started on hover/in-view, ≤ 600 KB.
* **Third parties:** none except Cloudflare Turnstile (loaded on form focus/visibility); Vercel Analytics / Speed Insights are first-party `/_vercel/*` paths (deferred). Everything else self-hosted.
* **Caching (`vercel.json` → `headers`, Appx I):** hashed assets `public, max-age=31536000, immutable`; HTML `public, max-age=0, must-revalidate`; audio files hashed + immutable with `Accept-Ranges`.
* **Animations:** `transform/opacity/clip-path` only; `will-change` only during an animation; no animating `box-shadow`, `filter: blur` on large areas, or layout properties.

### 8.5 WebGL rules (hero)

1. **One canvas, one program** (portrait plane). Library: **OGL** (tree-shaken: `Renderer`, `Program`, `Mesh`, `Plane`/`Triangle`, `Texture`, optionally `RenderTarget` for the trail).
2. Renderer: `antialias: false`, `alpha: true`, `premultipliedAlpha: true`, DPR clamp by tier (1 / 1.25 / 1.5), canvas sized to the hero box only (not full viewport).
3. **Render on demand:** render while (pointer moved in the last 2 s) **or** (scroll velocity > 0) **or** idle breathing at a 30 fps cap; stop when the hero is off-screen or the tab is hidden.
4. Textures: decode via `createImageBitmap` (off main thread), ≤ 1600 px longest edge, depth map 512 px; mipmaps off for the portrait; dispose on teardown.
5. Shaders: < 120 lines total, no heavy branching, no dependent texture reads in loops; precision `mediump` where possible.
6. **`webglcontextlost`** ⇒ prevent default, remove canvas, un-hide the `<img>` (graceful fallback); `webglcontextrestored` is ignored (stay on fallback).
7. Verified on Intel-UHD-620-class and Adreno-6xx-class devices (§8.6 matrix).

### 8.6 Measurement & CI gates

* **Lighthouse CI** on the built `apps/web` (mobile + desktop, 3 runs, median) with assertions in **Appendix E**; PRs fail on regression.
* **size-limit** on the named chunks (L1/L2/L3/L4) + CSS + fonts.
* **Playwright perf probe:** records long tasks in the first 5 s (≤ 2 > 50 ms) and verifies no console errors.
* **Manual device matrix per release:** Moto-G-Power-class Android (Chrome), iPhone 12-class (Safari), 2019-era Intel-iGPU laptop (Chrome/Firefox/Edge/Safari), a 1440p desktop with dGPU. Record FPS and tier chosen.
* **RUM:** Vercel Speed Insights (Web Vitals); investigate when p75 exceeds NFR-PERF-13.

---

## 9. Technical architecture

### 9.1 Principles

1. **Static-first.** The public site is prerendered HTML on a global CDN; no server runtime for page views.
2. **One typed content model** (Zod) shared by the build, the admin and the Edge Functions — the single source of truth for shapes and validation.
3. **Separate concerns.** Public site, admin app and backend are independent deployables in one monorepo.
4. **Smallest dependency surface** that still delivers the visuals; prefer platform features over libraries.
5. **Fail safe.** A failed content fetch/build never takes the live site down (the previous deployment stays live); every enhancement has a fallback.

### 9.2 Stack (npm `latest` as observed on 2026-11-16)

> **Pin exact versions in the lockfile.** Several majors here are newer than commonly documented (Astro 7, Vite 8, Vitest 5, Zod 4, Tailwind 4, TypeScript 6/7, pnpm 12). **Read the official docs/changelogs for each before use; do not rely on older API memory.**

| Concern | Choice | Version | Why / notes |
|---|---|---|---|
| Runtime | **Node.js 24 LTS** (minimum **≥ 22.23.4**) | 24.x | Astro 7 requires `engines.node >=22.23.4`; Vitest 5 needs `^22.12 \| ^24`; Vercel has retired Node 20 and offers 24.x (check Project Settings → Node.js Version). ⚠ *Dimas's machine currently has Node v20.20.0 → upgrade (add `.nvmrc` = 24, `engines.node: ">=22.23.4"`).* |
| Package manager / monorepo | **pnpm** workspaces + **Turborepo** | pnpm 12.x · turbo 2.11 | fast installs, task caching |
| Language | **TypeScript** (strict) | **~6.0.3** | ⚠ Do **not** use TS 7.0.x: `@astrojs/check`'s peer range is `^5 \|\| ^6`. Revisit when it widens. |
| Lint/format | **Biome** | 2.6 | single fast tool; `noUnusedImports`, a11y rules |
| **Public web** | **Astro** (static output, no UI framework) | **7.4.x** | HTML-first, zero JS by default; `@astrojs/sitemap` 3.7, `@astrojs/check` 0.9 |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` | 4.3.x | CSS-first `@theme`, tiny output |
| Fonts | **Fontsource** self-hosted | anton 5.3 · geist (variable) 5.3 · geist-mono (variable) 5.3 | OFL; no Google Fonts requests |
| Animation | **GSAP** + ScrollTrigger + SplitText (+CustomEase) | 3.15 | free under GSAP's "no charge" standard license (incl. former paid plugins; restriction: not for building competing visual animation builders) — fine here |
| Smooth scroll | **Lenis** | 1.3 (MIT) | tiny; driven by `gsap.ticker` |
| WebGL | **OGL** | 1.0 (Unlicense) | ~⅙ the size of Three.js; enough for a plane + trail FBO |
| Audio | **Howler.js** (+ raw Web Audio nodes) | 2.2.4 (MIT) | sprites, unlock handling, `Howler.ctx` access |
| Images (build) | **sharp** via Astro image service | 0.35 | AVIF/WebP + responsive sets |
| Validation | **Zod** | 4.6 | shared schemas |
| **Admin app** | **Vite + React + TypeScript** | Vite 8.3 · React 19.3 · `@vitejs/plugin-react` 6.3 | SPA, separate deployment |
| Admin libs | `react-router` (v7), **TanStack Query** 5.107, **react-hook-form** 7.92 + `@hookform/resolvers`, **@dnd-kit** (core 6.3, sortable 10), Tailwind 4 + **shadcn/ui** (Radix), `sonner`, `browser-image-compression` 2.0, `vite-plugin-pwa` 2.0 | | installable PWA for quick-add from a phone |
| Backend | **Supabase**: Postgres + Auth + Storage + Edge Functions (Deno) | supabase-js 2.119 · CLI 3.1 | RLS-first; free tier suffices. ⚠ Free projects **pause after ~7 days of low activity** → keep-alive workflow (§9.8). |
| Email | **Resend** (from an Edge Function) | resend 6.38 | owner notifications only — the database is the source of truth. Without a verified domain, Resend's sandbox sender can only email the account owner's own address, which is exactly this use case (verify current rules); add a domain later for a branded sender. |
| Anti-spam | **Cloudflare Turnstile** (free; needs a free Cloudflare account — *not* Cloudflare hosting) + honeypot + time-trap + rate limit — **the professional default (D-16)** | — | invisible, no cookies, no CAPTCHA puzzles; layered defence so a single bypass is not enough |
| Hosting | **Vercel (Hobby, free)** — two projects (web, admin) from this repo | Vercel Git integration | global CDN, PR preview deployments, **Deploy Hooks**, `*.vercel.app` domains. Hobby is **personal / non-commercial only** (no ads, paid services or pricing on the site — §1.5). Quotas change: read the current Hobby plan page. |
| Analytics | **Vercel Web Analytics** (cookie-less page views; Hobby quota ≈ 50k events/mo — verify) + **Vercel Speed Insights** (Web Vitals; free tier ≈ 10k events/30 days — verify) + tiny first-party event counter (§12) | — | no consent banner; custom events do **not** depend on Vercel |
| Tests | **Vitest** 5.1 · **Playwright** 1.65 · `@axe-core/playwright` 4.14 · **Lighthouse CI** 0.16 · `size-limit` | | §14 |
| OG images | static designed OG for home + per-page via **satori** (MPL-2.0) + `@resvg/resvg-js` (MPL-2.0) at build | 0.63 / 2.6 | optional dynamic; MPL is acceptable for unmodified use |

**Considered & rejected:** Three.js (≈ 6× heavier than OGL for this use) · Next.js/React for the public site (hydration cost; Next.js stays on the site only as one of Dimas's listed skills, and Vercel hosts Astro's static output natively) · Framer Motion (React-only) · Tone.js (≈ 150 KB; Howler + a few Web Audio nodes suffice) · Locomotive/ScrollSmoother (Lenis is lighter) · hosted headless CMS (admin requirements are small; own admin = control + no vendor limits) · SSR/edge rendering (unneeded; adds runtime + cold paths) · `@imgly/background-removal` (non-permissive license) · Dependabot/Renovate (HR-1: no bot authors → manual updates).

### 9.3 Repository layout

```
Dimas-s_Portofolio/
├─ apps/
│  ├─ web/                      # public portfolio — Astro 7 (static)
│  │  ├─ src/
│  │  │  ├─ pages/              # index, en/index, works/[slug], achievements/[slug], cv, credits, privacy, 404
│  │  │  ├─ components/         # Section*.astro, Card*.astro, Nav.astro, Gate.astro, Sticker.astro …
│  │  │  ├─ enhancers/          # per-section TS behavior: gate.ts, hero.ts, about.ts, achievements.ts, journey.ts, works.ts, …
│  │  │  ├─ lib/                # quality.ts, motion.ts, scroll.ts, cursor.ts, webgl/, audio/
│  │  │  ├─ styles/             # tokens.css, base.css, utilities
│  │  │  ├─ i18n/               # id.json, en.json (UI strings only)
│  │  │  └─ data/               # content.generated.json (git-ignored)
│  │  ├─ public/                # robots.txt, audio/, favicons
│  │  ├─ astro.config.mjs
│  │  └─ vercel.json            # headers, cache rules, cleanUrls (Appx I)
│  └─ admin/                    # private CMS — Vite + React (separate deployment)
├─ packages/
│  ├─ schema/                   # Zod schemas + inferred types + i18n helpers (single source of truth)
│  ├─ content-client/           # fetchContent(): Supabase REST (build) | seed JSON (fallback) → ContentSnapshot
│  └─ config/                   # tsconfig.base, biome.json, tokens.css (shared design tokens)
├─ supabase/
│  ├─ migrations/               # 0001_init.sql … (Appendix C)
│  ├─ functions/                # contact/, trigger-deploy/, track/
│  ├─ config.toml               # signups disabled, MFA on, redirect URLs
│  └─ seed.sql  (generated from docs/seed/content.seed.json)
├─ tools/
│  ├─ audio/                    # raw/ (ignored), build-sprite.mjs, LEDGER.json
│  └─ images/                   # portrait pipeline scripts (§4.7)
├─ scripts/                     # fetch-content.ts, seed-db.ts, content-lint.ts, check-authorship.sh
├─ design/source/Dimas.jpg      # source portrait (input)
├─ docs/                        # PRD.md, seed/content.seed.json
├─ .github/workflows/           # ci.yml, authorship.yml, keepalive.yml, backup.yml
├─ .husky/                      # commit-msg (HR-1 guard)
├─ .nvmrc  .editorconfig  .gitignore  .env.example  biome.json  turbo.json  pnpm-workspace.yaml  README.md
```

### 9.4 Topology & data flow

```
                       ┌───────────────────────── Admin (separate origin) ─────────────────────────┐
 Dimas (phone/laptop)──▶│  apps/admin (React PWA)  ──supabase-js (JWT, aal2)──▶  Supabase           │
                       └───────────────┬───────────────────────────────────────┬───────────────────┘
                                       │ "Publish"                              │ Postgres (RLS) · Auth · Storage
                                       ▼                                        │
                       Edge Function trigger-deploy ──(owner check)──▶ Vercel Deploy Hook
                                                                                │
   Build (Vercel, Node 24)                                            │
   pnpm build:web ─ scripts/fetch-content.ts ◀── Supabase REST (anon/publishable key, published rows only)
                 └─ validate (Zod) → content.generated.json → Astro SSG → AVIF/WebP images → dist/
                                                                                ▼
 Visitor ──HTTPS──▶ Vercel CDN (HTML, hashed assets, audio) ──▶ L0 → L1 → L2 → L3 → L4 (lazy)
        └─ contact form ──▶ Edge Function contact (Turnstile, rate-limit, Resend) ──▶ messages table ──▶ Admin inbox
```

### 9.5 Build pipeline

1. `scripts/fetch-content.ts` (prebuild): calls `@portfolio/content-client` → Supabase REST using the **publishable key** → published rows + media metadata → **Zod-validates** → writes `apps/web/src/data/content.generated.json`.
2. Source selection: `CONTENT_SOURCE=supabase` (production) · `seed` (local/CI, reads `docs/seed/content.seed.json`). In production, **a fetch/validation failure fails the build loudly** (the last good deployment stays live). In CI/local the seed fallback keeps development unblocked.
3. Astro renders every route (ID + EN) from the snapshot; remote media is downloaded and optimized by the image service at build time (no runtime image CDN needed).
4. `pnpm content:lint` prints the **placeholder report** and enforces `STRICT_PLACEHOLDERS=1` if set.
5. Output `apps/web/dist` → Vercel (static output; no adapter needed).

### 9.6 Publish flow (admin → live)

Admin "Publish" → confirmation dialog (changed-item counts, **placeholder warning**) → Edge Function `trigger-deploy` (verifies JWT + `is_owner()` + aal2; calls the **Vercel Deploy Hook** URL stored as a server secret; inserts a `publish_runs` row) → Vercel build (~60–90 s) → live. The admin shows "Triggered 14:02 · usually live in ~90 s" + a link to the Vercel deployments page. P1: poll build status through a second function using a scoped Vercel API token. **If Deploy Hooks turn out to be unavailable on the Hobby plan** (verify in the dashboard), fall back to the Vercel REST API "create deployment" call with a scoped token — still server-side only.

### 9.7 Security & headers

* **Headers (`apps/*/vercel.json` → `headers`; example in Appx I)**: `Content-Security-Policy` (default-src 'self'; script-src 'self' + `https://challenges.cloudflare.com` (Turnstile); Vercel Analytics/Speed Insights are first-party `/_vercel/*` paths covered by 'self'; style-src 'self' with hashes, or `'unsafe-inline'` only if unavoidable; img-src 'self' data: (+ the Supabase storage origin only if images are not self-hosted); connect-src 'self' + the Supabase functions origin; frame-src `https://challenges.cloudflare.com`; object-src 'none'; base-uri 'self'; form-action 'self' + the functions origin), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `Cross-Origin-Opener-Policy: same-origin`. Vercel already serves HSTS on `*.vercel.app`.
* **Admin:** extra `X-Robots-Tag: noindex, nofollow` header (in the admin's `vercel.json`), `<meta name="robots" content="noindex">`, strict CSP (no inline scripts). Vercel Hobby has no production-level password protection, so **Supabase Auth + mandatory MFA is the gate**; keep the admin URL unlisted.
* **Auth:** Supabase Auth email OTP/magic link for the owner only; **public signups disabled**; `owner` table; **TOTP MFA mandatory** (RLS requires `aal2`); idle session timeout 7 days.
* **Data:** RLS on every table; anon can only read `published` rows; **service-role key exists only inside Edge Functions**; CORS on functions locked to the site/admin origins.
* **Uploads:** client re-encodes to WebP/AVIF (**strips EXIF/GPS**), ≤ 5 MB, MIME allow-list enforced by the bucket; alt text required.
* **Markdown:** rendered through a sanitizer (`rehype-sanitize`/DOMPurify); no raw HTML.
* **Audit:** every content write recorded in `audit_log`.
* **Secrets:** only in Vercel/Supabase/GitHub secret stores; `.env.example` documents names (Appendix F).

### 9.8 Reliability, backup & keep-alive

* **Keep-alive** (`keepalive.yml`, weekly + manual): one anonymous REST read, so the free Supabase project is not paused for inactivity.
* **Backups:** (1) admin **"Export all"** (JSON + media manifest, includes drafts); (2) `backup.yml` weekly: fetch published snapshot → upload as a GitHub Actions artifact (90-day retention); (3) `docs/seed/content.seed.json` in git (initial truth). Document restore steps in `docs/RUNBOOK.md`.
* **Rollback:** Vercel **Instant Rollback / promote a previous deployment** (check Hobby availability in the docs). A failed build never replaces the live deployment.

---

## 10. Content management — the separate Admin app

### 10.1 Purpose & principle

Dimas MUST be able to add or edit **achievements, projects, experience, education, skills, gallery items, site text/links, the CV file**, read contact messages and publish — **without touching code** and without an IDE. The admin is a **different app on a different origin** (its own `*.vercel.app` project, e.g. `dimas-panca-admin.vercel.app`, or a custom domain later), invisible to the public site (HR-7). One user: the owner.

### 10.2 Functional requirements

| ID | Pri | Requirement |
|---|---|---|
| FR-ADM-01 | P0 | **Auth:** email OTP/magic link to the owner address only; enroll **TOTP MFA** on first login; all writes need `aal2`; "sign out everywhere". |
| FR-ADM-02 | P0 | **Dashboard:** counts per collection (published/draft/archived), **placeholder count** with a "fix these" list, **achievements missing proof**, **unreviewed Indonesian texts** (`needs_review`), last publish run, unread messages, event counters (§12.4), quick-add buttons. |
| FR-ADM-03 | P0 | **Achievements CRUD** (fields below) with the **writing-standard lint + live display-line preview** (§2.5.1), a **Proofs panel** (add certificate image / photo / PDF / link later), drag-to-reorder, **Featured** toggle, duplicate, archive (soft delete), hard-delete with typed confirmation. |
| FR-ADM-04 | P0 | **Experience / Education / Projects / Skills / Gallery CRUD** with the same list UX (search, filter by status, bulk publish/archive). **Gallery:** bulk multi-select upload, albums, drag-reorder, caption, required alt text, link to an achievement. |
| FR-ADM-05 | P0 | **Localized fields:** each text field has **EN / ID** tabs (EN is the source and default site language; ID optional); "copy EN → ID" helper; `needs_review` toggle; a missing ID falls back to EN on the site. |
| FR-ADM-06 | P0 | **Image upload pipeline:** pick/take photo → crop (aspect presets) → client WebP/AVIF re-encode, **EXIF stripped**, ≤ 1600 px → upload to Storage → create `media` row with **required alt text (ID/EN)**, dimensions, blurhash. |
| FR-ADM-07 | P0 | **Draft/Publish:** `draft → published → archived`; autosave drafts (1.5 s debounce) with dirty-state guard; only `published` rows are public (RLS). |
| FR-ADM-08 | P0 | **Publish screen:** diff summary since last run, placeholder warning, confirm → triggers rebuild; shows history from `publish_runs`. |
| FR-ADM-09 | P0 | **Settings:** profile text, hero eyebrow/pitch, availability text (ID/EN), social links, email, **WhatsApp number** (HR-10), SEO defaults, CV PDF upload (to `docs` bucket). |
| FR-ADM-10 | P1 | **Inbox:** list contact messages, mark read/archive/spam, reply via `mailto:`, delete; 90-day auto-purge indicator. |
| FR-ADM-11 | P1 | **Preview:** a card preview that mirrors the public component's look (shared `tokens.css`), plus "Open staging preview" link (Pages preview deployment of the current draft build — optional). |
| FR-ADM-12 | P1 | **Case-study editor** for projects: markdown (CommonMark) with sanitized live preview, inline media picker. |
| FR-ADM-13 | P1 | **Audit log** viewer (who/what/when, old→new). |
| FR-ADM-14 | P1 | **Export all** (JSON + media list) and **Import seed** (idempotent upsert by `slug`). |
| FR-ADM-15 | P1 | **PWA:** installable, offline shell, **mobile-first** forms, camera capture for certificate photos. |
| FR-ADM-16 | P2 | Revision history per record; scheduled publish; Vercel build-status polling. |

**Quick-Add Achievement (mobile FAB, P0)** — the flow Dimas will use right after an event: *Event title (EN/ID) → Placement preset (1st / 2nd / 3rd / Top N Finalist) → Type (preset list) → Organizer (host) → Month & year → Photo or certificate (optional) → Save draft → Publish.* **AC: ≤ 2 minutes from phone.**

#### Achievement form (fields → columns)

| Field | Type | Rules |
|---|---|---|
| Placement label | preset → localized text | canonical set (§2.5.1): 1st / 2nd / 3rd Place, Top N Finalist; required |
| Placement tier | int | derived from the preset (1, 2, 3, N) |
| Event title | localized text | **official event name only** (lint hints per §2.5.1); required |
| Type label | preset list + custom (localized) | e.g. *Essay Competition*, *Hackathon* |
| Category | select | `essay · business · hackathon · ai-ml · research · certification · other` (drives filter chips) |
| Organizer (host) | text | full official institution name; required |
| Scope | select | international · national · regional · campus — **optional, never guessed** |
| Location | text | optional, e.g. *Chiang Mai, Thailand* |
| Month & year | month picker | required; stored `YYYY-MM-01`, precision `month` |
| Entry type | individual · team · unknown | optional |
| Summary | localized text (≤ 280 chars) | shown on the card |
| Highlights | list of localized bullets | detail page / expander |
| Tags | chips | optional |
| Cover | media picker | optional (generated art if empty) |
| **Proofs** | repeatable: kind (certificate · photo · pdf · link) + upload **or** URL + label | **where Dimas adds certificate / Drive links later (Q-6)**; optional; the item shows a "missing proof" badge until one exists |
| Event photos | multi-image picker | optional; shown on the detail page and in a gallery album |
| Linked project | select | optional (e.g. the oyster-mushroom system) |
| Featured | toggle | appears in the pinned rail (default: first 6 by sort order) |
| Status / placeholder / needs-review | enums/bools | |


### 10.3 Data model (summary — full DDL in Appendix C)

`owner` · `media` · `projects` · `achievements` · `experiences` · `education` · `skills` · `gallery_items` · `site_settings` (singleton) · `messages` · `contact_rate` · `events` · `audit_log` · `publish_runs`.
Shared columns on content tables: `id uuid`, `slug`, `status content_status`, `is_placeholder`, `needs_review`, `sort_order`, `created_at`, `updated_at`, `published_at`. Localized fields are `jsonb` `{ "id": "…", "en": "…" }` validated by Zod (`Localized`). Storage buckets: `media` (public, images ≤ 5 MB), `docs` (public, PDFs ≤ 10 MB); writes owner-only.
Achievements additionally carry `type_label`, `entry_type`, `featured`, `proofs jsonb` (filled later by Dimas) and `gallery_media_ids`; gallery items carry `album` and `achievement_id`.

### 10.4 Public content contract (`ContentSnapshot`)

The only shape the public site consumes (defined in `packages/schema`, produced by `content-client`):

```ts
type ContentSnapshot = {
  version: 1; generatedAt: string;                // ISO
  settings: SiteSettings;                         // profile, hero, availability, socials, seo, whatsapp?, cvUrl?
  achievements: Achievement[]; experiences: Experience[]; education: Education[];
  projects: Project[]; skills: Skill[]; gallery: GalleryItem[];
  media: Record<string, { url: string; width: number; height: number; blurhash?: string; alt: Localized }>;
};
```
Only `published` rows; placeholders included but flagged. The build computes **derived stats** (counts, GPA) from this — nothing is hard-coded in templates.

### 10.5 Edge Functions

| Function | Auth | Input → behavior | Errors |
|---|---|---|---|
| `contact` | public (`verify_jwt=false`), CORS = site origins | Validate (Zod) → honeypot → Turnstile verify → rate-limit by hashed IP (5/hour) → insert `messages` → send Resend email to owner → `303 /thanks` for HTML posts or `{ok:true}` JSON | 400 validation · 429 rate-limited · 502 mail failure (message is still stored) |
| `trigger-deploy` | JWT required + `is_owner()` aal2 | Insert `publish_runs` → `POST` the Vercel Deploy Hook URL (secret) → return run id | 401/403 · 502 hook failure |
| `track` | public, CORS, tiny | Accepts `{name}` from an allow-list (`cv_download`, `sound_on`, `sound_off`, `contact_click`, `unlock_all`) → `events` upsert by day (no IP, no UA, no cookies) | 400 · 429 |

### 10.6 Admin acceptance criteria

* **AC-ADM-1:** From a clean login on a phone, Dimas adds an achievement with a photo and publishes; it appears on the live site ≤ 90 s (p95) with correct styling and sort order.
* **AC-ADM-2:** Anonymous requests cannot read drafts/archived rows, `messages`, `audit_log`, or write anything (RLS tests in CI against a local Supabase).
* **AC-ADM-3:** An authenticated user **without** `aal2` or not in `owner` cannot write.
* **AC-ADM-4:** Uploaded images contain no EXIF GPS; alt text is mandatory.
* **AC-ADM-5:** The public build contains no admin code, no service-role key, no `apps/admin` assets (verified by a build-output scan).
* **AC-ADM-6:** `pnpm db:seed` imports `docs/seed/content.seed.json` idempotently (re-run creates no duplicates).

---

## 11. Contact & messaging

| Aspect | Spec |
|---|---|
| Fields | `name` (2–80), `email` (valid), `topic` (Internship · Collaboration · Competition · Other), `message` (10–2000), hidden `website` honeypot, Turnstile token. |
| Client | Inline validation (Zod-derived messages, ID/EN), `aria-live` status region, disabled-while-sending, success state with `send_ok` + subtle burst, error state with `error` cue and a `mailto:` fallback link. Turnstile script loads on first focus/visibility of the form (not on page load). |
| **No-JS path (HR-5)** | The `<form>` has a real `action` (the `contact` Edge Function URL) + `method="post"`; the function answers HTML posts with `303` → `/thanks` (static, `noindex`) and JSON for `fetch`. |
| Server | `contact` Edge Function (§10.5): validate → honeypot → Turnstile → rate-limit (5/hour per hashed IP) → store → Resend email to the owner. If email fails, the message is **still stored** and appears in the admin inbox. |
| Privacy | Store only name/email/message/topic + salted-hash of IP (daily salt) + truncated UA. **Retention 90 days** then purge (scheduled SQL or workflow). Deletion on request by email. Linked from `/privacy`. |
| Alternatives surfaced | Copy-email (with toast), `mailto:`, WhatsApp (`wa.me`, only if configured), LinkedIn. |
| AC | Valid submit → stored + email within 10 s; honeypot/Turnstile failures never reveal which check failed; works with JS disabled; rate-limit returns a friendly 429 message. |

---

## 12. SEO · i18n · analytics · privacy

### 12.1 SEO

* Per-route `<title>`, description, canonical, `hreflang` (`en`, `id`, `x-default` → `en`), `<html lang>` per locale, JSON-LD `inLanguage`, Open Graph + Twitter cards, `theme-color`, favicons (SVG + 180 apple-touch), `manifest.webmanifest`.
* **JSON-LD:** `Person` (name, jobTitle *"Informatics Engineering student"*, alumniOf/affiliation UNTIRTA, address *Serang, Banten, ID*, `sameAs` LinkedIn + GitHub, `email`, `image`) and `WebSite`; `BreadcrumbList` on detail pages. Use `schema-dts` types. **Do not** put the phone number in structured data.
* **OG images** 1200×630: one designed static image for home (portrait on ink with the name); per-project/achievement images generated at build with satori + resvg (or a static fallback).
* `sitemap-index.xml` (via `@astrojs/sitemap`, both languages), `robots.txt` (allow all on the public site; the admin origin serves `Disallow: /` + `noindex`).
* All content is in the static HTML (headings hierarchy `h1` once in hero, `h2` per section) so it is indexable without JS.

### 12.2 i18n

* **Astro i18n routing:** default **`en` at `/`**, `id` at `/id/` (D-10); **no automatic redirect by browser language** (SEO/predictability) — a visible toggle remembers the choice (`dp:lang`).
* UI strings in `apps/web/src/i18n/{en,id}.json` (including all microcopy, §4.10); content strings are `Localized` fields from the data (**EN is the source** — verbatim from the CV/Dimas; ID drafted, `needs_review`). Missing ID ⇒ EN fallback (a dev-only warning lists them).
* Dates/numbers via `Intl` with the page locale; the live clock is always `Asia/Jakarta`.

### 12.3 Privacy

* **No cookies.** `localStorage`/`sessionStorage` keys (functional only): `dp:audio`, `dp:lang`, `dp:lite`, `dp:explored`, `dp:gate` (session). Listed on `/privacy`. All access wrapped in `try/catch`.
* The contact form processes personal data (Indonesian PDP Law context): purpose limitation, 90-day retention, deletion on request, no sale/sharing. State this plainly in `/privacy` (ID + EN).
* No third-party tracking, no fingerprinting, no session replay.

### 12.4 Analytics

* **FR-ANA-01 (P0):** **Vercel Web Analytics** (cookie-less; first-party script `/_vercel/insights/script.js`, deferred) for traffic + **Vercel Speed Insights** for Web Vitals. Both are dashboard toggles and must stay within Hobby quotas (verify current numbers). No consent banner needed.
* **FR-ANA-02 (P1):** first-party counters via the `track` function (allow-list: `cv_download`, `sound_on`, `sound_off`, `contact_click`, `unlock_all`), aggregated per day in `events`, shown on the admin dashboard. No IP/UA/ID stored.

---

## 13. Accessibility

Target **WCAG 2.2 AA** (Lighthouse a11y = 100 is the *floor*, not the goal).

| Area | Requirement |
|---|---|
| Structure | Landmarks (`header`, `nav`, `main`, `footer`), one `h1`, logical `h2/h3`, skip-link to `#main`, `lang` switches with locale. |
| Keyboard | Everything operable by keyboard; visible 2 px volt focus ring (≥ 3:1 vs adjacent colors); the gate, menu overlay, lightbox and dialogs **trap focus** and restore it on close; rail supports `←/→`; no keyboard traps in marquees. |
| Motion | Honor `prefers-reduced-motion` (§6.5); nothing flashes more than 3×/second; auto-moving content (marquees) can be paused (hover/focus + a global "Lite mode"); parallax/scrub never carries essential information. |
| Sound | Off until consent (HR-6); toggle has `aria-pressed` + text label; sound is never the *only* feedback for state changes (always paired with visual state). |
| Color/contrast | Text ≥ 4.5:1 (body ≥ 7:1 on `--bg` via `--fg/--muted`); large text ≥ 3:1; accent-on-paper rule (§4.2). |
| Images | Meaningful `alt` (required in admin); decorative art `alt=""`/`aria-hidden`; portrait alt: *"Dimas Panca Pamungkas seated on a stool in a black blazer, looking to the side"* (ID/EN). |
| Forms | Visible labels, programmatic errors (`aria-describedby`), `autocomplete` tokens, honeypot hidden from AT (`aria-hidden`, `tabindex=-1`). |
| Targets | ≥ 44×44 px touch targets; 200 % zoom / 320 px reflow without horizontal scroll. |
| Live regions | Achievement rail position, unlock events ("Achievement unlocked: …") politely announced; counters expose final values immediately to AT. |
| Testing | `@axe-core/playwright` on all routes ×2 languages ×2 tiers (static/high); manual pass with NVDA + VoiceOver. |

---

## 14. Quality assurance & Definition of Done

### 14.1 Test plan

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest 5 | Zod schemas, `content-client` mapping, quality-tier heuristics, audio state machine/prefs, stat derivations (counts/GPA), authorship-guard script |
| Component/DOM | Vitest + happy-dom/jsdom | gate logic, filter chips, form validation |
| DB/RLS | local Supabase + Vitest | anon vs owner vs non-aal2 policies (AC-ADM-2/3), seed idempotency |
| E2E | Playwright (Chromium, Firefox, WebKit; desktop + mobile emulation) | gate (all branches, `?mute=1`), nav, language switch, achievements rail (keyboard), unlock fires once, contact (no-JS and JS), CV download, 404, **no audio before gesture**, admin quick-add → publish flow (against local stack) |
| A11y | axe + manual | §13 |
| Perf | Lighthouse CI + size-limit + Playwright long-task probe | §8.6 |
| Visual | Playwright screenshots | hero/achievements/contact at 3 viewports × tiers (static, high); WebGL runs with SwiftShader/ANGLE flags in CI |
| Security | `pnpm audit` (read-only, weekly), header check test, build-output scan for secrets/admin code | §9.7, AC-ADM-5 |

### 14.2 CI pipeline (`ci.yml`)

`install (pnpm cache) → biome check → tsc/astro check → unit → build (seed source) → size-limit → LHCI (mobile+desktop) → Playwright e2e/a11y → content:lint report → authorship guard`. All required for merge to `main`.

### 14.3 Definition of Done (release checklist)

- [ ] All **P0** requirements implemented; **P1** either done or explicitly deferred in `docs/RUNBOOK.md`.
- [ ] Every fact on the site traces to `content.seed.json`/admin data; no invented claims (HR-2).
- [ ] Budgets §8.2 met; LHCI green; manual device matrix recorded.
- [ ] Works with JS off, WebGL off, audio off, reduced motion (HR-5); Lite mode verified.
- [ ] Sound: no pre-consent audio; mute persists; ledger complete; `/credits` correct (HR-6/9).
- [ ] Admin: AC-ADM-1…6 pass; MFA enforced; RLS tests green (HR-7).
- [ ] No secrets in git; headers/CSP deployed; `robots`/`noindex` correct on admin (HR-8).
- [ ] Placeholder report reviewed with Dimas; list of remaining placeholders handed over (HR-11).
- [ ] Git history: **all commits authored/committed by Dimas, zero AI attribution** (HR-1), guard green.
- [ ] README + `docs/RUNBOOK.md` complete (setup, env, deploy, restore, add-content guide).

---

## 15. Delivery plan, git rules & deployment runbook

### 15.1 Milestones (execute in order; each ends with its acceptance criteria)

| # | Milestone | Deliverables | Acceptance |
|---|---|---|---|
| **M0** | **Foundations** | pnpm+Turborepo workspace, TS ~6.0.3 base, Biome, `.nvmrc`(24)/`engines`(≥ 22.23.4), husky `commit-msg`, `.editorconfig`, `.env.example`, CI skeleton (`ci`, `authorship`, `keepalive`, `backup`), PR template, CODEOWNERS, README | `pnpm i && pnpm lint && pnpm typecheck && pnpm test` green on Node 24; a commit with a `Co-authored-by:` trailer is **rejected** locally and in CI |
| **M1** | **Design system + static site** (no motion) | Astro 7 app; tokens, fonts, layouts; **all sections rendered from the seed via `content-client`**; ID/EN routing; SEO basics; portrait pipeline outputs; placeholder art; `/credits`, `/privacy`, `/thanks`, 404; `/cv` | Fully readable with JS off; Lighthouse desktop ≥ 95/100/100/100; 9 achievements (6 in the rail, 9 in the archive) + 4 roles + 2 real projects render; no facts hard-coded in templates |
| **M2** | **Motion & WebGL** | Lenis+GSAP engine, gate, hero timeline, marquees, About scrub + card-stack, Achievements rail + unlock, Journey line, Works slider + native view transitions, Skills marquee, Contact headline, cursor, HUD; WebGL hero; tiers + governor; `?tier=` override | 60 fps on mid tier; §8.2 budgets; reduced-motion + each tier verified; WebGL context-loss fallback proven |
| **M3** | **Sound** | Sources picked, processed, **ledger**; sprite + ambient; engine, gate flow, delegated bindings, scroll-reactive filter, toggles, `/credits` from ledger | No audio before gesture (e2e); mute persists; sprite ≤ 120 KB, ambient ≤ 450 KB; CI license check passes |
| **M4** | **Backend + Admin** | Supabase migrations + RLS, `db:seed`, Edge Functions (`contact`, `trigger-deploy`, `track`), admin app (auth+MFA, CRUD, uploads, reorder, preview, publish, inbox, audit, export, placeholders view, PWA), `content-client` Supabase source, deploy-hook wiring | AC-ADM-1…6; add-from-phone ≤ 2 min; publish → live ≤ 90 s |
| **M5** | **Hardening** | Perf tuning to budget, axe + manual SR pass, JSON-LD/OG/sitemap, CSP + headers, backups, cross-browser/device matrix | All CI gates green; device matrix recorded |
| **M6** | **Launch & handoff** | Vercel deploys (web+admin), Vercel Analytics + Speed Insights, Turnstile live, smoke tests, `docs/RUNBOOK.md`, placeholder hand-over; flip `STRICT_PLACEHOLDERS=1` once Dimas has replaced them | §14.3 fully checked |

**Implementation order inside each milestone:** data/types → static markup → styles → behavior → polish → tests.

### 15.2 What the implementer needs from Dimas (blocking items are in §16)

Accounts/keys the owner must create (the implementer prepares scripts and a step-by-step guide): **GitHub** repo (exists) · **Vercel** account (Hobby; two projects) · **Supabase** project · a free **Cloudflare** account **for Turnstile only** · **Resend** API key (or skip email → inbox only). Domains: the free `*.vercel.app` names. Secrets go **only** into Vercel/Supabase/GitHub secret stores (Appendix F).

### 15.3 Git, authorship & contribution rules (HR-1)

* **Identity:** commits use the repo/global git identity of Dimas Panca Pamungkas. Never override `user.name/email` with anything else; never add co-author trailers.
* **Branching:** trunk-based; `main` protected (PR + required checks); feature branches `feat/…`, `fix/…`, `docs/…`; squash-merge. **Conventional Commits**, English, imperative (`feat(web): add achievements rail`).
* **Forbidden in any commit message, PR text, README, comment or credit:** `Co-authored-by:` lines, "Generated with …/by …" footers, any AI tool or bot named as contributor/author/reviewer.
* **No bots committing:** no Dependabot/Renovate/auto-format bots. Dependency updates are manual (`pnpm up -i`, monthly) and committed by Dimas.
* **Local guard** `.husky/commit-msg`:

```sh
#!/bin/sh
if grep -qiE '^co-authored-by:|generated (with|by)' "$1"; then
  echo "✖ Forbidden attribution in commit message (PRD HR-1). Remove it and commit again." >&2
  exit 1
fi
```
* **CI guard** `scripts/check-authorship.sh` (job `authorship`, required): for every commit in the PR range, (a) message must not match the pattern above, (b) author name/email must equal the repo variable `AUTHOR_NAME`/`AUTHOR_EMAIL`, (c) committer must be the same identity **or** GitHub's web-flow committer (for web squash-merges). Fails the build otherwise.
* **Repo hygiene:** `CODEOWNERS` = the owner only; `.gitignore` excludes `node_modules`, `.env*` (except `.env.example`), `dist`, `.turbo`, `tools/audio/raw`, `apps/web/src/data/content.generated.json`, local tool folders, and third-party reference media.

### 15.4 Deployment runbook (summary — expand in `docs/RUNBOOK.md`)

1. **Supabase:** create project → run migrations (`supabase db push`) → disable public signups → create the owner user → insert into `owner` → enroll TOTP → set function secrets (`TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `VERCEL_DEPLOY_HOOK_URL`) → deploy functions → `pnpm db:seed` (put `SEED_WHATSAPP_NUMBER` in a git-ignored `.env` first).
2. **Vercel (web):** import the GitHub repo → Root Directory `apps/web` (keep "include source files outside of the Root Directory" enabled) → Framework Astro → Install `pnpm install --frozen-lockfile` → Build `pnpm turbo run build --filter=@portfolio/web` → Node 24.x → Production Branch `main` → env `PUBLIC_*` and `CONTENT_SOURCE=supabase` → Settings → Git → **Deploy Hooks**: create one for `main` and store the URL as the Supabase secret `VERCEL_DEPLOY_HOOK_URL` → optional Ignored Build Step `npx turbo-ignore @portfolio/web` → **turn off Pull Request Comments** (keeps bots out of the repo, HR-1) → enable Web Analytics + Speed Insights.
3. **Vercel (admin):** a second project, Root Directory `apps/admin`, framework Vite, env `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; SPA rewrite + `noindex` header in `apps/admin/vercel.json` (Appx I).
4. **Turnstile:** create a free Cloudflare account → add a Turnstile widget → copy the site key (public env) and secret (Supabase secret).
5. **Domains:** use the free `*.vercel.app` names (suggested `dimas-panca.vercel.app` and `dimas-panca-admin.vercel.app` — names must be free); set `PUBLIC_SITE_URL`, the Supabase Auth redirect URLs and the functions' CORS origins to those origins (redo if a custom domain is added later).
6. **Smoke test:** gate, sound, form (JS on/off), admin quick-add → publish → live; Lighthouse CI on production URL.

---

## 16. Open questions (status as of 2026-11-16)

Nothing below blocks the build; defaults are in force until Dimas answers.

| ID | Question | Status | Answer / default applied |
|---|---|---|---|
| **Q-1** | Higher-resolution portrait? | **Answered** | New 1792×2400 studio photo (D-1) |
| **Q-2** | Domain? | **Answered** | Vercel free (Hobby), `*.vercel.app` (D-2) |
| **Q-3** | Degree wording? | **Answered** | **Informatics Engineering** (D-11) |
| **Q-4** | Languages/frameworks to list? | **Answered** | Next.js, PHP, Laravel, Python, C++, JavaScript (D-3) |
| **Q-5** | Is the oyster-mushroom system the FAPERTA FAIR entry? | **Answered** | Yes — 1st place at Chiang Mai University, Thailand (D-4) |
| **Q-6** | Which Drive link proves which achievement? | **Answered (deferred)** | Dimas will add proofs later; the admin **Proofs** panel and "missing proof" checklist are ready (D-14) |
| **Q-7** | Availability wording? | **Answered (placeholder)** | Placeholder kept (D-5) |
| **Q-8** | Show phone/WhatsApp? | **Answered** | Yes; number via admin or git-ignored `SEED_WHATSAPP_NUMBER` (D-6) |
| **Q-9** | Default language? | **Answered** | **English** default, Indonesian secondary (D-10) |
| **Q-10** | Cloudflare account for Turnstile? ("what is most professional?") | **Answered** | Yes — Turnstile + honeypot + time-trap + rate limit, Resend for owner notifications (D-16). Dimas needs a free Cloudflare account **for Turnstile only** |
| **Q-11** | Photos (Chiang Mai etc.) for the gallery? | **Answered (deferred)** | Dimas uploads later; admin Gallery with albums + bulk upload is ready (D-15) |
| **Q-12** | Tone? | **Answered** | Combine both: formal facts, playful interactions (D-17, §4.10) |
| **Q-13** | FAPERTA FAIR entry individual or team? | **Answered** | **Individual** → first-person wording (D-12) |
| **Q-14** | Months of each achievement? | **Answered** | Supplied; 9 achievements, writing standard applied (D-13, §2.5) |
| **Q-15** | Is 2026 the right year for the four achievements that had only a month? | **Answered** | Yes — all nine are from 2026 (D-18) |
| **Q-16** | Titles of your works and a one-line result per achievement? Add the four newer achievements to your CV? | **Answered** | No work titles are shown; no extra descriptions needed; CV not updated (D-19) |

---


## 17. Appendices

### Appendix A — Seed content

`docs/seed/content.seed.json` is the machine-readable source of truth for everything in §2 (EN verbatim from the CV; ID drafted with `needsReview: true`; placeholders with `isPlaceholder: true`; **no phone number**). Top-level keys: `settings`, `education`, `experiences`, `achievements`, `projects`, `skills`, `gallery`. `pnpm db:seed` upserts it into Supabase by `slug`; `CONTENT_SOURCE=seed` builds directly from it.

### Appendix B — Zod schemas (`packages/schema`, Zod 4 — verify exact API names in the docs)

```ts
import { z } from 'zod';

export const Localized = z.object({ en: z.string().min(1), id: z.string().optional() }); // site falls back id → en
export const ContentStatus = z.enum(['draft', 'published', 'archived']);
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Base = z.object({
  id: z.uuid().optional(),               // optional in seed, set by DB
  slug: Slug,
  status: ContentStatus.default('published'),
  isPlaceholder: z.boolean().default(false),
  needsReview: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
const Precision = z.enum(['year', 'month', 'day']);

export const AchievementCategory = z.enum(['essay', 'business', 'hackathon', 'ai-ml', 'research', 'certification', 'other']);
export const Proof = z.object({
  kind: z.enum(['certificate', 'photo', 'pdf', 'link']),
  label: Localized.optional(),
  url: z.url().optional(),               // Drive / PDF / external link
  mediaId: z.uuid().optional(),          // uploaded image
}).refine((p) => p.url || p.mediaId, 'url or mediaId is required');

export const Achievement = Base.extend({
  rankLabel: Localized,                  // canonical: "1st Place" | "2nd Place" | "3rd Place" | "Top 4 Finalist" | "Top 10 Finalist"
  rankTier: z.number().int().min(1).max(99).nullable(),
  title: Localized,                      // official event name only (PRD §2.5.1)
  typeLabel: Localized.optional(),       // "Essay Competition", "Hackathon", …
  category: AchievementCategory,
  organizer: z.string().min(1),          // host institution, full official name
  scope: z.enum(['international', 'national', 'regional', 'campus']).nullable(),
  location: z.string().nullable().optional(),          // e.g. "Chiang Mai, Thailand"
  achievedOn: z.string(),                // ISO date, YYYY-MM-01 for month precision
  datePrecision: Precision.default('month'),
  entryType: z.enum(['individual', 'team']).nullable().optional(),
  summary: Localized.optional(),
  highlights: z.array(Localized).default([]),
  tags: z.array(z.string()).default([]),
  coverMediaId: z.uuid().nullable().optional(),
  proofs: z.array(Proof).default([]),    // Dimas adds these later (Q-6)
  galleryMediaIds: z.array(z.uuid()).default([]),
  projectSlug: z.string().nullable().optional(),
  linkConfirmed: z.boolean().optional(),
  featured: z.boolean().default(false),  // shown in the pinned rail
});


export const Experience = Base.extend({
  kind: z.enum(['work', 'organization']),
  organization: z.string(),
  role: Localized,
  location: z.string().nullable().optional(),
  startOn: z.string(), endOn: z.string().nullable().optional(), isCurrent: z.boolean().default(false),
  datePrecision: Precision.default('month'),
  summary: Localized.optional(),
  highlights: z.array(Localized).default([]),
  featuredHighlights: z.number().int().default(3),
  projectSlug: z.string().nullable().optional(),
});

export const Education = Base.extend({
  institution: z.string(), location: z.string().optional(),
  program: Localized, startOn: z.string(), endOn: z.string().nullable().optional(), isExpected: z.boolean().default(false),
  gpa: z.number().min(0).max(4).nullable().optional(), gpaScale: z.number().default(4),
});

export const Project = Base.extend({
  title: Localized, role: Localized.optional(), year: z.number().int().optional(),
  summary: Localized.optional(), body: Localized.optional(),            // markdown
  stack: z.array(z.string()).default([]),
  links: z.array(z.object({ label: z.string(), url: z.url(), kind: z.enum(['demo', 'repo', 'article', 'other']) })).default([]),
  coverMediaId: z.uuid().nullable().optional(), galleryMediaIds: z.array(z.uuid()).default([]),
  featured: z.boolean().default(false), linkedAchievementSlug: z.string().nullable().optional(), linkConfirmed: z.boolean().optional(),
});

export const Skill = Base.extend({
  group: z.enum(['ai', 'web', 'iot', 'tools', 'leadership', 'stack']),
  kind: z.enum(['hard', 'soft']), label: Localized, icon: z.string().optional(),
});

export const GalleryItem = Base.extend({ mediaId: z.uuid().nullable().optional(), caption: Localized.optional(), album: z.string().optional(), achievementSlug: z.string().nullable().optional(), event: z.string().optional(), takenOn: z.string().optional() });

export const ContactInput = z.object({
  name: z.string().trim().min(2).max(80), email: z.email(),
  topic: z.enum(['internship', 'collaboration', 'competition', 'other']).default('other'),
  message: z.string().trim().min(10).max(2000), website: z.string().max(0).optional(), // honeypot
  turnstileToken: z.string().min(1),
});
```

### Appendix C — Supabase migration (core; adapt/extend, keep RLS-first)

```sql
-- 0001_init.sql
create extension if not exists pgcrypto;
create type public.content_status as enum ('draft', 'published', 'archived');

-- Single owner (the only account that may write). Signups are disabled in Auth settings.
create table public.owner (user_id uuid primary key references auth.users (id) on delete cascade);

-- Writes require: user listed in owner AND MFA completed (aal2).
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.owner o where o.user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

create or replace function public.before_write() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;

create table public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,                       -- object path in bucket "media"
  width int not null, height int not null,
  blurhash text, alt jsonb not null,               -- {"en": "...", "id": "..."}
  mime text not null default 'image/webp', bytes int,
  created_at timestamptz not null default now()
);

-- Shared column set for content tables is repeated explicitly (clear > clever).
create table public.projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false, needs_review boolean not null default false,
  sort_order int not null default 0,
  title jsonb not null, role jsonb, year int, summary jsonb, body jsonb,
  stack text[] not null default '{}', links jsonb not null default '[]',
  cover_media_id uuid references public.media (id) on delete set null,
  gallery_media_ids uuid[] not null default '{}',
  featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false, needs_review boolean not null default false,
  sort_order int not null default 0, featured boolean not null default false,
  rank_label jsonb not null, rank_tier smallint,
  title jsonb not null, type_label jsonb,
  category text not null check (category in ('essay','business','hackathon','ai-ml','research','certification','other')),
  organizer text not null,
  scope text check (scope in ('international','national','regional','campus')),
  location text,
  achieved_on date not null, date_precision text not null default 'month' check (date_precision in ('year','month','day')),
  entry_type text check (entry_type in ('individual','team')),
  summary jsonb, highlights jsonb not null default '[]', tags text[] not null default '{}',
  cover_media_id uuid references public.media (id) on delete set null,
  proofs jsonb not null default '[]',                -- [{kind,label?,url?,mediaId?}] — added later by Dimas (Q-6)
  gallery_media_ids uuid[] not null default '{}',
  project_id uuid references public.projects (id) on delete set null,
  link_confirmed boolean,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);


create table public.experiences (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false, needs_review boolean not null default false,
  sort_order int not null default 0,
  kind text not null check (kind in ('work','organization')),
  organization text not null, role jsonb not null, location text,
  start_on date not null, end_on date, is_current boolean not null default false,
  date_precision text not null default 'month' check (date_precision in ('year','month','day')),
  summary jsonb, highlights jsonb not null default '[]', featured_highlights int not null default 3,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);

create table public.education (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false, needs_review boolean not null default false,
  sort_order int not null default 0,
  institution text not null, location text, program jsonb not null,
  start_on date not null, end_on date, is_expected boolean not null default false,
  gpa numeric(3,2), gpa_scale numeric(3,2) not null default 4.00,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);

create table public.skills (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false, needs_review boolean not null default false,
  sort_order int not null default 0,
  group_key text not null check (group_key in ('ai','web','iot','tools','leadership','stack')),
  kind text not null check (kind in ('hard','soft')), label jsonb not null, icon text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false, needs_review boolean not null default false,
  sort_order int not null default 0,
  media_id uuid references public.media (id) on delete set null,
  caption jsonb, album text, event text, taken_on date,
  achievement_id uuid references public.achievements (id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);


-- Singleton; everything in it is public by design (no private notes here).
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  profile jsonb not null, hero jsonb not null, availability jsonb, socials jsonb not null default '[]',
  contact jsonb not null default '{}',            -- { "whatsappNumber": null | "62…", "email": "…" }
  seo jsonb not null default '{}', cv_path text,
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, topic text not null default 'other', message text not null,
  ip_hash text, user_agent text,
  status text not null default 'new' check (status in ('new','read','archived','spam')),
  created_at timestamptz not null default now()
);

create table public.contact_rate (ip_hash text not null, window_start timestamptz not null, hits int not null default 1, primary key (ip_hash, window_start));
create table public.events (name text not null, day date not null, hits int not null default 0, primary key (name, day));
create table public.audit_log (
  id bigserial primary key, at timestamptz not null default now(), actor uuid,
  table_name text not null, row_id text, action text not null, old_row jsonb, new_row jsonb
);
create table public.publish_runs (
  id uuid primary key default gen_random_uuid(), triggered_by uuid, triggered_at timestamptz not null default now(),
  note text, status text not null default 'triggered', placeholders_count int not null default 0, summary jsonb
);

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action, old_row, new_row)
  values (auth.uid(), tg_table_name, coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'), tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- RLS + triggers for the six status-bearing content tables.
do $$
declare t text;
begin
  foreach t in array array['projects','achievements','experiences','education','skills','gallery_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (status = ''published'' or public.is_owner())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_owner())', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_owner()) with check (public.is_owner())', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_owner())', t || '_del', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.before_write()', t || '_bw', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- media + site_settings: public read, owner write.
alter table public.media enable row level security;
create policy media_read on public.media for select to anon, authenticated using (true);
create policy media_write on public.media for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.site_settings enable row level security;
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Private tables: owner only (messages are INSERTED by the Edge Function with the service role).
alter table public.messages enable row level security;
create policy messages_owner on public.messages for all to authenticated using (public.is_owner()) with check (public.is_owner());
alter table public.audit_log enable row level security;
create policy audit_owner_read on public.audit_log for select to authenticated using (public.is_owner());
alter table public.publish_runs enable row level security;
create policy publish_owner on public.publish_runs for all to authenticated using (public.is_owner()) with check (public.is_owner());
-- contact_rate / events: RLS on, NO policies => only the service role (Edge Functions) can touch them.
alter table public.contact_rate enable row level security;
alter table public.events enable row level security;

-- Storage buckets (public read, owner write). Verify against current Supabase Storage policy docs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 5242880,  array['image/webp','image/avif','image/jpeg','image/png']),
  ('docs',  'docs',  true, 10485760, array['application/pdf'])
on conflict (id) do nothing;
create policy storage_owner_write on storage.objects for all to authenticated
  using (bucket_id in ('media','docs') and public.is_owner())
  with check (bucket_id in ('media','docs') and public.is_owner());
```

### Appendix D — Audio processing commands (`tools/audio/`)

```bash
# 1) Per-cue cleanup: mono, 48 kHz, trim leading silence, high-pass 40 Hz, hard-limit, then set the per-cue gain from §7.3
ffmpeg -i raw/hover_tick_1.wav -ac 1 -ar 48000 \
  -af "silenceremove=start_periods=1:start_threshold=-50dB,highpass=f=40,alimiter=limit=0.70" cues/hover_tick_1.wav
# 2) build-sprite.mjs: concatenate cues with 100 ms silence gaps, compute offsets via ffprobe, write sfx.sprite.json {id:[offsetMs,durMs]}
# 3) Encode (WebM/Opus primary, M4A/AAC for Safari, Ogg optional)
ffmpeg -i sprite.wav -c:a libopus -b:a 56k -application audio sfx.sprite.webm
ffmpeg -i sprite.wav -c:a aac -b:a 64k -movflags +faststart sfx.sprite.m4a
# 4) Ambient loop: verify seamlessness (loop point crossfade ≤ 30 ms), encode both formats
ffmpeg -i ambient.wav -c:a libopus -b:a 72k ambient.webm
ffmpeg -i ambient.wav -c:a aac  -b:a 80k -movflags +faststart ambient.m4a
```
Test the format order on real Safari: Howler picks the first playable `src`; if WebM/Opus misbehaves there, list `m4a` first for Safari.

### Appendix E — Lighthouse CI assertions (mobile config; the desktop config uses `preset: "desktop"` with performance ≥ 0.95)

```json
{
  "ci": {
    "collect": { "staticDistDir": "apps/web/dist", "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:performance":    ["error", { "minScore": 0.9 }],
        "categories:accessibility":  ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:seo":            ["error", { "minScore": 1 }],
        "largest-contentful-paint":  ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time":       ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift":   ["error", { "maxNumericValue": 0.05 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 160000 }],
        "resource-summary:font:size":   ["error", { "maxNumericValue": 92160 }],
        "resource-summary:total:size":  ["error", { "maxNumericValue": 460800 }]
      }
    }
  }
}
```
Run against `?mute=1` and the default URL (gate visible). `size-limit` entries: chunk names `core` (28 KB gz), `motion` (80 KB), `webgl` (35 KB), `audio` (20 KB) — set globs to the emitted chunk names.

### Appendix F — Environment variables (`.env.example`; **no real values in git**)

| Variable | Where | Purpose |
|---|---|---|
| `PUBLIC_SITE_URL` | web build | canonical/OG/sitemap base |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web build | read published content (anon/publishable key only) |
| `CONTENT_SOURCE` | web build | `supabase` (prod) or `seed` (local/CI) |
| `STRICT_PLACEHOLDERS` | web build | `1` ⇒ fail build if placeholders remain |
| `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_CONTACT_FUNCTION_URL`, `PUBLIC_TRACK_FUNCTION_URL` | web build | form + events |
| `SEED_WHATSAPP_NUMBER` | local `.env` (git-ignored) only | WhatsApp number injected by `pnpm db:seed` into `site_settings.contact` (HR-10); format `62…` for `wa.me` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | admin build | admin client |
| `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `VERCEL_DEPLOY_HOOK_URL`, `ALLOWED_ORIGINS`, `IP_HASH_SALT` | Supabase function secrets | server-only |
| `AUTHOR_NAME`, `AUTHOR_EMAIL` | GitHub repo variables | authorship guard (HR-1) |
| `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` | GitHub secrets | migrations/functions deploy, keep-alive |

### Appendix G — Implementation skeletons (illustrative; adapt, keep the intent)

```ts
// lib/quality.ts — tier detection + runtime governor
export type Tier = 'static' | 'low' | 'mid' | 'high';
export function detectTier(): Tier {
  const q = new URLSearchParams(location.search).get('tier') as Tier | null;
  if (q && ['static', 'low', 'mid', 'high'].includes(q)) return q;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || nav.connection?.saveData || localStorage.getItem('dp:lite') === '1') return 'static';
  if ((nav.deviceMemory ?? 8) <= 2) return 'static';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  if (coarse) return weak ? 'low' : 'mid';
  return weak ? 'mid' : 'high';              // refine with the frame-time probe during the gate
}
export function createGovernor(onDowngrade: (next: Tier) => void, start: Tier) {
  let tier = start, ema = 16.7, slow = 0, last = performance.now();
  const order: Tier[] = ['static', 'low', 'mid', 'high'];
  return function tick(now: number) {            // call once per frame from gsap.ticker
    const dt = now - last; last = now; ema = ema * 0.9 + dt * 0.1;
    slow = ema > 20 ? slow + 1 : 0;
    if (slow >= 45 && tier !== 'static') { tier = order[Math.max(0, order.indexOf(tier) - 1)]; slow = 0; onDowngrade(tier); }
  };
}
```

```ts
// lib/motion.ts — one clock for Lenis + ScrollTrigger (+ OGL render calls)
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
export function initMotion(tier: 'static' | 'low' | 'mid' | 'high') {
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);
  if (tier === 'mid' || tier === 'high') {
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    return { lenis };
  }
  return {};
}
```

```ts
// lib/audio/engine.ts — lazy chunk (after "with sound")
import { Howl, Howler } from 'howler';
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export async function createEngine(prefs: { enabled: boolean }) {
  const spriteMap = await (await fetch('/audio/sfx.sprite.json')).json();
  const src = isSafari ? ['/audio/sfx.sprite.m4a', '/audio/sfx.sprite.webm'] : ['/audio/sfx.sprite.webm', '/audio/sfx.sprite.m4a'];
  const sfx = new Howl({ src, sprite: spriteMap, volume: 0.6 });
  const ctx = Howler.ctx as AudioContext;
  const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 900;
  // route the ambient element/buffer through `lowpass` → `Howler.masterGain`; map scroll velocity → lowpass.frequency (900…6000 Hz, smoothed)
  let lastHover = 0;
  return {
    play(id: string) {
      if (!prefs.enabled) return;
      if (id === 'hover_tick') { const n = performance.now(); if (n - lastHover < 70) return; lastHover = n; }
      sfx.play(id);
    },
    setEnabled(on: boolean) { prefs.enabled = on; Howler.mute(!on); },
  };
}

// Procedural fallback for a cue that has no licensed file (0 KB download)
export function procTick(ctx: AudioContext, out: AudioNode) {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(1200 + Math.random() * 60, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.04);
}
```

### Appendix H — Glossary

**Gate** boot screen asking for sound consent · **Tier** runtime quality level · **Governor** frame-time watchdog that downgrades tier · **Sprite** one audio file containing many cues · **Placeholder** content not provided by Dimas, flagged in data · **Unlock** the sound+visual moment when an achievement card enters focus · **aal2** Supabase Auth assurance level after MFA · **RLS** Postgres row-level security · **LQIP** low-quality image placeholder.

### Appendix I — `vercel.json` examples (static output; verify the schema in the Vercel docs)

**`apps/web/vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    },
    { "source": "/_astro/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/audio/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

Add the `Content-Security-Policy` from §9.7 to the first block. Audio files must be content-hashed for the `immutable` rule to be safe.

**`apps/admin/vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "no-referrer" }
      ]
    }
  ]
}
```


---

*End of PRD v1.4.*
