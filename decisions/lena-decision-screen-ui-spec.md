---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# DenkKern - Lena Decision Screen (UI Design Spec)

Source: Amir provided a buildable, Figma-style UI spec derived from the Lena decision wireframe.

Goal: a screen that enables a decision in under 30 seconds, not data exploration.

## Layout Structure

```text
[ TOP BAR ]
[ SUMMARY CARD ]
[ SCENARIO CARDS (3 columns or stacked) ]
[ RECOMMENDATION PANEL ]
[ RISK DETAILS (collapsible) ]
[ ACTION BUTTONS ]
```

## 1) Top Bar

Left:

- Ship icon + shipment name: Marine Bolts Shipment
- Subtext: Hamburg Production Line

Right:

- Risk badge: HIGH RISK (red)

## 2) Summary Card

Card style:

- Background: #F7F7F7
- Border radius: 12px
- Padding: 16px

Content: 4-column metric grid

| Metric | Value |
| --- | --- |
| ETA | May 15 |
| Delay Probability | 60% |
| Worst Case | May 20 |
| Daily Loss | EUR 150k |

## 3) Scenario Cards (Core UI)

Style:

- White background
- Shadow
- Rounded corners: 16px
- Padding: 20px

Layout:

- Desktop: 3 columns
- Mobile: stacked cards

### Option 1 - Wait

- Title: Wait for Shipment
- Badge: High Risk

Content:

- Delay: 5 days
- Action cost: EUR 0
- Production loss: EUR 750k
- Total cost: EUR 750k

### Option 2 - Expedite

- Title: Expedite from Amsterdam
- Badge: Medium Risk

Content:

- Delay: 2 days
- Action cost: EUR 200k
- Production loss: EUR 300k
- Total cost: EUR 500k

### Option 3 - Replacement (Highlighted)

- Title: Order Replacement Parts
- Badge: Low Risk
- Highlight: green glow border
- Label: Recommended

Content:

- Delay: 0 days
- Action cost: EUR 500k
- Production loss: EUR 0
- Total cost: EUR 500k

Visual emphasis:

- Slightly larger card or stronger border treatment.

## 4) Recommendation Panel

Style:

- Background: #EAF7EE
- Icon: checkmark

Content:

- Headline: Recommended Action: Order Replacement Parts
- Reasons:
  - Avoids EUR 750k loss
  - Saves EUR 250k vs waiting
  - Eliminates delay risk

## 5) Risk Details (Collapsible)

Title: How this was calculated

Expanded content:

- 40% -> on-time arrival (EUR 0 loss)
- 60% -> 5-day delay (EUR 750k loss)
- Expected loss (Wait): EUR 450k

## 6) Action Buttons

Primary (green):

- Order replacement parts

Secondary:

- Expedite shipment
- Wait

## Visual Hierarchy (Must Be Obvious Instantly)

User should immediately understand:

1. There is a risk
2. This is the cost
3. This is what to do

## UX Principle

This UI is for deciding, not thinking.

Intentionally omitted:

- Graphs
- Charts
- ML complexity
- Workflow builder

Team one-liner:

> The UI is designed to make a decision in under 30 seconds, not to explore data.

