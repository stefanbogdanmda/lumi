# Lumi — Go-To-Market Plan

*Status: v1.1 live · Owner: Founder*

---

## 1. GTM thesis (3 sentences)

Lumi wins by owning two zero-CAC, high-intent distribution surfaces — the **VS Code Marketplace** and the **Claude plugin directory** — before anyone else claims the "learning / onboarding" shelf for non-technical AI-coding users. The founder's existing short-form video habit is the wedge: a "watch me build, Lumi teaches you" content engine drives free installs, those installs compound into marketplace reviews and ranking, and ranking produces durable organic discovery. Free individual usage is the top of a funnel whose real revenue lives in **bootcamp and corporate L&D pilots**, where Lumi is sold as a managed onboarding layer that turns non-engineers into confident AI-tool users.

The strategy is deliberately **product-led at the top, sales-assisted at the bottom** — the standard motion for developer tools, where pure self-serve dominates until deals cross roughly $50K ARR and a light human-sell layer takes over ([McKinsey](https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/from-product-led-growth-to-product-led-sales-beyond-the-plg-hype), [Stage 2 Capital](https://www.stage2.capital/blog/the-product-led-growth-plg-playbook-for-b2b-startups)).

---

## 2. ICP definition

### 2a. Firmographics (the paying accounts)

| Segment | Profile | Why they buy |
|---|---|---|
| **Coding bootcamps** (primary) | 50–2,000 students/yr; remote or hybrid; teach "AI-assisted dev" or career-switcher tracks; thin instructor-to-student ratio | Need to scale 1:1 hand-holding without hiring more instructors; Lumi is an always-on TA |
| **Corporate L&D / "AI upskilling" teams** (primary) | 200–10,000 employees; rolling out AI coding tools to **non-engineers** (PMs, analysts, ops, marketing, designers) | Mandated AI-enablement programs with measurable completion + competency; Lumi tracks progress and de-risks the rollout |
| **Internal enablement / DevRel at AI-forward companies** (secondary) | Companies that bought Claude seats org-wide and watched adoption stall among non-devs | Need an onboarding layer to convert seats into active users |

**Disqualifiers:** pure senior-engineer orgs (they don't need plain-English teaching), companies not yet on AI coding tools (no surface to attach to), <50-person orgs with no L&D function (sell the free/individual tier instead).

### 2b. Buyer persona (signs the check)

**"Maya, the Enablement Lead."** Bootcamp Head of Curriculum or corporate L&D / AI-Program Manager. Non-engineer or lightly technical. KPI'd on **activation, completion, and competency** of a cohort, not on code quality. Pain: learners freeze the moment a tool says something technical, and she can't clone herself across every learner. Buys tools that reduce support load and produce a **completion/progress dashboard** she can show her boss. Budget: training/tooling line item, $2K–$50K, low-friction for a pilot.

### 2c. End-user persona (decides if it lives or dies)

**"Sam, the non-technical builder."** Career-switcher, marketer, founder, or ops person using Claude Code for the first time. Smart but intimidated by jargon; abandons when confused. On mobile half the time. Loves that Lumi explains concepts **in plain English, in real time, in-context**, and shows visible progress. Sam is who the founder's videos speak to directly — Sam installs Lumi for free, then becomes the in-org champion who tells Maya "we should get this for everyone."

### Where to find them

- **Bootcamps:** Course Report / SwitchUp directories; bootcamp Slack/Discord communities and alumni groups; LinkedIn (titles: "Head of Curriculum," "Lead Instructor," "Director of Education").
- **Corporate L&D:** LinkedIn (titles: "L&D Manager," "Head of Enablement," "AI Adoption/Upskilling Program Lead"); L&D communities; inbound from individual employees who installed Lumi.
- **End users:** where the founder already posts — Instagram / TikTok / YouTube Shorts comment sections on "build with AI" content; Claude Code subreddit and Discord; "learn to code with AI" hashtags.

---

## 3. Channels, ranked

> Ranking logic: lead with the two surfaces that have **built-in purchase intent and zero CAC**, feed them with the founder's **owned content engine**, and convert the resulting users into **B2B pilots** via communities/partnerships.

### Channel 1 — Claude plugin directory (highest-intent, land-grab now)

**Why.** Users are *already inside Claude Code* when they browse `/plugin`, and the plugin runs on the user's own Claude subscription (zero infra cost, works on mobile). The directory is young, so the "learning / onboarding" niche is unclaimed. Anthropic already ships first-party **learning-oriented plugins** (`learning-output-style`, `explanatory-output-style`) — proof the category is sanctioned ([Claude Code docs](https://code.claude.com/docs/en/discover-plugins)).

**Tactics.**
- Ship Lumi as both (a) a plugin submitted to the **community marketplace** and (b) **your own GitHub-hosted marketplace** users add via `/plugin marketplace add founder/lumi` — you control updates and versioning end-to-end.
- Position in the same lane as `learning-output-style` but differentiated as **real-time, in-context, progress-tracked plain-English teaching**.
- Keep **context cost low** — the `/plugin` detail view shows a per-turn token estimate; a lean plugin is more likely to be installed and kept.

**First actions (week 1).** Submit to the community marketplace (`clau.de/plugin-directory-submission`); ensure `plugin.json` version == CHANGELOG == git tag (version mismatch is the #1 rejection cause — [systemprompt.io](https://systemprompt.io/guides/publish-plugin-claude-marketplace)); stand up your own `.claude-plugin/marketplace.json` repo; write the description for **Sam, the non-technical user**.

### Channel 2 — VS Code Marketplace (durable organic discovery)

**Why.** The Marketplace is a **searchable, rank-driven store** — users sort by installs and rating ([VS Code docs](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)). Installs and reviews compound into ranking, producing free durable discovery.

**Tactics.**
- **README is the listing page.** Lead with *what it does and who it's for* in the first two lines, an animated GIF of Lumi teaching a real concept above the fold, then social proof. **Host images on absolute URLs — relative paths don't render.**
- **Keywords: use all 10, no waste** (the Marketplace rejects >10): `learn to code`, `AI onboarding`, `beginner`, `Claude`, `non-technical`, `tutor`, `explain code`, `upskilling`, `mentor`, `plain English`.
- **Categories:** `Education` + `Other`.
- **Badges** (installs, version, rating) build trust — use a trusted provider.
- **Verified publisher** requires a domain + ~6 months live — start the clock now.
- **Engineer the install→rating loop:** prompt for a review right after a "Lumi just taught me something" win.

**First actions (week 1–2).** Rewrite the README as a conversion landing page; publish under a verified-eligible publisher tied to a domain you own; set the 10 keywords + categories; add a CI publish action.

### Channel 3 — Founder content engine (the demand pump)

**Why.** Marketplaces have intent but no traffic of their own. The founder already produces short-form video and reaches "build with AI" audiences — Sam at scale, for free. Detailed format in §4.

### Channel 4 — Communities & bootcamp partnerships (the B2B on-ramp)

**Why.** Where free users and viewers convert into paid pilots. The motion is content/install → champion (Sam) → warm intro to buyer (Maya).

**Tactics.** Be genuinely useful in 3–5 bootcamp/L&D/Claude communities; offer bootcamps a **free cohort pilot** in exchange for a logo + testimonial; build a 2-page "Lumi for Cohorts" one-pager with the progress-dashboard screenshot front and center.

---

## 4. The content engine

### Repeatable format: **"Watch me build → Lumi teaches you"** (45–90 sec)

1. **Hook (0–3s):** the relatable non-technical pain — *"I'm not a coder and Claude just said 'commit your changes.' What?"*
2. **Build (3–30s):** founder does a real, tiny task in Claude Code.
3. **Teach (30–60s):** the moment a jargon term appears, cut to **Lumi explaining it in plain English on screen** — the product *is* the payoff.
4. **CTA (last 5s):** *"Lumi is free — install link in bio."*

### 5 concrete video ideas

1. **"What does 'commit' actually mean?"** — Lumi explains version control with a Google-Docs-history analogy.
2. **"I built an app on my phone and didn't understand one word — until Lumi."** — mobile-first, shows the plugin on a subscription.
3. **"'API key' sounded scary. Here's what it really is."** — Lumi's house-key analogy.
4. **"Day 7 of learning to code with AI — look how far Lumi says I've come."** — shows the **progress tracker** (exactly what Maya wants to see).
5. **"3 words that make non-technical people quit AI coding (and what they mean)."** — listicle, high saveability.

### Posting cadence
- **3–5 short videos/week** across Instagram Reels, TikTok, YouTube Shorts (same cut to all three).
- **1 longer YouTube video / week** for SEO + richer CTA.
- Batch-shoot weekly; keep a running backlog of "confusing concepts" as an endless idea well.

### CTA / funnel
Single consistent CTA: **"Lumi is free — install it (link in bio)."** Link-in-bio → a one-screen landing page with **two buttons**: *"Add to VS Code"* and *"Add to Claude Code"* (copy-pasteable `/plugin marketplace add` command). A third, quieter link: *"Teaching a class or team? →"* routes to the B2B path (§5). Capture email for nurture.

---

## 5. The B2B motion: free user / viewer → paid pilot

**Core idea:** never sell to a cold buyer. Use the free individual product to manufacture an internal champion (Sam), then let Sam open the door to the buyer (Maya).

### The full funnel
```
Video viewer → Free install (VS Code / Claude) → Activated user (got taught ≥1 concept)
   → Champion (Sam) — using it in a bootcamp/at work, hits the "teaching a team?" CTA
   → Qualified lead (Maya / L&D / curriculum) → Free cohort pilot (10–50 seats, 2–4 wks)
   → Paid contract (per-seat or per-cohort) → Expansion (more cohorts / org-wide)
```

### Triggers that surface B2B intent (instrument these)
- Install from a `.edu` or corporate email domain.
- Multiple installs clustered on the same domain in a short window (strongest signal).
- Anyone who clicks the "teaching a class or team?" link.
- A reviewer/commenter mentions "my students," "my team," "our cohort," "onboarding."

### Hand-sell steps (founder-led, lightweight)
1. **Detect & reach out.** *"Saw a few folks at {org} are using Lumi — want a free cohort version with a progress dashboard for your group?"*
2. **15-min discovery call.** One question that matters: *"How do you currently get non-engineers comfortable with AI coding tools, and what does 'done' look like?"*
3. **Free pilot.** 10–50 seats, 2–4 weeks, success metric agreed up front. The **progress dashboard is the deliverable**.
4. **Readout → close.** Present pilot data; convert to **per-seat or per-cohort** pricing; ask for the case study + logo + a warm intro.
5. **Expand.** Land one cohort, then go org-wide / multi-cohort.

---

## 6. Launch sequence (first ~8 weeks)

| Week | Theme | Key actions | Output / gate |
|---|---|---|---|
| **0 (prep)** | Foundations | Register domain (starts verified-publisher clock); set up analytics; lock content format | Tracking live; domain owned |
| **1** | Ship the storefronts | Rewrite VS Code README as a landing page; publish via CI; submit to Claude community marketplace + stand up own `/plugin marketplace add founder/lumi` repo | Both surfaces live & installable |
| **2** | Content ignition | Batch-shoot + launch first 5 videos; ship the link-in-bio landing page; add in-product review prompt | First organic installs; review loop on |
| **3** | Reviews + reach | Push for first 10–25 reviews; join 5 bootcamp/L&D/Claude communities; build "Lumi for Cohorts" one-pager | ≥4.5★ rating; B2B asset ready |
| **4** | B2B priming | Identify 20 bootcamps + 20 L&D leads; turn on domain-cluster detection; first warm outreach | First 3–5 B2B conversations |
| **5** | Pilot push | Run "progress tracker" video angle (#4); book discovery calls; pitch free cohort pilots | 1–2 pilots scheduled |
| **6** | First pilot live | Launch first free cohort pilot with agreed success metric | Pilot running |
| **7** | Official-directory push | Use install + review numbers as the demand case for official-marketplace inclusion | Submission in front of Anthropic |
| **8** | First close + proof | Pilot readout → first paid cohort; capture case study + logo + 1 referral | First revenue; first reference logo |

---

## 7. Metrics that matter

| Funnel stage | Metric | Rough wk-8 target |
|---|---|---|
| **Content** | Views → bio-link clicks (CTR) | ≥2–3% link CTR on best videos |
| **Acquisition** | Weekly installs (VS Code + Claude) | 500–1,500 cumulative |
| **Activation** | % of installs taught ≥1 concept in session 1 | ≥60% |
| **Loyalty / ranking** | Marketplace rating + review count | ≥4.5★, ≥25 reviews |
| **Retention** | Day-7 active | D7 ≥ 25% |
| **B2B pipeline** | Qualified team conversations | ≥5 |
| **Conversion** | Pilots started → paid | ≥1 paid cohort |

**North-star to watch weekly:** *activated installs per week* — downstream of content, upstream of both ranking and B2B leads.

---

## 8. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **"Anthropic adds this natively"** | Medium–High | Own the category name + reviews first; lean into what a first-party feature won't prioritize (the **VS Code panel**, **progress dashboards**, the **B2B cohort-management layer**); build B2B relationships/case studies; position to be the obvious "official learning plugin." |
| **Low early install volume** | High (early) | Own-marketplace + VS Code listing compound between hits; lower time-to-first-value; go direct to bootcamps/L&D in parallel — one cohort pilot beats thousands of passive installs. |
| **Directory rejection / gatekeeping** | Medium | Ship your **own marketplace repo** (one-line add) as the always-works path; match `plugin.json` / CHANGELOG / git tag versions. |
| **Solo-founder bandwidth** | High | Keep the motion product-led; templatize the 5-step hand-sell; spend founder time only on warm, signal-qualified leads. |
| **Non-technical users churn before "aha"** | Medium | Make the first session deliver a taught concept; use the progress tracker to manufacture early momentum. |
| **Platform dependency (user's Claude sub)** | Low–Medium | Keep the **VS Code panel** as a parallel surface; keep the teaching layer model-agnostic where possible. |

---

### Sources
- [Claude Code — Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) · [systemprompt.io — Publishing a Plugin to the Claude Marketplace](https://systemprompt.io/guides/publish-plugin-claude-marketplace) · [VS Code — Extension Marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace) · [VS Code — Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) · [microsoft/vscode-discussions #426 — 10-keyword limit](https://github.com/microsoft/vscode-discussions/discussions/426) · [McKinsey — PLG to product-led sales](https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/from-product-led-growth-to-product-led-sales-beyond-the-plg-hype) · [Stage 2 Capital — PLG Playbook](https://www.stage2.capital/blog/the-product-led-growth-plg-playbook-for-b2b-startups) · [Userpilot — Product-Led vs Sales-Led](https://userpilot.com/blog/product-led-vs-sales-led/)
