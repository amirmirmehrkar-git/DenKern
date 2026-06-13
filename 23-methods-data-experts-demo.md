---
title: Methods, Data, Experts, Demo Levels
type: playbook
project: DenkKern
status: draft
language: fa
tags:
  - denkkern
  - playbook
  - validation
  - data
  - experts
  - demo
---

# متدها، دیتا، متخصص، سطح دمو (راهنمای عملی)

Source: Amir provided a condensed practical note. This file captures the guidance as working context.

## 1) متدها و ابزارهای تصمیم‌گیری (بسته به اندازه شرکت)

شرکت‌های بزرگ:

- تصمیم‌گیری معمولاً ترکیبی از analytics + planning + scenario planning + decision intelligence است، نه یک ابزار واحد.
- در عمل یعنی: ERP / planning برای داده و عملیات روزمره، BI / dashboards برای visibility، scenario planning برای "اگر این شد چه می‌شود"، و expert judgment / legal / ops review برای تصمیم نهایی.

شرکت‌های متوسط:

- stack معمولاً ساده‌تر است: ERP یا planning tool، Excel، email / calls / Slack، و گاهی visibility tools یا lightweight analytics.
- معمولاً decision intelligence رسمی ندارند و بیشتر workflowهای دستی/نیمه‌تحلیلی دارند. اگر محصول خوب frame شود، اینجا می‌تواند wedge خوبی باشد.

Domain تفاوت ایجاد می‌کند:

- Shipping / maritime: reroute, wait, alternative port, war-risk, port/weather constraints
- Warehousing: inventory allocation, reorder, substitute supplier, fulfillment priority
- Manufacturing: line-stop risk, expedite critical parts, production re-sequencing

نتیجه: niche مهم است چون data و workflow در هر حوزه فرق می‌کند.

## 2) برای MVP کدام niche مناسب‌تر است؟

Version 2 guidance:

برای MVP، shipping / maritime disruption می‌تواند بهترین wedge باشد چون:

- eventها عمومی‌تر و observableتر هستند.
- data بیرونی راحت‌تر پیدا می‌شود.
- تصمیم‌ها واضح‌ترند: wait, reroute, alternative port, split shipment.
- دمو روی نقشه قانع‌کننده‌تر است.

Note: این با manufacturing-first wedge ممکن است تضاد داشته باشد. تضاد را در `12-icp-and-gtm.md` به‌صورت versioned نگه می‌داریم تا بعد تصمیم نهایی گرفته شود.

## 3) روش‌های دسترسی به متخصصین و هزینه‌ها

کم‌هزینه‌ترین مسیر برای مرحله فعلی:

- LinkedIn outreach + warm intros + meetups / incubators

چون این مرحله بیشتر به use case واقعی نیاز دارد تا مشاوره پولی.

Expert networks (مثال‌ها):

- GLG
- AlphaSights

نکته هزینه‌ای (market-based estimate، نه قیمت رسمی):

- تماس‌های expert network می‌توانند حدود 500 تا 1500 دلار در ساعت یا بیشتر هزینه داشته باشند (بسته به seniority و provider).

توصیه عملی:

- 80 درصد effort روی outreach مستقیم
- 20 درصد در صورت نیاز روی 1 یا 2 expert call پولی، فقط برای سوال‌های خیلی مشخص

## 4) دیتاست‌ها: برای MVP از کجا؟

منابع پیشنهادی برای shipping / disruption MVP:

- GDELT برای events/news ساخت‌یافته جهانی.
- DWD Open Data برای داده‌های هواشناسی آلمان.
- ELWIS برای داده‌های آبراه‌ها، notices، water levels و اطلاعات کشتیرانی آلمان.
- MarineTraffic برای AIS / vessel tracking (پلن‌ها و قابلیت‌ها رسمی‌اند، ولی enterprise معمولاً فروش).
- OpenStreetMap برای نقشه پایه، همراه با Leaflet.

نکته درباره "داده راحت":

داده راحت الزاماً بد نیست. برای MVP، مزیت سرعت است. تمایز قرار نیست صرفاً از "داشتن داده" بیاید؛ تمایز از decision workflow + legal framing + scenario reasoning + human approval می‌آید.

داده‌ای که James باید بسازد:

- دنبال dataset کامل production-grade نرود.
- از داده‌های عمومی فقط rangeها و baselineها را بگیرد.
- synthetic اما data-informed scenario بسازد.

برای مثال:

- average reroute delay range
- weather disruption window
- rough cost uplift
- cargo value / penalty assumptions

مهم: ادعا نکنید "trained predictive model" production ساخته‌اید اگر واقعاً ندارید.

## 5) ساخت دمو: چه سطحی کافی است؟

سه سطح:

Demo:

- برای باز کردن در گفتگو: map، events، vessels، 5 سناریو، legal summary، خروجی synthetic ولی باورپذیر.

MVP:

- لازم نیست production ML باشد.
- یک disruption case واقعی.
- deterministic scenario logic.
- legal analysis layer.
- خروجی قابل دفاع.
- قابل استفاده برای feedback.

Production intelligence:

- historical firm-specific data
- calibration
- learned patterns
- optimization models

## 6) خرج کردن پول incubator

پول را خرج کنید روی:

- دسترسی به متخصص یا industry access
- event / meetup / سفرهای کوچک
- یکی دو expert call هدفمند
- prototype سبک و تمیز

نه روی:

- لپ‌تاپ
- infra سنگین
- مدل‌سازی سنگین

چون ریسک اصلی فعلاً problem validation است، نه engineering.

## 7) جمع‌بندی عملی برای نقش‌ها

پیشنهاد تقسیم کار:

- Amir: product, framing, UI, workflow
- James: variables, baseline ranges, deterministic scenario logic
- Pooja: domain access, interviews, networking, finding real cases

مسیر پیشنهادی:

1. یک niche انتخاب کنید (ترجیحاً shipping/maritime).
2. یک disruption case واقعی بگیرید.
3. روی همان case داده synthetic اما grounded بسازید.
4. demo/MVP را بسازید.
5. با آن بروید سراغ آدم‌های واقعی.
6. اگر traction دیدید، بعداً بروید سمت data/model deeper.

