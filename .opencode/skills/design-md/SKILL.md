---
name: design-md
description: |
  Create and manage DESIGN.md files. Useful for capturing design direction, tokens, and visual rules in a single source of truth.
triggers:
  - "design.md"
  - "design doc"
  - "design tokens doc"
  - "visual rules doc"
---

# design-md

> Adapted from OpenDesign (`skills/design-md`, curated from Google Labs Stitch).

## What it does

Create and manage DESIGN.md files. Useful for capturing design direction, tokens, and visual rules in a single source of truth.

## How to use

1. Pick a reference design language: either write a `DESIGN.md` from scratch
   following Google's Stitch DESIGN.md spec (theme, palette + roles, type
   hierarchy, components with states, layout/spacing, depth, do's/don'ts,
   responsive behavior), or copy one from the catalogs below.
2. Drop the `DESIGN.md` into the project root (or `apps/web/` for this repo).
3. Tell the coding agent to build the page in that visual language and to keep
   every new screen consistent with the tokens and rules in the file.
4. When restyling, audit-first: list what breaks the DESIGN.md before changing.

## Design sources

- **awesome-design-md** (https://github.com/voltagent/awesome-design-md):
  100+ ready-to-use `DESIGN.md` files extracted from real sites (Linear,
  Vercel, Stripe, Airbnb, Spotify, …) under `design-md/`, each with
  `preview.html` / `preview-dark.html` catalogs. MIT licensed.
- **getdesign.md catalog** (https://getdesign.md/design-md): 550+ DESIGN.md
  analyses with the same Stitch-format sections (visual theme, palette + roles,
  typography, components, layout, depth, do's/don'ts, responsive, agent prompts).
- **Upstream skill**: https://github.com/google-labs-code/skills
