# Nick — Open Strategic Questions Tracker

این سند یک فریمورک برای دسته‌بندی و پیگیری تمام سوالات استراتژیک Nick است. می‌توان آن را به صورت living doc در Notion یا repo تیمی استفاده کرد و برای هر سوال، پاسخ‌ها و یافته‌ها مستندسازی شود.

---

## Metadata برای هر سوال
- **ID:** شماره یکتا (مثلاً OQ-001)
- **Owner:** Nick
- **Status:** Open / In Progress / Closed
- **Priority:** High / Medium / Low
- **Created Date:** YYYY-MM-DD
- **Reviewed Date:** YYYY-MM-DD

---

## Template برای هر سوال

### Question / Risk
> جمله کوتاه و واضح که سوال یا ریسک را توضیح دهد.

### Context
> توضیح زمینه و چرایی اهمیت این سوال/ریسک.

### Hypothesis
> حدس یا فرضیه ای که می خواهیم validate کنیم.

### Validation Method
> نحوه تست/تحقیق برای پاسخ دادن یا اعتبارسنجی. مثال‌ها:
- مصاحبه مشتری
- pilot
- تحلیل داده
- workshop

### Who to Ask / Responsible
> افراد داخلی یا مشتریان برای جمع‌آوری پاسخ.

### Evidence / Findings
> یافته‌ها و شواهد جمع‌آوری شده.

### Risk / Impact if Unanswered
- Financial: High / Medium / Low
- Product: High / Medium / Low
- Timeline: High / Medium / Low

### Next Steps / Action Items
> اقداماتی که باید انجام شود.

### Linked Docs / References
- PRD, ADR, interview files, dashboard specs و سایر منابع مرتبط

### Versioning / Notes
- v0.1 YYYY-MM-DD: Template created
- v0.2 YYYY-MM-DD: Updates

---

## Categorized Strategic Questions (initial list)

### 1. North Star Metric Validation
- **OQ-001:** Can customers realistically quantify cost-of-delay in a defensible way?
- **OQ-002:** How do customers currently estimate production downtime costs?
- **OQ-003:** Who inside the customer organization owns the cost-of-delay number?
- **OQ-004:** Can a customer calibrate a basic cost model within 1–2 weeks without consulting?

### 2. MVP Scope Validation
- **OQ-005:** Is port congestion alone painful enough to justify a pilot?
- **OQ-006:** Can customers accept manual data intake during the pilot phase?
- **OQ-007:** What is the minimum operational workflow customers need before they consider the product useful?

### 3. Actionability Validation
- **OQ-008:** When a disruption happens today, what actions do operations managers actually take?
- **OQ-009:** Which decisions are currently manual, stressful, or financially risky?
- **OQ-010:** What decisions are still made through Excel, email, or phone calls?
- **OQ-011:** Which mitigation options are realistically available during disruptions?

### 4. Trust & Explainability
- **OQ-012:** What level of explainability is required before customers trust recommendations?
- **OQ-013:** Would customers trust probabilistic recommendations?
- **OQ-014:** Do customers require audit trails for operational decisions?

### 5. GTM / Buyer Validation
- **OQ-015:** Who is the actual economic buyer?
- **OQ-016:** Who feels the pain most intensely?
- **OQ-017:** What is the expected pilot buying process?

### 6. Security & Adoption
- **OQ-018:** What data are customers unwilling to share during a pilot?
- **OQ-019:** Would customers allow cloud-hosted shipment intelligence?

### 7. Commercial Validation
- **OQ-020:** What financial outcome would make the pilot obviously worth paying for?
- **OQ-021:** Would customers pay for: prediction / recommendation / avoided downtime / operational visibility?

### 8. Beachhead Validation
- **OQ-022:** Which industry has highest downtime cost, fastest buying cycle, simplest onboarding?

---

### Next Step
Nick باید برای هر سوال این فیلدها را پر کند:
- Question
- Hypothesis
- How to validate
- Who to ask
- What evidence counts
- Risk level

این می‌شود **Risk Validation Framework** و ابزار اصلی برای GTM و MVP feedback.

