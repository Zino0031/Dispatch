---
name: design-md
description: Apply a real brand's visual language via a DESIGN.md file (Google Stitch format). Use when asked to "match a reference site", "use a DESIGN.md", "style like Linear/Stripe/Vercel", or when a UI needs a coherent non-generic design system.
metadata:
  author: kiosk-project
  version: "1.0.0"
  argument-hint: <brand-or-url>
---

# DESIGN.md Workflow

DESIGN.md is a plain-text design system (Google Stitch spec) that agents read
to generate consistent UI: colors, type, spacing, components, reasoning.
Sources: catalog at https://getdesign.md (550+ analyzed sites) and
https://github.com/voltagent/awesome-design-md (`design-md/` folder).

## How It Works

1. Pick the reference: ask the user for a brand, or suggest one close to the
   product mood (e.g. Linear for dev tools, Mercury for fintech).
2. Fetch its DESIGN.md (`https://getdesign.md/<brand>/design-md`) and save it
   as `DESIGN.md` in the project root (one file per project).
3. Build UI strictly from its tokens: palette hexes + roles, type hierarchy,
   spacing scale, component states, do's/don'ts. Do not mix in other systems.
4. On redesigns: audit the existing UI against the DESIGN.md first, then
   change only what violates it.

## Rules

- DESIGN.md is the authority for look-and-feel; `AGENTS.md` stays the authority
  for how to build.
- Never commit brand assets (logos, proprietary fonts) — tokens only.
- If no reference fits, fall back to the `web-design-guidelines` skill.
