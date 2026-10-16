---
name: getdesign
description: Use a DESIGN.md from the getdesign.md catalog as the visual language for a build. Use when the user names a reference site, wants to match a brand, or needs a reusable design brief. Covers picking a catalog entry, vendoring its DESIGN.md, and building/restyling against it.
---

# getdesign

Give AI-built pages a real design by handing the agent a DESIGN.md reference:
colors, type, spacing, components, and the reasoning behind them.

Source: https://getdesign.md (catalog at https://getdesign.md/design-md,
upstream collection https://github.com/voltagent/awesome-design-md).

## Workflow

1. **Pick the reference.** Browse https://getdesign.md/design-md and choose the
   site whose visual language fits the brief (each entry lists the defining
   traits, e.g. Linear = ultra-minimal + purple accent, Vercel = black/white
   precision + Geist). For a private/brand-specific brief, request a custom one
   at https://getdesign.md/request.
2. **Vendor it.** Fetch the entry's `/design-md` page and save the DESIGN.md
   content as `DESIGN.md` in the project root (or `apps/web/` here). Keep the
   Stitch-format sections intact: visual theme, palette + roles (name + hex +
   role), typography hierarchy, component stylings with states, layout/spacing
   scale, depth system, do's and don'ts, responsive behavior, agent prompts.
3. **Build against it.** Instruct the agent: implement the requested page using
   only the tokens, type scale, components, and rules in `DESIGN.md`; every new
   screen must stay in the same visual language. No generic substitutes.
4. **Restyle or review.** For existing UI: audit the current screens against the
   DESIGN.md first (list violations per section), then restyle.
5. **Stay consistent.** Reuse the same DESIGN.md as the brief for every
   follow-up page so the whole surface shares one language.

## Rules

- Tokens before values: no hardcoded colors, fonts, or spacing that contradict
  the DESIGN.md.
- Do not invent components the DESIGN.md forbids; follow its do's and don'ts.
- Keep the file in the repo so future work and other agents reuse it.
