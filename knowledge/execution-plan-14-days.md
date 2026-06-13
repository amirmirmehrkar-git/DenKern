---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# برنامه اجرا ۱۴ روزه (Build + Discover همزمان)

Source: Amir provided a chat excerpt about how to execute in parallel with domain discovery, and asked for a task list with deadlines.

## پاسخ مستقیم به سوال کلیدی

آیا می‌شود بدون آدم domain جلو رفت؟

- برای محصول جدی: نه.
- برای یک prototype طی ۷ تا ۱۰ روز: بله.

پس استراتژی درست:

```text
Build + Discover همزمان
```

## هدف ۱۴ روزه

- Demo واقعی و قابل ارائه.
- 5 use case واقعی جمع‌آوری‌شده.
- 1 MVP واضح (flow مشخص، سناریوها، خروجی قابل دفاع).

## نقش‌ها

- Amir: Product / Execution lead (frontend + backend با کمک AI).
- Pooja: Domain / outreach / interviews (critical path).
- James: Simulation / logic / prediction-output mocks.

## Week 1 (Day 1-7): Prototype + Discovery

### Day 1-2: Foundation

Amir:

- تعریف 5 سناریو (scenario list).
- تعریف structure:
  - `scenario` object schema
  - `legal_data.json` (mock)

James:

- delay estimation (rule-based).
- cost estimation (basic).
- بدون ML، فقط logic قابل دفاع.

Pooja:

- لیست 20 نفر target در logistics/procurement/operations.
- شروع outreach.

### Day 3-4: UI + Data Flow

Amir:

- ساخت UI اولیه (map + table + buttons).
- تعریف flow: `Run Analysis` -> output rendering (حتی fake).

James:

- mock API:
  - `/scenarios`
  - `/legal`

Pooja:

- گرفتن 3 call واقعی.
- خروجی هر call طبق قالب case asset.

### Day 5-7: First Integration

Amir:

- اتصال UI به mock data.
- `Run Analysis` -> خروجی قابل نمایش.

James:

- scenario generator:
  - 5 گزینه
  - time / cost outputs

Pooja:

- مستندسازی خروجی callها با تمرکز روی "what actually happens".

## Week 2 (Day 8-14): Realism + Validation

### Day 8-10: Reality Injection

Amir:

- اصلاح UI براساس feedback.
- حذف چیزهای fake غیرلازم.

James:

- واقع‌گراتر کردن logic:
  - cost of delay
  - simple rules

Pooja:

- رساندن تعداد use case واقعی به 5 تا 10.

### Day 11-12: Decision Flow

Amir:

- اضافه کردن:
  - scenario selection
  - legal summary

James:

- integrate legal mock (حتی static) در خروجی.

### Day 13-14: Demo Ready

Deliverable demo:

- نقشه.
- دکمه `Run Analysis`.
- 5 سناریو.
- legal summary.
- export JSON.

## لیست وظایف و ددلاین‌ها (بر اساس نفر)

Amir (روزانه):

- UI build و wiring flowها.
- تعریف contractها و structureها.
- حذف complexity و جلوگیری از overbuild.

Amir deliverables تا Day 7:

- UI کامل (حداقل map + scenario cards/table + recommendation panel).
- data flow end-to-end با mock.

Pooja (روزانه):

- 3 outreach.
- 1 call.

Pooja deliverables تا Day 14:

- حداقل 5 disruption story واقعی.
- workflow واقعی تصمیم‌گیری.
- pain/risk/justification details.

James (روزانه):

- 1 بهبود logic یا خروجی.

James deliverables تا Day 14:

- delay logic.
- cost logic.
- generator برای 5 scenario.
- خروجی JSON برای مصرف backend/UI.

## قانون مهم

اگر Pooja use case واقعی نیاورد، شما دارید فرضی می‌سازید.

## نکته درباره AI

- AI را برای extraction و structuring استفاده کنید.
- core logic باید deterministic و قابل دفاع باشد (نه hallucination-based).

## ریسک اصلی

```text
Reality gap
```

یعنی demo خوب باشد ولی با workflow واقعی و تصمیم واقعی mismatch داشته باشد.

