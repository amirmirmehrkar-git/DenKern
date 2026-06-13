---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Obsidian vs Notion (Recommended Split)

Yes, using Obsidian for your personal thinking system is a very good idea.

Best split:

- Notion = team source of truth
- Obsidian = personal thinking system
- GitHub = code / contracts
- Figma = UI
- Claude Code = execution

## Notion (Team)

Keep only the shareable, aligned artifacts:

- PRD
- interview notes
- target customers
- MVP status
- decisions
- GTM pipeline

## Obsidian (Personal)

Keep your internal thinking and analysis:

- raw ideas
- analysis of James/Nick messages
- questions you are still unsure about
- meeting summaries
- links between concepts
- notes like "why we decided this"

## Simple Obsidian Folder Structure

```text
DenkKern/
  00 Inbox
  01 Daily Notes
  02 Product Thinking
  03 Team Discussions
  04 Customer Discovery
  05 Architecture Notes
  06 Decisions
  07 Risks & Questions
  08 Prompts
  99 Archive
```

## Rule (Avoid Two Sources of Truth)

When something in Obsidian becomes "team-ready", move it into Notion.

- Obsidian = private thinking
- Notion = shared alignment

## Practical Note Linking (Examples)

Create one note per major topic and link them:

- `Lena 2.0 MVP`
- `Cost-of-delay risk`
- `James model assumptions`
- `Nick customer validation`
- `MVP vs Future`
- `Scenario engine`
- `Financial impact engine`

Example links:

```text
[[Cost-of-delay risk]]
[[Scenario engine]]
[[Nick customer validation]]
```

