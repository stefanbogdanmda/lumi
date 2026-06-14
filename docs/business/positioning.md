# Lumi — Positioning & Messaging

## 1. Positioning Statement & Elevator Pitch

**Positioning statement:**
Lumi is the onboarding layer for AI coding tools that turns non-technical people into confident, self-sufficient builders by teaching every new concept the moment it appears — and remembering it forever.

**Elevator pitch:**
When a non-technical person uses an AI coding tool like Claude Code, the AI ships working code full of words they've never seen — "environment variable," "migration," "race condition" — and they paste it in anyway, hoping it's fine. Lumi rides along inside the tool, spots each new concept in real time, and drops in a 20-second plain-English lesson, then never teaches that concept again because it remembers what each person has learned. The result: your beginners stop accumulating *comprehension debt* and start actually understanding what they ship.

---

## 2. The Problem: Comprehension Debt

AI coding tools made it possible for anyone to *produce* code. They did nothing to help anyone *understand* it.

This gap now has a name: **comprehension debt** — "the growing gap between the code your team has shipped and the code your team actually understands." Unlike technical debt, it's invisible, because the code usually *works* — right up until something breaks and nobody knows why. ([O'Reilly Radar](https://www.oreilly.com/radar/comprehension-debt-the-hidden-cost-of-ai-generated-code/), [Addy Osmani](https://medium.com/@addyosmani/comprehension-debt-the-hidden-cost-of-ai-generated-code-285a25dac57e))

The numbers make it vivid:

- **59% of developers say they use AI-generated code they don't fully understand.** For non-technical users, the real number is closer to 100% — they have no baseline to judge against. ([ITNEXT](https://itnext.io/managing-comprehension-debt-a-practical-prevention-guide-ccb86de5821b))
- AI introduces a **security vulnerability in ~45% of cases**, per Veracode's 2025 analysis of 100+ models across 80 real-world tasks. ([Help Net Security](https://www.helpnetsecurity.com/2025/08/07/create-ai-code-security-risks/), [SoftwareSeni](https://www.softwareseni.com/why-45-percent-of-ai-generated-code-contains-security-vulnerabilities/))
- AI-generated code carries a **2.74× higher vulnerability rate** than human-written code. ([Help Net Security](https://www.helpnetsecurity.com/2025/08/07/create-ai-code-security-risks/))
- People who learned via AI assistance scored **50% on comprehension quizzes vs. 67%** for those who wrote code by hand — they shipped more and understood less. ([ITNEXT](https://itnext.io/managing-comprehension-debt-a-practical-prevention-guide-ccb86de5821b))

**Why this is worse for non-technical people.** A senior engineer reviewing AI output at least recognizes the words. A bootcamp student, a marketer prototyping an app, or a junior analyst automating a report gets a wall of unfamiliar terms, no thread to pull, and a working result that *rewards* them for not asking questions. The misaligned incentive — "shipping fast gets rewarded; slowing down to understand doesn't" — hits them hardest. ([ITNEXT](https://itnext.io/managing-comprehension-debt-a-practical-prevention-guide-ccb86de5821b))

So they paste, ship, and quietly fall further behind. The codebase looks healthy while comprehension hollows out underneath it. **Lumi closes that gap in the one moment it can actually be closed: the moment the unfamiliar word appears.**

---

## 3. Target Audiences

### Primary: B2B buyers (with their end-learners)

**Buyer A — Coding bootcamps & technical-education programs**
- *Pain:* Students now lean on AI to complete projects, pass without understanding, and graduate unable to maintain their own work. Outcomes (and job-placement reputation) suffer; instructors can't sit beside every student in real time.
- *Lumi delivers:* A tireless in-context tutor that closes comprehension gaps the instant they appear, plus a per-student progress trail and personal glossary that prove genuine learning — not just completed assignments.

**Buyer B — Corporate L&D / "AI upskilling" leaders**
- *Pain:* They've handed AI coding tools to non-engineers (ops, marketing, analysts, PMs) to boost productivity — and now those employees are shipping code they don't understand, creating the exact security and maintainability risk the org was trying to avoid. Generic training courses don't transfer to real tasks.
- *Lumi delivers:* Onboarding and upskilling that happen *inside real work*, not in a separate course. Employees become productive faster, understand what they deploy, and the org gets a measurable reduction in comprehension debt and unreviewed AI code.

**End-learner (rides under both buyers) — the overwhelmed non-technical builder**
- *Pain:* Feels stupid, can't tell which questions are "dumb," doesn't want to break their flow to go Google every term, and is quietly anxious that the thing they just shipped is wrong.
- *Lumi delivers:* A friendly mini-teacher that never makes them feel behind — short, just-in-time lessons that never repeat, building real confidence one concept at a time.

### Secondary

- **Self-taught individual learners & "vibe coders"** building side projects with Claude Code who want to actually learn, not just generate. (Reachable through the free inline plugin as a bottom-up adoption funnel into B2B.)
- **Career-switchers and returners** using AI tools to break into tech.
- **Engineering managers onboarding junior or non-traditional hires**, who want new team members to internalize concepts rather than copy-paste blindly.

---

## 4. Value Propositions / Messaging Pillars

**1. Learn in the flow, never in a detour.**
Lumi teaches the concept the moment it appears in the AI's output — no tab-switching, no Googling, no breaking your momentum to figure out what a word means.

**2. It remembers, so you only learn each thing once.**
Cross-session memory tracks what you've learned and never re-teaches it. Every lesson is one you actually needed — and your personal glossary grows with you across every session.

**3. The antidote to comprehension debt.**
Lumi turns "I shipped it and hope it's fine" into "I understand what I shipped." That's fewer security flaws, less unreviewed AI code, and team members who can maintain their own work.

**4. Onboarding that meets people where they already are.**
The inline plugin works on mobile and runs on the user's own Claude subscription — free to run, nothing to provision. The VS Code side-panel goes deeper for desktop work. One learning layer, wherever your people build.

**5. Model-agnostic and yours to keep.**
Lumi's value lives in *your* progress and *your* glossary, not in any one vendor's model. The learning you build with Lumi travels with you, no matter how the AI underneath changes.

---

## 5. Differentiation

| Alternative | What it does | Why Lumi wins for non-technical users |
|---|---|---|
| **Native AI "explain" modes** (Claude, etc.) | Explains code *when you ask* | Beginners don't know what to ask. Lumi is proactive, detects the unfamiliar term for them, and — crucially — *remembers across sessions* so it never re-explains. |
| **Copilot / Cursor "explain this"** | On-demand, in-IDE explanation | One-shot and stateless; re-explains the same basics forever, IDE-only, and pitched at developers. Lumi tracks a learning journey and works on mobile too. |
| **Codecademy / Mimo-style apps** | Structured courses in a separate app | Curriculum lives outside your real work, so nothing transfers to the task at hand. Lumi teaches the exact concept in the exact moment you hit it. |
| **Plain ChatGPT ("what does this mean?")** | Copy-paste term, get an answer | Manual, context-free, breaks your flow, and forgets you every time. Lumi is in-context, automatic, and has a memory of *you*. |

**The defensible core:** every alternative above is *stateless* or *off to the side*. Lumi's moat is **cross-session memory** — a per-person progress model and personal glossary that a native "explain" button can't easily replicate and that compounds in value the longer someone uses it.

---

## 6. Tagline Options

1. **Lumi — understand what you ship.**
2. **The mini-teacher inside your AI coding tool.**
3. **Learn the word the moment it appears.**
4. **From "paste and pray" to "I get it."**
5. **The onboarding layer for AI coding.**
6. **It explains everything new — once.**
7. **Productive today. Fluent tomorrow.**
8. **The cure for comprehension debt.**

---

## 7. Objection Handling

**"Won't Claude (or the AI itself) just add this feature?"**
A native "explain" button is stateless and reactive — it answers when asked and forgets you afterward. Lumi's value is the opposite: proactive detection plus a *memory of each learner* (progress + personal glossary) that compounds over time and stays model-agnostic. A model vendor optimizes for answering the current prompt, not for tracking one person's months-long learning journey across tools — and they have little incentive to stay neutral across competing models the way Lumi does.

**"My users are non-technical — won't this overwhelm them with more text?"**
That's exactly what we designed against. Lessons are short, plain-English, and appear only for genuinely new concepts — never repeated. Lumi *reduces* the cognitive load of unfamiliar jargon instead of adding to it.

**"Can't they just Google it or ask ChatGPT?"**
They can — but they won't, reliably. It breaks their flow, they don't know which terms matter, and the answer has no memory of what they already know. Lumi makes the right lesson appear at the right moment with zero effort, which is the difference between a feature people *could* use and one they *actually* use.

**"What does this cost to run at scale?"**
The inline plugin runs on each user's own Claude subscription, so it's free for you to operate and there's no infrastructure to provision per seat. That makes it unusually easy to roll out across a cohort or a department.

**"How do I know it's actually working / that people are learning?"**
The same memory layer that prevents re-teaching also produces a record: per-learner progress and a growing personal glossary. For bootcamps and L&D, that's evidence of genuine comprehension — not just completed assignments.

**"Is this a real product or an experiment?"**
Lumi is a working product, available in two forms today: a mobile-capable inline plugin and a VS Code side-panel.

---

## 8. Tone & Voice Guidelines

**Personality:** Lumi is a warm, patient mini-teacher — the friend who explains things without making you feel behind. Encouraging, never condescending.

**Do:**
- Use plain English. If a term needs explaining, explain it — that's the whole point.
- Keep it short. Respect the reader's flow and attention.
- Be encouraging and normalize not-knowing: "Here's a new one —" not "As you should already know."
- Celebrate progress quietly; make the learner feel capable, not corrected.
- Speak *to* the non-technical reader, even in B2B materials — buyers are buying on behalf of people who feel overwhelmed.

**Don't:**
- Use unexplained jargon, acronyms, or insider shorthand.
- Be smug, gatekeep-y, or imply the reader is a "real" coder only once they've learned enough.
- Over-teach or lecture. One concept, one moment, then get out of the way.
- Use fear as the primary hook *with learners* (save the "comprehension debt / security risk" framing for B2B buyers; keep the learner-facing voice hopeful and confidence-building).

**In one line:** *Talk to every user like a smart friend who simply hasn't met this word yet.*
