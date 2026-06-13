---
type: operational
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# UI Review - Lena Decision Screen (Screenshot)

Source: Amir requested UX/UI critique of a Lena decision screen screenshot.

## چیزهایی که خیلی خوبه (Keep)

- تمرکز تصمیم‌محور: 3 سناریو با Delay / Action Cost / Production Loss / Total دقیقاً همان decision screen است.
- توصیه واضح و human-in-the-loop: کارت Recommended + پنل Recommended Action روشن و قابل دفاع است.
- Risk breakdown قابل فهم: 40/60 و Expected Loss کنار هم، برای اعتمادسازی عالی است.
- hierarchy کلی: Summary بالا -> سناریوها -> توصیه -> توضیح مدل / Timeline.

## بهبودهای با اثر زیاد (تغییر کم)

- کاهش تکرار CTA: الان هم داخل کارت Recommended و هم پایین 3 دکمه بزرگ هست.
  - پیشنهاد: دکمه‌های بزرگ پایین primary باشند؛ داخل کارت‌ها فقط Select کوچک یا لینک باشد.
- عددها را برای "Expected" دقیق‌تر کن: Total Expected Cost داریم ولی delayها deterministic نمایش داده می‌شوند (5/2/0).
  - پیشنهاد: cue کوچک مثل P50 / P90 یا Likely و tooltip "based on model".
- legal/notice را MVP-lite وارد کن: چون دفاع‌پذیری core است.
  - مثال: Notice urgency: 24h یا Legal check required (icon + tooltip)، تا بعداً به legal-agent وصل شود.
- واحدها و رنگ‌ها را استاندارد کن:
  - الگوی ثابت برای رنگ risk (badge + border subtle) در هر سه کارت.
  - فرمت پول یکسان باشد (EUR formatting).
- Timeline را به تصمیم وصل کن:
  - سناریو Expedite یک اشاره داشته باشد مثل "assumes Amsterdam clearance by May 11" یا لینک به timeline row.
- دکمه How we calculate را نزدیک Risk Breakdown قرار بده، نه کنار سناریوها.
- یک جمله ضد-اتومیشن اضافه کن (enterprise trust):
  - Recommendation only; final decision requires human approval.

## ریسک‌های UX

- Overload: صفحه برای demo عالی است ولی در use واقعی ممکن است سنگین شود.
  - پیشنهاد: Risk Breakdown و Timeline را پیش‌فرض collapsible کنید.
- Ambiguity در Risk:
  - Risk بالا (Shipment Risk) با risk روی کارت‌ها (Option Risk) قاطی می‌شود.
  - پیشنهاد: بالا را Shipment Risk بنامید و روی کارت‌ها Option Risk.

