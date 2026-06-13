---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Tooling Roles (Best Setup)

Best setup for DenkKern right now:

- GitHub = code + contracts + versioning
- Notion = product knowledge + research + interviews (team workspace)
- Figma = UI design source of truth
- Claude Code = builder / coding assistant

Key rule: each tool has a clear role. Do not copy everything everywhere.

## GitHub (Repo) - Executable + Versioned

Put in the repo:

- schemas / contracts
- frontend code
- mock data
- README
- technical ADRs

Suggested repo layout:

```text
denkkern-mvp/
  PROJECT_CONTEXT.md
  README.md

  contracts/
    prediction/
    customer/
    freight/
    scenario-engine/
    dashboard/
    api/
    architecture/

  data/
    mock-dashboard.json

  app/
  components/
  lib/
```

## Notion (Team) - Knowledge + Research

Use Notion for:

- PRD
- interview notes
- market map
- open questions
- target customers
- pipeline / GTM
- product/business decisions

Suggested workspace structure:

```text
DenkKern Workspace
  01 Product
    PRD
    Lena 2.0 Use Case
    User Journey
  02 Research
    Customer Interviews
    Market Map
    Open Questions
  03 GTM
    Target Companies
    Pricing Hypotheses
    Pilot Pipeline
  04 Decisions
    ADRs
    Risks
    MVP vs Future
```

## Figma - Visual Source of Truth

Keep UI designs in Figma. Claude Code can implement them after.

## Claude Code - Execution Engine

Claude reads:

- repo files (contracts, mock data, context)
- Figma designs (optionally via integration)
- selected Notion pages (optionally via integration)

Then Claude builds code for the MVP.

