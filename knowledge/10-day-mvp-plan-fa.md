---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# DenkKern - برنامه اجرای MVP ده‌روزه

مسئولیت‌های تیم و نقشه راه sprint.

## هدف Sprint ده‌روزه

تا پایان این sprint، DenkKern باید به milestoneهای زیر برسد.

### 1. محصول

- یک دمو MVP با کیفیت بالا و قابل کلیک.
- پیاده‌سازی کاربردی use case «Lena 2.0».
- یک workflow عملیاتی پایه از نوع Prediction-to-Decision.

### 2. اعتبارسنجی بازار

- انجام 10 تا 15 مصاحبه عمیق با مشتری.
- اعتبارسنجی Initial Customer Profile یا ICP.
- دریافت بازخورد مشخص درباره pricing و pain pointهای عملیاتی.

### 3. توسعه کسب‌وکار

- آماده‌سازی pilot proposal حرفه‌ای برای ارائه.
- متریال pre-sales marketing.
- پیش‌نویس pilot / pre-contract agreement.
- pipeline اولیه و qualified از مشتریان.

## 1. James - Modeling & Data Science

مسئولیت اصلی: ساخت لایه prediction و disruption intelligence.

| Days | Phase | Deliverables & Tasks |
| --- | --- | --- |
| Day 1-2 | Structure | تعریف ساختار خروجی prediction. ساخت schemaهای استاندارد JSON برای ETA predictions، arrival windows خوش‌بینانه / بدبینانه، delay probability، و confidence scores. |
| Day 2-4 | Logic | منطق اولیه prediction. تمرکز روی تخمین تاخیر کشتی و اثر اختلال. استفاده از heuristics و public shipping data برای ساخت MVP باورپذیر، نه کامل. |
| Day 4-6 | Scoring | disruption scoring. پیاده‌سازی risk scoring برای شدت آب‌وهوا، port congestion، احتمال اعتصاب، و maritime incidents. |
| Day 6-8 | API | ساخت prediction API. deploy یک endpoint ساده `/api/prediction` که ETA، risk scores، و delay probabilities را خروجی می‌دهد. |
| Day 8-10 | Support | integration و demo. کمک به Amir در frontend integration و انجام تست نهایی منطق prediction. |

## 2. Nick - Customer Discovery & GTM

مسئولیت اصلی: customer validation، onboarding strategy، و commercial readiness.

| Days | Phase | Deliverables & Tasks |
| --- | --- | --- |
| Day 1-2 | Targeting | تعریف فرضیه ICP. تمرکز روی تولیدکنندگان هامبورگ و صنایع high-downtime مثل shipbuilding، chemicals، machinery. |
| Day 2-4 | Setup | interview framework. ساخت پرسشنامه با تمرکز روی downtime costs، workflowهای تصمیم‌گیری دستی، و escalation processes. |
| Day 2-5 | Discovery | انجام 10 تا 15 مصاحبه با مشتری برای اعتبارسنجی operational pain و willingness to pay. |
| Day 5-7 | Pricing | اعتبارسنجی فرضیات pilot pricing در بازه EUR 5k-15k و SaaS subscription models. |
| Day 6-10 | Pipeline | pre-sales. ساخت outreach list qualified و shortlist کردن pilot customers. شروع گفتگوهای اولیه pre-sales. |
| Day 8-10 | Legal / Biz | pilot agreement. تهیه پیش‌نویس pre-contract ساده شامل duration، limited scope، و feedback collaboration. |

## 3. Amir - Technical Product, UX & MVP Engineering

مسئولیت اصلی: ساخت workflow محصول عملیاتی و interface MVP.

| Days | Phase | Deliverables & Tasks |
| --- | --- | --- |
| Day 1-3 | Strategy | نهایی‌سازی MVP workflow. تعریف flow «Lena 2.0»: disruption trigger -> scenario logic -> financial comparison -> dashboard view. |
| Day 2-4 | Design | طراحی Dashboard UI. ساخت interface برای shipment status، scenario cards، recommendation panels، و risk explanations با React / Tailwind. |
| Day 4-6 | Scenarios | ساخت scenario logic. برنامه‌نویسی سناریوهای actionable و hard-coded مثل Wait، Expedite، و Replacement Parts. |
| Day 5-7 | Engine | financial impact engine. اتصال prediction data و mock ERP data برای محاسبه Expected Loss و Total Expected Cost برای هر سناریو. |
| Day 6-9 | Integrate | system integration. اتصال API جیمز به scenario engine و dashboard UI. |
| Day 9-10 | DevOps | deployment. deploy لینک live demo با Vercel، Railway، یا Render. |

## فعالیت‌های مشترک تیم

### 1. Daily Sync پانزده‌دقیقه‌ای

هر صبح:

- دیروز چه چیزی تمام شد؟
- چه چیزی مانع پیشرفت است؟
- چه insight مهمی از مشتری یاد گرفته شد؟

### 2. Shared Workspace در Notion / Airtable

به‌صورت مرکزی track شود:

- interview notes و pain point tags.
- feature requests از مشتریان احتمالی.
- pilot leads و contact history.

## مهم: فعلاً نسازید

برای حفظ تمرکز، موارد زیر از sprint ده‌روزه خارج باشند:

- complex ontology platforms.
- agentهای هوش مصنوعی کاملاً خودمختار یا multi-agent orchestration.
- generic AI infrastructure.
- deep real-time ERP integrations.
- full-scale enterprise architecture.

## معیارهای موفقیت MVP در روز دهم

- [ ] Product: flow زنده و قابل کلیک «Lena 2.0» شامل prediction، scenarios، و dashboard.
- [ ] Market: ICP اعتبارسنجی‌شده و pricing feedback مستند.
- [ ] Business: pilot proposal و shortlist شامل 3+ lead با high intent.

## اصل استراتژیک نهایی

> پلتفرم نسازید. هوش مصنوعی generic نسازید. یک workflow دردناک تصمیم عملیاتی را بسیار خوب حل کنید.

