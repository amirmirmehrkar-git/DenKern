---
type: operational
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# شبیه‌سازی Legal AI Agent (قرارداد -> Decision JSON)

Source: Amir provided an archived-chat requirement: برای تصمیم‌هایی مثل reroute / deviation، سیستم باید قرارداد حمل را بفهمد و یک Legal AI Agent خروجی قابل دفاع بدهد.

## هدف ایجنت

تبدیل متن قرارداد + وضعیت حادثه به خروجی ساختاریافته‌ای که پاسخ دهد:

- آیا تغییر مسیر (deviation / reroute) طبق قرارداد مجاز است؟
- آیا Force Majeure / War Risk / Perils of the Sea قابل استناد است؟
- چه notice / notification لازم است (deadline، گیرنده، محتوای لازم)؟
- ریسک مسئولیت مالی / penalty / demurrage چیست؟
- اقدام بعدی پیشنهادی چیست (draft notice، escalation، گرفتن تایید کتبی)؟

نکته: این ایجنت تصمیم نهایی نمی‌دهد؛ فقط constraints و next steps را ساختار می‌دهد.

## ورودی‌های لازم (Inputs)

1. Contract text(s):
   - SLA / booking confirmation
   - B/L یا rider clauses در صورت وجود
2. Incident summary:
   - نوع حادثه: weather / strike / war-risk / geopolitical
   - timestamp
   - location (اگر دارید: GeoJSON / Incident PDF)
3. Shipment facts:
   - cargo type / criticality
   - penalty per day
   - current ETA window
   - planned action (wait / reroute / alt port / split airfreight)
4. Optional evidence pack:
   - carrier advisory
   - port notices
   - security bulletins

## سوال‌های Lena از Legal Agent (برای UI/Prompt)

Must-ask:

- Route change مجاز است؟ طبق کدام clause؟
- Notice deadline چیست؟ باید به چه کسی و با چه فرمی ارسال شود؟
- آیا Force Majeure شامل این رویداد می‌شود (war vs strike vs weather)؟
- آیا Perils of the Sea / weather مسئولیت تاخیر را محدود می‌کند؟
- penalty exposure چقدر است و چه چیزهایی آن را کم/زیاد می‌کند؟
- demurrage به عهده کیست و چه استثناهایی دارد؟

## Prompt بسته آماده (Copy/Paste)

### 1) Role Prompt

You are the Legal Decision Support Agent for logistics disruption decisions.

Input:
- Contract text(s)
- Incident summary (geopolitical + weather)
- Shipment/fleet facts (ETA, penalty per day, cargo criticality, value)
- Planned action (reroute / wait / alternative port / airfreight split)

Task:
Extract the relevant clauses, interpret them conservatively, and output a machine-readable JSON:
- permission_status for reroute/deviation
- force_majeure_applicability
- notice_requirements (deadline, recipient, content)
- liability_exposure (penalties/demurrage) as ranges
- recommended_legal_next_steps
- draft_notice_email (short)
- confidence + open questions for human counsel

Rules:
- Cite clause numbers and quote only short excerpts.
- If uncertain, mark "REQUIRES_HUMAN_COUNSEL".
- Do not give legal advice; provide decision support and questions.

### 2) Common-Sense Consistency Checker Prompt

Check the legal JSON for contradictions:
- If notice_required then deadline must exist.
- If force_majeure=false but liability_exempt=true, flag inconsistency.
- If penalties are mentioned, include calculation basis.
Return corrected JSON + flags.

## JSON خروجی نمونه (Reroute / War Risk)

این نمونه برای تصمیم `REROUTE_AROUND_CAPE` نوشته شده و شامل:

- key clauses + interpretation
- decision assessment (permission + notice)
- liability exposure ranges
- recommended next steps
- draft notice email
- confidence + questions for counsel

نمونه:

```json
{
  "legal_report_id": "LEGAL-20240103-1015-PS-001",
  "generated_at_utc": "2024-01-03T10:15:00Z",
  "inputs": {
    "contract_ids": ["LSA-2026-A1"],
    "vessel": "Pacific Star",
    "cargo": "EV Battery Cells",
    "value_eur": 28000000,
    "penalty_per_day_eur": 100000,
    "planned_action": "REROUTE_AROUND_CAPE",
    "incident_tags": ["WAR_RISK", "HOSTILITIES", "SECURITY_ESCALATION"]
  },
  "key_clauses": [
    {
      "contract_id": "LSA-2026-A1",
      "clause": "17.4",
      "topic": "Right to Deviate (War/Hostilities)",
      "interpretation": "Deviation is permitted to avoid danger from acts of war/hostilities, but deviations beyond the configured maximum days require written notice within a short time window."
    },
    {
      "contract_id": "LSA-2026-A1",
      "clause": "8.2",
      "topic": "Liquidated Damages for Delay",
      "interpretation": "Late delivery triggers daily liquidated damages unless a valid Force Majeure exclusion applies."
    },
    {
      "contract_id": "LSA-2026-A1",
      "clause": "8.3",
      "topic": "Force Majeure & Exclusions",
      "interpretation": "War/hostilities can relieve liability; strikes are generally excluded unless a broad national strike."
    }
  ],
  "decision_assessment": {
    "reroute_permission_status": "PERMITTED_WITH_NOTICE",
    "force_majeure_applicability": "LIKELY_APPLIES",
    "conditions": [
      "Reroute must be justified as safety-related due to hostilities/war risk",
      "If reroute adds more than MAX_DEVIATION_DAYS, written notice must be sent within 2 hours of the decision timestamp"
    ],
    "notice_requirements": {
      "is_required": true,
      "deadline_relative": "WITHIN_2_HOURS_OF_DECISION",
      "recipients": ["Merchant/Contract Counterparty (as defined in booking confirmation)"],
      "must_include": [
        "Reason for deviation (war/hostilities risk)",
        "Expected additional transit time range",
        "Mitigation steps"
      ]
    }
  },
  "liability_exposure": {
    "delay_days_estimate_range": [10, 14],
    "liquidated_damages_estimate_eur_range": [1000000, 1400000],
    "liability_reduction_pathways": [
      "Invoke war/hostilities exclusion if evidence supports it",
      "Send timely deviation notice to preserve contractual protection"
    ],
    "open_risks": [
      "Counterparty may dispute whether deviation was reasonably necessary",
      "If notice is late or incomplete, penalty exposure may remain"
    ]
  },
  "recommended_next_steps": [
    {
      "priority": "NOW",
      "action": "Generate and send deviation notice email within the contractual time window",
      "owner": "Lena + Legal"
    },
    {
      "priority": "TODAY",
      "action": "Collect evidence pack (carrier advisory, security bulletins, incident timestamp) to support war-risk justification",
      "owner": "Ops"
    },
    {
      "priority": "TODAY",
      "action": "Ask human counsel to confirm Force Majeure posture and any customer-specific clauses (B/L, booking confirmation riders)",
      "owner": "Legal"
    }
  ],
  "draft_notice_email": {
    "subject": "Notice of Route Deviation Due to War/Hostilities Risk - Vessel Pacific Star",
    "body": "We hereby provide written notice that, due to elevated war/hostilities risk impacting the planned corridor, the Carrier has taken a safety-driven decision to deviate from the advertised route. We estimate an additional delay of 10-14 days. We will continue to mitigate impact and provide updated ETA as carrier schedules are confirmed."
  },
  "confidence": {
    "score": 78,
    "reasoning": [
      "Contract clause indicates war-risk deviation rights, but exact MAX_DEVIATION_DAYS value is parameterized",
      "Booking confirmation / B/L riders not provided"
    ]
  },
  "requires_human_counsel": true,
  "questions_for_counsel": [
    "What is the configured MAX_DEVIATION_DAYS in this booking?",
    "Who is the formal notice recipient per booking confirmation/B/L?",
    "Any additional sanctions/export control constraints relevant to reroute?"
  ]
}
```

## n8n شبیه‌سازی (Node Plan)

Workflow: Legal Agent - Contract to Decision JSON

- Manual trigger / webhook: contract + incident + shipment facts
- Read contract PDFs
- Set: incident summary (tags + timestamp)
- Set: shipment facts (ETA window, penalty/day, cargo criticality)
- LLM: clause extractor (keywords: deviation, force majeure, war, weather, demurrage)
- LLM: legal decision support agent (outputs JSON)
- Function: consistency checker (schema + contradictions)
- Store/respond: save legal report object (DB/file) and send to main system

## سوال برای ادامه (برای اجرای واقعی)

برای اینکه دقیقاً همین را روی داده‌های شما اجرا کنم، این‌ها را لازم دارم:

1. قراردادهای نمونه (PDF/Text).
2. incident file اگر دارید (مثلاً `Incident_GeoJason.pdf` یا GeoJSON).
3. تصمیم Lena برای آن سناریو: `wait` یا `reroute` یا `alt_port` یا `split_airfreight`.

