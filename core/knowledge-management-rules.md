---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Knowledge Management Rules

These rules govern how future DenkKern chat notes should be written into this folder.

## Update Existing Files First

If new information belongs to an existing topic, update that topic's Markdown file.

Examples:

- New Lena scenario detail -> `02-lena-2-mvp.md` or `10-golden-narrative-case.md`.
- New scenario logic -> `04-mvp-scenarios.md`.
- New JSON / backend contract detail -> `05-architecture-and-contracts.md`.
- New customer validation insight -> `07-validation-strategy.md`.

## Create New Files For New Topics

If a new conversation introduces a genuinely new subject, create a new Markdown file with the next numeric prefix.

## Preserve Contradictions With Versions

Do not delete older information when new information contradicts it.

Use this pattern:

```text
Version 1: older statement.
Version 2: newer statement.
Resolution status: unresolved / resolved.
```

Only mark a version as resolved when the user explicitly decides which one is canonical.

## Attribution

Track who says or owns information when possible:

- Amir: product/system logic and the current user in these chats.
- James: maritime data, prediction, calibration, and model output.
- Nick / Nic: customer discovery, GTM validation, interviews, pricing, and pilot evidence.
- AI: fourth collaborator, synthesis, critique, and writing partner.

Most chats are between Amir and AI. Amir may quote or summarize James or Nick. Preserve that context where it is visible.

## Active Operating Rule

Stop refining architecture. Validate customer evidence.

## MVP Discipline

If it does not help validate the first pilot, it is not MVP.
