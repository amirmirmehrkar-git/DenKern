---
title: Obsidian Workflow - Template + Examples (Notion Input -> Personal Analysis)
type: note
project: DenkKern
status: active
owner: Amir
tags:
  - obsidian
  - workflow
  - template
  - notes
---

# Obsidian Workflow (Best Use)

Yes: this is the best use of Obsidian.

```text
Notion = team decisions + shared truth
Obsidian = your personal analysis of those decisions
```

Important: do not copy all of Notion into Obsidian. Only bring:
summary, insight, decisions, key questions, and the pieces that affect the product.

## What To Import From Notion (Only)

- PRD (short summary)
- key team decisions
- James/Nick statements that affect the product
- open questions
- risks
- customer interview insights
- MVP scope changes
- important changes

Avoid importing raw full pages verbatim.

## Obsidian Note Template (Use Per Topic)

```text
# Note Title

## Source
Notion / Slack / Team discussion / Miro

## What was said?
Neutral summary of what the team said.

## My interpretation
What do I think this actually means?

## Product impact
How does this affect MVP / PRD / UI / backend?

## Risk
What could go wrong?

## My next action
What should I do next?

## Linked notes
[[Lena 2.0 MVP]]
[[Scenario Engine]]
[[Cost of Delay]]
```

## Example - James (ML)

```text
# James - Local Model Training

## What was said?
James wants to keep training data and model training local, and only export final prediction JSON to contracts/prediction.

## My interpretation
This is fine for MVP. We do not need to force backend integration now.

## Product impact
We only need a stable prediction output contract.

## Risk
If output fields keep changing, frontend/backend integration may break.

## My next action
Keep prediction contract simple and align with James once model output is clearer.
```

## Example - Nick (GTM / Discovery)

```text
# Nick - Hamburg SME Market List

## What was said?
Nick created a broad list of Hamburg SMEs across aerospace, chemicals, machinery, medical devices, coatings, and more.

## My interpretation
Useful for discovery, but too broad for MVP scope.

## Product impact
We should not build for all sectors now. MVP remains Lena 2.0.

## Risk
Team may drift back into generic platform thinking.

## My next action
Use the list for interviews, but keep product scope frozen.
```

## Suggested Obsidian Folder Structure (Personal)

```text
DenkKern/
  00 Inbox
  01 Team Notes
  02 My Product Analysis
  03 James - ML Notes
  04 Nick - GTM Notes
  05 Decisions
  06 Risks
  07 Customer Discovery
  08 Prompts
  99 Archive
```

## Golden Rule

Everything you write in Obsidian should produce at least one of:

- Decision
- Risk
- Question
- Action
- Insight

If it produces none of these, it is probably not worth keeping.

## Bottom Line

Use Notion as input.
Use Obsidian as your thinking engine.
Then push only the matured outputs back to Notion / the team.

