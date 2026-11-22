---
title: DenkKern Knowledge Base
type: readme
project: DenkKern
status: active
tags:
  - denkkern
  - readme
  - knowledge-base
---

# DenkKern Knowledge Base

This folder is a cross-tool Markdown knowledge base for DenkKern.

It is designed to work in:

- Obsidian.
- Cursor.
- VS Code.
- Claude Code.
- Codex or other code assistants.

## Start Here

Use [00-index.md](00-index.md) as the main map.

The core operating rules are in [11-knowledge-management-rules.md](11-knowledge-management-rules.md).

The current reference demo story is [10-golden-narrative-case.md](10-golden-narrative-case.md).

The current ICP and GTM direction is [12-icp-and-gtm.md](12-icp-and-gtm.md).

The dashboard UX notes are in [13-dashboard-ux.md](13-dashboard-ux.md).

A consolidated second-brain snapshot is stored in [14-thread-summary-snapshot.md](14-thread-summary-snapshot.md).

The Persian version of that snapshot is stored in [15-thread-summary-snapshot-fa.md](15-thread-summary-snapshot-fa.md).

Converted PDF documents:

- [16-prd-lena-2-0-en.md](16-prd-lena-2-0-en.md)
- [17-prd-lena-2-0-fa.md](17-prd-lena-2-0-fa.md)
- [18-10-day-mvp-plan-en.md](18-10-day-mvp-plan-en.md)
- [19-10-day-mvp-plan-fa.md](19-10-day-mvp-plan-fa.md)

## Format Rules

- Use standard Markdown links: `[label](file.md)`.
- Keep YAML frontmatter at the top of each note.
- Prefer short, focused files over one giant document.
- Preserve contradictions with versioned notes.
- Attribute ideas to Amir, James, Nick / Nic, or AI when clear.

## Tool Notes

### Obsidian

Open this folder as an Obsidian vault. The YAML frontmatter and relative Markdown links should work cleanly.

### Cursor / VS Code

Open this folder as a workspace. The notes are plain Markdown and can be searched, edited, and version-controlled.

VS Code settings live in `.vscode/`. Cursor-specific rules live in `.cursor/rules/`.

### Claude Code

Claude Code should read [CLAUDE.md](CLAUDE.md) first for project instructions.

### Codex / Other Agents

Agents should read [AGENTS.md](AGENTS.md) first for update rules.

## Do Not Overbuild

The active strategic rule is:

> Stop refining architecture. Validate customer evidence.

## Application workspace

This repository also contains an application under `apps/web` and shared TypeScript packages under `packages/`.
Use Node.js 22 and npm with the committed root `package-lock.json`:

```sh
npm ci
npm run dev
npm run type-check
npm test
npm run build
```

The development server defaults to http://localhost:3000. Turbo coordinates workspace tasks.
Local dependencies use npm-compatible file references. Package scripts are the source of truth for available tasks.
The knowledge base above describes product intent; it is not evidence that every feature is implemented or production-ready.
Do not put personal data or unredacted internal/client notes in this public repository.
Project licensing remains to be selected by the owner.

### Verified maintenance update (AI, 2026-11-22)

The application workspace now uses Next.js 16.4.6, React 19.3.1 and Vitest 5.1.1.
Dynamic route/page params are awaited for the current Next.js API. npm-compatible workspace references,
Turbo task ordering and the root lockfile are coordinated. Standard lint replaces the removed next lint command.
Regression fixes cover empty route matching, normalized weather IDs/route labels, mock shipment identity,
fixture paths and outdated test setup. Historical CASE-001 evidence uses a fixed fixture date; it is not live operational evidence.
Outcome confirmation tokens are no longer written to console logs.

CI installs the committed lockfile and runs audit, lint, type checking, unit tests and production build.
This remains a demo with simulated data. Passing checks do not validate real maritime predictions,
production access controls or operational freshness. No live API, production deployment or data migration was performed.
