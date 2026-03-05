---
name: yarion-maintenance
description: Maintain and evolve the Yarion app (vanilla JS + Node HTTP server with JSON persistence). Use when updating UI/UX, report, state model, autosave, formatting, mobile/desktop responsiveness, PWA assets, or server API in this repository while preserving current behavior and avoiding layout regressions.
---

# Yarion Maintenance

Use this workflow to make safe incremental changes in Yarion.

## Current Architecture

- Backend: `server.js` using native `http` module.
- API: `GET /api/state` and `POST /api/state`.
- Data: `data/tracker.json` (local JSON persistence).
- Frontend pages:
  - `public/index.html` + `public/app.js`
  - `public/report.html` + `public/report.js`
  - `public/styles.css`
- PWA: `public/site.webmanifest` and `public/icons/*`.

## Baseline Behavior To Preserve

- Autosave persists state to JSON without manual save button.
- Weekly summary cards in two columns on desktop.
- Extra real-time card: `Consistência` (read-only, derived from entries).
- Number formatting rules:
  - decimal comma (`56,5`)
  - percentages without decimal places (`98%`)
  - `Academia` as integer
  - ratio label without spaces (`4/4 sessão`)
- Mobile week picker shows compact `DD/MM/AAAA` while keeping native date input underneath.
- Report top layout:
  - first line: label + week picker + back button
  - second line: Export PDF button
- Server listens on `0.0.0.0:3080` by default.

## Required Working Method

1. Edit files directly in place; avoid proposal-only responses when change is requested.
2. Keep mobile and desktop layout stable unless the request explicitly changes layout.
3. After edits, verify at least:
   - server start (`npm start`)
   - API response (`/api/state`)
   - no obvious JS syntax errors
4. Report exactly which files changed and the concrete technical effect.
5. Never commit real user data from `data/tracker.json`; use `data/tracker.example.json` for tracked examples.

## Quick Change Checklist

- If touching formatting, validate both app and report formatters.
- If touching layout/CSS, check breakpoints and report header arrangement.
- If touching data model, keep API payload compatibility (`activities` and `weeks` required).
- If touching PWA assets, keep manifest/icon paths consistent.
