---
name: playwright-cli
description: Drive a real browser via Playwright CLI for visual verification, screenshots, and interaction testing. Use when asked to "check the page visually", "screenshot", "test in a browser", or to verify UI work end-to-end.
metadata:
  author: kiosk-project
  version: "1.0.0"
  argument-hint: <url-or-task>
---

# Playwright CLI

Token-efficient browser automation for coding agents (https://playwright.dev/agent-cli/introduction).
Run with `npx -p @playwright/cli playwright-cli <cmd>` (0.1.22 verified).
First run needs a browser: `playwright-cli install-browser chromium`.

## Core Loop

```
playwright-cli open http://localhost:3000 --headed
playwright-cli snapshot            # accessibility tree with element refs
playwright-cli click e12           # act on refs, never coordinates
playwright-cli type "hello"        # then press Enter
playwright-cli screenshot          # verify visually
```

## Command Reference

- Navigate: `goto <url>`, `go-back`, `go-forward`, `reload`
- Interact: `click/dblclick/hover <ref>`, `fill <ref> <text>`, `type <text>`,
  `press <key>`, `check/uncheck <ref>`, `select <ref> <val>`, `upload <files>`
- Tabs: `tab-list`, `tab-new [url]`, `tab-select <i>`, `tab-close [i]`
- State: `snapshot [ref]`, `find [text]`, `eval <fn> [ref]`, `console [level]`
- Capture: `screenshot [ref]`, `pdf`, `video-start [file]` / `video-stop`
- Storage: `cookie-list/get/set`, `localstorage-*`, `sessionstorage-*`
- Network: `requests`, `route <pattern>` (mock), `network-state-set <state>`
- Sessions: `-s=<name> <cmd>`, `list`, `close-all` (isolated state per session)
- Flags: `--json`, `--version`

## Rules

- Prefer refs from `snapshot` over x/y coordinates.
- Use a named session (`-s`) per test to keep state isolated.
- Point at local dev servers (`apps/web` on :3000); never record real credentials.
