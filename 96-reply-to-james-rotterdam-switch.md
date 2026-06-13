---
title: Reply to James - Switching Amsterdam to Rotterdam
type: template
project: DenkKern
status: active
owner: Amir
tags:
  - comms
  - james
  - ports
  - mvp
---

# Reply to James (Copy/Paste)

```text
Hey James — great that the port traffic data is working now.

Switching the demo port from Amsterdam to Rotterdam should be straightforward. It’s mostly updating the port input/feed + any feature extraction that references the port, and then updating the mock scenario labels.

The prediction JSON contract and scenario/recommendation logic can stay the same. We just re-run the pipeline with Rotterdam as the port context.
```

