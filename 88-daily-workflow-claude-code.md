---
title: Daily Workflow (Notion -> Figma -> Repo -> Claude Code)
type: note
project: DenkKern
status: active
owner: Amir
tags:
  - workflow
  - daily
  - claude
  - git
---

# Daily Workflow (Recommended)

The clean daily loop:

1) Product/research in Notion
2) UI in Figma
3) Code/contracts in GitHub repo
4) Claude Code reads:
   - `PROJECT_CONTEXT.md`
   - `contracts/`
   - Figma design (if connected)
   - selected Notion pages (if connected)
5) Claude builds code
6) You review changes
7) Git commit + push

## GitHub Workflow (Simple and Safe)

Best for MVP: run Claude Code inside the local repo, then use git manually:

```text
git status
git add .
git commit -m "..."
git push
```

Reason: clearer, safer, and you stay in control.

## Context Hygiene Rule

Do not dump full chat logs into Claude.

Instead keep 2-3 curated context files in the repo:

- `PROJECT_CONTEXT.md`
- `PRD_SUMMARY.md`
- `MVP_CONTRACTS.md`

Then connect Claude to Notion/Figma for the rest when needed.

