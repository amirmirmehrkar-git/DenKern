# Interview Strategy and Customer Discovery

## Overview
Effective customer discovery is the foundation of product-market fit. This document captures Nahid's guidance on structuring interviews, reducing bias, and validating market assumptions through direct customer conversations.

## Core Interview Approach

### Individual vs. Group Interviews
**Recommendation: Conduct individual interviews**

Group interviews create several problems:
- **Groupthink bias**: Dominant personalities shape discussion; quiet potential users don't speak up
- **Social conformity**: Participants agree with group consensus rather than expressing honest pain points
- **Incomplete stories**: Group dynamics fragment individual narratives
- **Authority bias**: If a senior person speaks, others defer

Individual interviews:
- Reveal authentic pain points and workarounds
- Allow deep exploration of use cases specific to that person's role
- Build trust for honest feedback
- Uncover hidden assumptions about customer needs

### Recording Strategy
Record all interviews (with consent) for multiple reasons:
- Allows focus on listening rather than note-taking
- Enables team review and collective learning
- Captures nuance, tone, and hesitations that notes miss
- Prevents selective memory or misinterpretation

**Process:**
1. Ask permission explicitly before recording
2. Transcribe key interviews for reference
3. Share recordings/transcripts with team
4. Use recordings in team sync to align understanding

## Reducing Interview Bias

### The "Consistent Customer Role" Principle
Interview targets with **consistent roles** across different companies, not a broad sample:

**Why this matters:**
- A warehouse manager at Company A faces similar constraints as a warehouse manager at Company B
- Comparing across different roles (manager vs. operator vs. planner) introduces noise
- Consistent role = consistent pain points = patterns emerge faster

**Example structure for Mittelstand freight forwarders:**
- Interview 5-7 Operations Managers at different forwarders
- Interview 5-7 Planning Leads at different forwarders
- Interview 5-7 Customer Service Leads at different forwarders
- Don't mix roles in one sample cohort

**Benefit:** You learn the true pattern for that role across the market, not confounded by organizational differences.

### Bias Reduction Techniques

**Leading questions to avoid:**
- "Don't you find [our assumed pain] really frustrating?" → Customer agrees to be polite
- "How much would you pay for a solution that does X?" → Anchoring bias inflates willingness-to-pay
- "Would you use this if it existed?" → Social desirability bias

**Better approach:**
- Ask about current workflows: "Walk me through how you handle [process]"
- Ask about costs: "Where do you spend the most time/money right now?"
- Ask about failures: "Tell me about a time this process broke down"
- Ask about workarounds: "How did you solve it?"

**Critical principle:** Let customers describe their world; don't sell them a vision.

## Interview Structure Template

### Pre-Interview
- Identify specific role (e.g., Operations Manager, Planning Lead)
- Research company context briefly (size, industry, logistics focus)
- Prepare 5-7 open-ended questions about their current process
- Do NOT prepare product questions

### During Interview (45-60 min)
1. **Trust building (5 min):** Explain purpose (learning about their logistics operations), assure confidentiality
2. **Current state (20 min):** Ask them to walk through their typical day/process
3. **Problem exploration (15 min):** Ask where it breaks, what costs them money/time, what frustrates them
4. **Workarounds (10 min):** How do they currently solve the problems they mentioned?
5. **Closing (5 min):** Any other challenges? Can they refer others in their role?

### Post-Interview
- Transcribe or summarize within 24 hours (while fresh)
- Flag surprising insights
- Note contradictions with previous interviews
- Identify patterns across multiple interviews in same role

## Customer Segment Selection: The Consistent Role Approach

### Mittelstand Focus (Recommended Starting Point)
**Target role:** Operations Manager or Planning Lead at freight forwarders (10-100 employees)

**Why this role in this segment:**
- Large enough to have dedicated operations (unlike small forwarders with 2-3 people)
- Small enough to make decisions without committee (unlike enterprise with steering groups)
- Direct exposure to pain points (demurrage, delays, regulatory changes)
- Willing to adopt new tools if ROI is clear

**Interview cohort:** 7-10 Operations Managers at German/European freight forwarders

### Pharmaceutical/Chemical Sector Variant
**Additional target role:** Compliance or Regulatory Lead at pharma forwarders

**Why this role:**
- Highest willingness-to-pay (regulatory compliance = non-negotiable)
- Clearest ROI (CBAM penalties, Secure Release Orders)
- Concentrated in Hamburg, Amsterdam, Rotterdam (geographic advantage)

## Key Learnings to Validate

### Learning 1: Unstructured Data Problem
**Hypothesis:** 60-80% of critical logistics data (customs documents, inspection certificates, delay notifications) arrives via email or PDF, not system-to-system APIs

**Validation questions:**
- "Where do you get information about [specific shipment status]?"
- "How many times do you manually re-enter data from a document?"
- "What happens when a critical email gets missed?"

### Learning 2: Cost Concentration at Port-to-Hinterland Interface
**Hypothesis:** Demurrage and detention costs concentrate at the handoff between port operations and inland logistics (drayage)

**Validation questions:**
- "Where in the shipment journey do you lose the most money?"
- "What happens between port delivery and when the container is empty again?"
- "Who pays demurrage, and how often does it happen?"

### Learning 3: Willingness-to-Pay Ceiling
**Hypothesis:** Mittelstand freight forwarders will pay €15K-40K/month for decision support that reduces demurrage by 20-30%

**Validation questions:**
- "How much demurrage do you pay annually?"
- "If you could cut that by 25%, how would that change your business?"
- "What's the highest price you'd consider for that benefit?"

## Red Flags During Interviews

**Watch for:**
- Customer describes a problem but has no cost estimate for it (may not be worth solving)
- Customer says they'd definitely buy it, but can't commit to a pilot (unlikely buyer)
- Customer compares you to a competitor that doesn't actually exist (solution-seeking bias, not problem-experiencing)
- Customer is making a recommendation for someone else (they're reselling, not solving their own problem)

## Next Steps

1. **Identify 2-3 pilot companies** (Mittelstand freight forwarders with pharma focus)
2. **Schedule 7-10 individual interviews** with Operations Managers at different companies
3. **Prepare interview guide** with open-ended questions about their current process
4. **Assign interview ownership** across team (James, Nick, or Amir each conducts some)
5. **Document findings** in consistent template for cross-interview pattern recognition
6. **Validate three hypotheses** (unstructured data, cost concentration, willingness-to-pay)

---

**Last Updated:** 2026-05-15  
**Mentor:** Nahid  
**Team:** DenkKern Product Strategy
