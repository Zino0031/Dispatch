---
name: image-to-code-pro
description: Implement production-grade frontend from a high-fidelity visual reference using a mandatory image-first workflow. Use when given a screenshot, mockup, or design image to reproduce, or when asked for "pixel-faithful" implementation.
metadata:
  author: kiosk-project
  version: "1.0.0"
  argument-hint: <image-path-or-description>
---

# Image-to-Code Pro

Mandatory image-first workflow (after nexu-io/open-design "Image-to-Code Pro"):
no code before a studied reference.

## How It Works

1. **Reference first.** Obtain the design image (user-provided file, URL, or a
   `playwright-cli screenshot`). If only a description exists, generate the
   reference image first and get it approved — never skip this step.
2. **Study closely.** Inventory layout skeleton, spacing rhythm, type scale,
   palette roles, component states, and responsive behavior. Write the
   inventory down before coding.
3. **Implement to match.** Build section by section against the inventory.
   Large readable references only — never crop tiny compressed boards.
4. **Verify visually.** Screenshot the result (`playwright-cli`) and diff
   against the reference side by side; fix deviations, repeat until faithful.

## Rules

- Image first, code second — no exceptions, no placeholders.
- One faithful implementation beats three approximate variants.
- Combine with `web-design-guidelines` for accessibility compliance.
