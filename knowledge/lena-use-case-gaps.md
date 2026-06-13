---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Gapهای use case Lena (Risk: prediction demo به جای decision product)

Source: Amir pasted a critique that the use case is now concrete, but still risks becoming a prediction demo rather than a decision product.

## Use case فعلی چیست (خلاصه)

- Lena: manufacturing manager
- مشکل: shipment delay risk
- impact: EUR 150k/day
- هدف: predict delay + ساخت سناریو + نمایش cost + کمک به تصمیم

این direction در مسیر Path A است (disruption + decision + cost impact).

## مشکل اصلی فعلی

تمرکز هنوز بیش از حد روی ML است، نه تصمیم.

Flow فعلی شبیه این است:

```text
Data -> ML -> ETA -> scenarios -> UI
```

ولی چیزی که market می‌خرد:

```text
Delay risk -> What should I do now? -> Cost comparison -> Decision
```

## gapهای دقیق

### 1) سوال اصلی هنوز جواب نشده

Lena فقط نمی‌خواهد بداند:

- When will it arrive?

او می‌خواهد بداند:

- What should I do right now?

### 2) سناریوها هنوز decision-grade نیستند

expected arrival و optimistic/pessimistic prediction هستند، نه decision.

سناریوهای decision باید شفاف باشند:

- Wait
- Expedite
- Replace parts
- Reroute (اگر در canon شما هست)

### 3) cost calculation سطحی است

صرفاً گفتن EUR 150k/day کافی نیست.

باید تبدیل شود به:

```text
Scenario -> delay -> cost -> compare
```

### 4) outcome story خوب است، اما سیستم هنوز آن را produce نمی‌کند

اگر story این است که "Lena replacement parts سفارش می‌دهد"، سیستم باید بتواند:

- آن گزینه را پیشنهاد دهد
- و savings نسبت به گزینه‌های دیگر را نشان دهد

## خطر اگر همین نسخه فعلی build شود

نتیجه می‌شود:

- dashboard / analytics tool
- user خودش باید decision را بسازد

این معمولاً market response ضعیف‌تری می‌دهد نسبت به decision support واقعی.

## جمع‌بندی

Use case خیلی خوب انتخاب شده و درد واقعی دارد.

اما باید shift کنید از:

```text
Prediction -> Visualization
```

به:

```text
Decision -> Recommendation -> Action
```

