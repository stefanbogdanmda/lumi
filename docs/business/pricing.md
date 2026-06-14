# Lumi — Pricing & Packaging

> Status: v1.1 product, currently free and open (no accounts, no billing). This document defines the path from "free and open" to a sustainable revenue model that monetizes teams and organizations without compromising the free individual experience.

---

## 1. Pricing Philosophy

**Lumi is priced on the value it delivers, not on the resources it consumes.**

The single most important economic fact about Lumi is that **lessons are generated on the user's own Claude subscription**. When a learner asks Lumi to explain a concept, the inference cost is paid by that user's existing Claude plan — not by us. This inverts the usual AI-product cost structure.

Most AI tools are forced into usage-based or credit-based pricing because every interaction burns tokens *they* pay for. In June 2026, both GitHub Copilot and Cursor restructured every plan around usage-based credits and per-seat token pools precisely because inference is their dominant marginal cost ([Developers Digest, June 2026](https://www.developersdigest.tech/blog/ai-coding-tools-pricing-june-2026); [Digital Applied](https://www.digitalapplied.com/blog/ai-coding-tool-pricing-june-2026-seat-economics-guide)). They meter because they bleed.

**Lumi doesn't bleed.** Our cost-to-serve is near-zero: a thin plugin, a VS Code panel, a progress-tracking backend, and (for paid tiers) an admin dashboard. That has three consequences for how we price:

1. **No metering, ever.** We will never cap lessons, throttle explanations, or sell "credits." Metering a near-zero-cost product would be both indefensible and strategically self-defeating — the entire point is that learners feel free to ask Lumi *anything*, as often as they want. Friction kills learning.
2. **We can give the core product away forever.** Because individuals cost us nothing to serve, the free tier is not a loss leader we tolerate — it is a near-costless growth engine. (See §3 and §6.)
3. **Paid pricing reflects organizational value, not consumption.** Teams don't pay for "more Lumi." They pay for *visibility, control, and customization* — admin dashboards, cohort reporting, custom lesson packs, and seat/SSO management. These are value layers an org will pay for regardless of how many lessons get generated underneath.

This is **value-based, per-seat pricing**: the price reflects the outcome (an upskilled, AI-fluent workforce with measurable progress) rather than the mechanism. It is the most common B2B SaaS model — 57% of SaaS companies use per-user pricing, at a median of ~$45/user/month ([Monetizely SaaS Pricing Benchmark 2025](https://www.getmonetizely.com/articles/saas-pricing-benchmark-study-2025-key-insights-from-100-companies-analyzed)). We deliberately price *below* that median because our cost structure lets us, and because undercutting the category is a wedge (see §4).

---

## 2. The Tiers

Three tiers, matching the standard B2B shape of "~3 public tiers + a custom enterprise option" ([Monetizely, 2025](https://www.getmonetizely.com/articles/saas-pricing-benchmark-study-2025-key-insights-from-100-companies-analyzed)).

| | **Free — Individual** | **Team** | **Org / Enterprise** |
|---|---|---|---|
| **Price** | **$0 forever** | **$15 / seat / month** (annual) / $18 / seat / month (monthly) | **Custom** — starts ~$22 / seat / month (volume & term dependent) |
| **Who it's for** | Any individual learning to use AI coding tools — solo founders, hobbyists, career-switchers, curious non-technical users | Bootcamps, agencies, and companies running cohorts or upskilling a team (≈ 5–150 learners) | Large enterprises running org-wide AI-fluency / L&D programs, with security, procurement, and compliance needs |
| **Lumi mini-teacher** (inline plugin + VS Code panel) | Full, unlimited | Full, unlimited | Full, unlimited |
| **Mobile inline plugin** | Yes | Yes | Yes |
| **Personal progress tracking** | Yes | Yes | Yes |
| **Community lesson library** | Yes | Yes | Yes |
| **Admin dashboard** | — | Yes | Yes |
| **Cohort progress tracking & reporting** | — | Yes (per-cohort) | Yes (multi-cohort, org rollups, exports) |
| **Custom lesson packs for their stack** | — | 1 pack included | Unlimited + authoring tools |
| **Seat management / invites** | — | Yes | Yes |
| **SSO / SCIM provisioning** | — | — | Yes |
| **Branded / white-label experience** | — | Add-on | Available (see §5) |
| **Support** | Community | Email / shared Slack | Dedicated CSM, onboarding, SLA |
| **Billing** | None | Self-serve card or invoice | Annual invoice / procurement |

### Why these numbers

- **$15–18/seat (Team) sits deliberately below the AI-coding-tool norm.** The category clusters at **$19 (Copilot Business)** to **$39–40 (Copilot Enterprise / Cursor Business)** per seat ([getDX](https://getdx.com/blog/ai-coding-assistant-pricing/); [No Code MBA](https://www.nocode.mba/articles/github-copilot-pricing); [Automation Atlas](https://automationatlas.io/answers/cursor-pricing-explained-2026/)). Lumi is a *companion* to those tools, not a replacement — so it must price as an add-on, not a second full seat. Landing under $19 keeps Lumi an easy "yes" line item next to the $19–40 a team already pays for the coding tool itself.
- **The real anchor is training cost, not tool cost.** A coding bootcamp averages **~$13,500–14,000 per student** ([Course Report](https://www.coursereport.com/blog/coding-bootcamp-cost-comparison-full-stack-immersives); [Career Karma](https://careerkarma.com/blog/coding-bootcamp-cost/)), and corporate AI-upskilling programs report **2× higher AI ROI** for companies that invest in structured training ([Iternal AI, 2026](https://iternal.ai/ai-training-for-employees)). Against that backdrop, **$180/seat/year** for always-on, in-context teaching is a rounding error.
- **Org/Enterprise at ~$22+** reflects the standard enterprise step-up. The premium buys SSO/SCIM, multi-cohort rollups, unlimited custom packs, and the support/security wrapper enterprises require — **86% of enterprise buyers require integration with existing tools** ([Invesp, 2025](https://www.invespcro.com/blog/saas-pricing/)), which is what SSO/SCIM delivers.

---

## 3. Free-vs-Paid Feature Split

**Guiding rule: the free tier must stay genuinely, permanently useful — good enough that a real learner never feels nagged toward a paywall.** Lumi's free tier *is* the marketing. If it feels crippled, the funnel dies.

### Stays free forever (the product)
- The entire **mini-teacher**: real-time, plain-English explanations of any tech concept, in both the inline plugin (incl. mobile) and the VS Code panel.
- **Unlimited lessons.** No caps, no credits, no throttling — this is a hard commitment, enabled by the near-zero cost-to-serve.
- **Personal progress tracking** — the individual sees what they've learned.
- Access to the **community lesson library**.

### Paid capabilities (the *organizational* layer)
Everything gated is something **an individual genuinely doesn't need, but an organization genuinely does**:
- **Admin dashboard** — a manager's view, meaningless to a solo learner.
- **Cohort progress tracking & reporting** — "is my bootcamp class / my team actually progressing?" This is the L&D money question.
- **Custom lesson packs** for the org's specific stack, conventions, and internal tools.
- **Seat management, SSO/SCIM** — administration, not learning.
- **White-label / branding.**

### The rationale for *where* the line sits
The split is along the axis of **"who benefits"**, not "how much you use." We never degrade the *individual's* experience to sell upward. A learner on a Team plan and a learner on Free get the *same teaching*. What the org pays for is the ability to **see, steer, and shape** that learning across many people.

---

## 4. Packaging Logic

**Per-seat.** Lumi's value scales with the number of people learning, and per-seat is the model buyers in this category already understand and budget for. It aligns price to value (more learners upskilled = more paid) without us ever touching usage metering.

**Minimum seats.** Team plan carries a **5-seat minimum** ($75/mo annual floor). Below 5 people there's no real "cohort" to manage. Enterprise carries a **25-seat minimum**. Minimums also protect the Free tier: a 2-person startup should just use Free.

**Annual vs monthly.** Annual is the default and is priced ~**17% below monthly** ($15 vs $18) — the standard "pay upfront, get a discount" lever that pulls cash forward and cuts churn ([Marketer Milk](https://www.marketermilk.com/blog/saas-pricing-models); [Invesp](https://www.invespcro.com/blog/saas-pricing/)).

**Pilot pricing.** Every Team/Org deal can start as a **30–60 day paid pilot**, invoiced manually (see §6). Pilots are **priced, not free** — even a nominal per-seat charge ($10/seat for the pilot window) qualifies the buyer and sets the anchor. Bootcamps, whose cohorts run 12–14 weeks, can be sold **per-cohort** (a fixed-term seat block) rather than open-ended subscription.

---

## 5. Expansion Revenue

**Custom & branded lesson packs.** The Team tier includes one custom pack; additional packs are sold individually (suggested **$500–2,000 per authored pack**) or bundled into Enterprise. These teach the *org's own* stack, internal tools, and conventions — high-value, hard to replicate, and the natural land-and-expand motion.

**White-label.** For bootcamps and training providers who want Lumi to appear as *their* in-product teacher, offer a **white-label / branding add-on** (suggested **+$3–5/seat/month**, or a flat platform fee at Enterprise scale).

**Authoring tooling.** At Enterprise, sell self-serve lesson-pack *authoring* (so the org's own L&D team builds and maintains packs) as a recurring capability — this deepens stickiness and shifts content-creation cost to the customer.

---

## 6. Phased Monetization Rollout

**Don't build billing speculatively.** Each phase ships only the infrastructure the *current* phase needs, and we move forward only when a concrete trigger fires.

### Phase 0 — Free & Open (now)
- **Goal:** distribution and proof. Maximize installs, lessons taught, and word-of-mouth. No accounts, no billing.
- **Do:** keep it frictionless; add lightweight (optional, privacy-respecting) telemetry so we can *see* usage, and a simple "for teams?" interest capture.
- **Trigger to advance:** **≥ 5 qualified inbound team requests**, or a clear cluster of org-domain usage.

### Phase 1 — Manual-Invoice Pilots
- **Goal:** validate willingness-to-pay and the paid feature set with *zero* speculative billing code.
- **Build only:** accounts + the **admin dashboard, cohort reporting, and seat invites**. **Billing is a human + a Stripe invoice / PDF** — no self-serve checkout yet.
- **Trigger to advance:** the *manual* process becomes the bottleneck — roughly **8–10 paying accounts**, or invoicing/renewals consuming more founder time than selling.

### Phase 2 — Self-Serve Billing
- **Goal:** scale Team-tier acquisition without a human in every loop.
- **Build:** self-serve signup, card checkout (Stripe), plan/seat management, annual/monthly toggle, dunning. Enterprise stays sales-led and invoice-based.

**Why this order:** revenue is proven with humans before it's automated with code.

---

## 7. Risks & Guardrails

**1. Cannibalizing the free tier.** Hold the line in §3 — *individual learning value stays 100% free; only org-level visibility/control/customization is paid.* Test any proposed gate against: "would a solo learner ever need this?"

**2. Free cannibalizing Paid.** Below ~5 people, that's funnel, not lost revenue. Conversion is driven by the *manager's* need for the dashboard and reporting, which free can't satisfy.

**3. Churn — especially bootcamps.** Sell bootcamps **per-cohort term blocks** rather than counting them as monthly churn, and pursue **annual institutional contracts**.

**4. The user-subscription dependency (the load-bearing risk).** Lumi's near-zero cost-to-serve *depends entirely* on lessons running on the **user's own Claude subscription**.
- **Set the prerequisite explicitly** in onboarding and sales.
- **Degrade gracefully** — if generation can't run, fail with a clear, friendly message and still serve the static community lesson library.
- **Don't price against a cost we don't bear** — never quietly start subsidizing inference.
- **Monitor the platform relationship** as a tracked dependency.

**5. Thin paid moat.** The durable moat is **custom lesson packs and white-label** (§5) — org-specific content and brand integration that compound switching cost — plus distribution from the free funnel.

---

*Sources: [getDX — AI coding assistant pricing 2025](https://getdx.com/blog/ai-coding-assistant-pricing/) · [No Code MBA — GitHub Copilot pricing](https://www.nocode.mba/articles/github-copilot-pricing) · [Automation Atlas — Cursor pricing 2026](https://automationatlas.io/answers/cursor-pricing-explained-2026/) · [Developers Digest — AI coding tool pricing June 2026](https://www.developersdigest.tech/blog/ai-coding-tools-pricing-june-2026) · [Digital Applied — seat economics June 2026](https://www.digitalapplied.com/blog/ai-coding-tool-pricing-june-2026-seat-economics-guide) · [Monetizely — SaaS Pricing Benchmark 2025](https://www.getmonetizely.com/articles/saas-pricing-benchmark-study-2025-key-insights-from-100-companies-analyzed) · [Invesp — State of SaaS Pricing 2025](https://www.invespcro.com/blog/saas-pricing/) · [Marketer Milk — B2B SaaS pricing models](https://www.marketermilk.com/blog/saas-pricing-models) · [Course Report — bootcamp cost comparison](https://www.coursereport.com/blog/coding-bootcamp-cost-comparison-full-stack-immersives) · [Career Karma — bootcamp costs](https://careerkarma.com/blog/coding-bootcamp-cost/) · [Iternal AI — AI training for employees 2026](https://iternal.ai/ai-training-for-employees) · [LearnWorlds — white-label courses](https://www.learnworlds.com/blog/market-sell/white-label-courses-to-resell/)*
