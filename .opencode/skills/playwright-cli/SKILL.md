---
name: playwright-cli
description: Drive a real browser from the shell for testing and reviewing web UI. Use when asked to open a page, click through a flow, take screenshots, inspect console errors, or verify a wizard end to end. Token-efficient CLI with snapshot refs; prefers headed mode for review, headless for CI.
---

# Playwright CLI

Command-line browser automation designed for coding agents. Concise output,
snapshot refs for deterministic interaction, persistent daemon browser.

Source: https://playwright.dev/agent-cli/introduction

## Setup

```bash
npm install -g @playwright/cli
playwright-cli install        # browsers
playwright-cli open <url> --headed   # headed for visual review, headless for CI
```

After each command the CLI prints the page URL/title plus a snapshot file
(`.playwright-cli/page-*.yml`) holding the accessibility tree with element
refs (`e21`, …) used as targets by the next command.

## Core loop

```
open <url> → snapshot → click|fill|type|check <ref> → snapshot → screenshot
```

- `goto <url>`, `reload`, `go-back`, `go-forward`, `tab-new`, `tab-select`
- `click|dblclick|hover|fill|type|select|check|uncheck|press <ref>`
- `snapshot [target]`, `find [text]`, `eval <func> [target]`
- `screenshot [target]`, `pdf`, `console [min-level]`
- `state-save [file]` / `state-load <file>` for authenticated sessions
- `--json` for machine-readable output; sessions via `-s=<name>`, `list`, `close-all`

## Rules for this repo

- Review `apps/web` flows against the loaded page, not the code: open
  `http://localhost:3000`, walk the wizard, screenshot each step.
- Prefer headed mode when the user wants visual review; headless in scripts.
- Save state files outside the repo (`/tmp`) — never commit auth state.
- Check console errors on every pass; report findings as `file:line` where the
  cause is known, otherwise as observed page behavior.
