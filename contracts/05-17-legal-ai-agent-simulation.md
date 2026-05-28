---
type: operational
status: archived
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# شبیه‌سازی Legal AI Agent برای سناریوی تغییر مسیر / تصمیم حمل

این یادداشت آرشیوی است و به عنوان مرجع برای طراحی یک Legal Decision Support Agent ذخیره شده است.

## هدف Agent

تبدیل متن قرارداد + وضعیت حادثه + واقعیت‌های محموله به خروجی ساختاریافته و قابل دفاع که مشخص کند:

- آیا تغییر مسیر (deviation/reroute) از نظر قرارداد مجاز است؟
- آیا Force Majeure / War Risk / Perils of the Sea قابل استناد است؟
- چه notice/notificationهایی لازم است (deadline، گیرنده، محتوا)؟
- ریسک‌های مسئولیت مالی/penalty/demurrage چیست؟
- اقدام بعدی پیشنهادی چیست (نامه آماده، escalation، گرفتن تایید کتبی)؟

نکته: Agent تصمیم نهایی نمی‌دهد؛ فقط decision support ارائه می‌دهد و موارد نیازمند human counsel را پرچم می‌کند.

## سوال‌های Lena از Legal Agent (برای UI/Prompt)

- Route change مجاز است؟ طبق کدام بند؟
- Notice deadline چیست؟ به چه کسی و با چه فرمتی؟
- آیا Force Majeure شامل این رویداد می‌شود؟
- آیا Perils of the Sea / Weather مسئولیت تاخیر را محدود می‌کند؟
- Penalty exposure چقدر است و چه چیزی آن را کم/زیاد می‌کند؟
- Demurrage به عهده کیست و استثناها چیست؟

Inputs لازم:

- نقش‌ها: Carrier vs Charterer vs Merchant
- اسناد: booking confirmation، B/L، charter party rider clauses
- decision timestamp
- وضعیت واقعی کشتی/بندر (AIS / port restriction)

## Prompt نقش Agent (Copy/Paste)

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

## Consistency Checker (پیشنهادی)

یک checker ساده برای تناقض‌ها:

- اگر notice_required است، deadline باید وجود داشته باشد.
- اگر force_majeure=false ولی liability_exempt=true، inconsistency flag.
- اگر penalty آمده، basis محاسبه باید ذکر شود.

## JSON خروجی نمونه (برای تصمیم Reroute)

سناریو نمونه:

- vessel: Pacific Star
- cargo: EV Battery Cells
- planned action: REROUTE_AROUND_CAPE
- incident tags: WAR_RISK / HOSTILITIES / SECURITY_ESCALATION

نمونه JSON در چت شامل:

- key clauses با clause numbers و interpretation
- reroute permission status (PERMITTED_WITH_NOTICE)
- notice requirements (WITHIN_2_HOURS_OF_DECISION)
- liability exposure range و pathways کاهش ریسک
- recommended next steps + draft notice email
- confidence + questions_for_counsel

## n8n Workflow پیشنهادی (شبیه‌سازی)

Workflow: Legal Agent - Contract to Decision JSON

- Manual trigger / webhook (contract + incident + shipment facts)
- Read contract PDF(s)
- Set incident summary (war-risk/weather/timestamp)
- Set fleet/shipment facts (from dashboard JSON)
- LLM: clause extractor (deviation, force majeure, war, weather, demurrage)
- LLM: legal decision support agent (outputs JSON)
- Function: consistency checker (enforce schema + flags)
- Store/respond (DB/file/main system)

## قدم بعدی

برای تولید JSON دقیق، باید مشخص شود planned action چیست:

- reroute
- wait
- alternative port
- split airfreight

همچنین PDFهای قرارداد نمونه و incident input (مثلاً GeoJSON) باید در دسترس باشند.

