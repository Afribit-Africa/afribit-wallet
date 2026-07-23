# Off-ramp Payout Vendor Research
Status: Draft v1 · 2026-07-24 · Informs the open question in `docs/ROADMAP.md` Phase 3 / `docs/PRD.md` §10

This is desk research from public documentation only — it is meant to inform, not replace, the "direct conversations" the roadmap explicitly calls for before treating any vendor as a settled choice. No vendor has been contacted. No commercial terms have been confirmed beyond what's published.

## Why this matters

The off-ramp (spending Bitcoin at a till/paybill/phone number via M-Pesa) requires Afribit Pay to act as principal in a BTC→KES conversion, then actually move KES to the recipient. That second step — moving real KES — needs one of these three paths. This is also the step the PRD flags as very likely VASP-regulated activity (§8), so the vendor choice has compliance weight beyond engineering convenience.

## Option 1: IntaSend

**What it is:** Kenyan payment gateway/aggregator. Already handles M-Pesa collections (STK push) and lists Bitcoin as a supported payment method on their own marketing site — notable, since it suggests some existing familiarity with crypto-adjacent businesses.

**Relevant APIs (confirmed from public docs, `developers.intasend.com`):**
- **M-Pesa B2C** (`/api/v1/send-money/initiate/` + `/approve/`) — pays out to a phone number. Batch-capable (multiple beneficiaries per request).
- **M-Pesa B2B** — explicitly documented as "automate disbursement to PayBill and Till Numbers," with `account_type: "PayBill"` or `"TillNumber"` as an explicit field. **This is the one that directly matches our till/paybill KE-QR use case.**
- Two-step initiate → approve flow on both, with a `requires_approval` flag — useful for a manual-review safety valve during early sandbox/pilot use.
- Status-check and webhook-event endpoints exist for both.

**Fees:** Ksh. 100 flat per M-Pesa disbursement (published pricing page). **This is a real concern for our use case** — the PRD's target transactions are small/frequent ("comparable to buying food or small goods"). A flat KES 100 fee could exceed the transaction value itself for genuinely small payments. Worth a direct conversation about volume-based pricing before committing.

**Onboarding:** Sandbox is self-serve (`sandbox.intasend.com`), no waiting. Live KYC requirements weren't published on the pages checked — needs a direct question.

**Verdict:** Best-documented, most directly-matching API for our exact need (till + paybill, not just phone numbers), lowest visible integration friction. Fee structure is the open concern.

## Option 2: Splice Africa

**What it is:** A cross-border payments API platform ("Crafted by engineers, for engineers"), with public docs at `developers.splice.africa`.

**Relevant findings:** Their public marketing site and docs intro page do **not** mention M-Pesa, Kenya-specific rails, till numbers, or paybills anywhere in the content checked. This doesn't mean they can't do it — cross-border platforms often support local rails under the hood — but it's not evidenced the way IntaSend's is. Would need a direct conversation to confirm Kenya/M-Pesa support at all before evaluating further.

**On the Tando question (see below):** No connection between Splice and Tando was found in Splice's own site, docs, or general web search. The PRD's caution — "confirm before treating Splice as a fully independent vendor relationship" — remains exactly as unresolved as it was. I found nothing to confirm OR deny an acquisition; this needs a direct question to Splice, not more desk research.

**Verdict:** Insufficient public information to evaluate against our specific need. Lowest-confidence option of the three until a direct conversation happens.

## Option 3: Direct Safaricom Daraja API

**What it is:** Safaricom's own official M-Pesa API platform — the no-middleman option.

**Requirements (confirmed via public integration guides):**
- Must have an **active M-Pesa business Paybill or Till number BEFORE applying for API access** — these are separate, sequential steps.
- Getting the Till/Paybill itself needs real business KYC: KRA PIN certificate, CR12, certificate of registration, directors' IDs, a signed M-Pesa Authorization form (two directors), bank details. Paybills specifically take 5–10 working days due to extra use-case review.
- **B2C and C2B (collections) access are mutually exclusive on the same shortcode** — Afribit would need separate registrations for accepting money in vs. paying money out, meaning two full KYC/approval cycles if both are ever needed.
- Daraja's own API review/approval adds another 2–10 business days on top of the Till/Paybill approval.

**Verdict:** Slowest and heaviest path (multiple sequential KYC cycles, likely 2–4+ weeks total before any sandbox-to-live transition), but removes a middleman's fee and dependency. This is why the PRD already frames it as "a fallback," not a first choice — that framing holds up.

## The Tando fact-check

Separately from the Splice question: **Tando is a real, live product** — a Kenyan Bitcoin-Lightning-to-M-Pesa bridge that converts M-Pesa phone numbers directly into Lightning addresses, reportedly reaching ~40 million potential M-Pesa recipients as of May 2026. This is close to exactly what Afribit's off-ramp is trying to build in-house.

The PRD already records that "building in-house regardless" was a prior decision and that a partnership conversation with Tando "has not yet had" — phrasing that leaves the door open. Given how directly Tando's existing product overlaps with this exact roadmap phase, it may be worth revisiting whether a partnership/API relationship with Tando is faster to ship than any of the three options above, purely as a question to raise — not a recommendation to reverse the in-house decision unilaterally.

## Recommendation for the "direct conversation" step

In order of what the direct conversations should prioritize:
1. **IntaSend** — confirm live KYC requirements and ask directly about volume-based pricing below the flat KES 100 rate, given our small-transaction use case. Best fit on paper.
2. **Tando** — a short exploratory conversation costs little and could shortcut months of in-house payout-engine work, given it does almost exactly this.
3. **Splice** — a basic capability question (do they support M-Pesa payouts at all, and what happened with Tando) before spending more research time here.
4. **Direct Daraja** — keep as the fallback per the existing PRD framing; the KYC timeline alone makes it a poor first choice for a sandbox-stage decision.

## What's still open (cannot be resolved by more desk research)
- Live KYC requirements and true settlement speed for IntaSend.
- Whether Splice supports M-Pesa/Kenya rails at all.
- The Splice/Tando ownership relationship, if any.
- Whether a Tando partnership conversation is worth having before more in-house payout-engine work proceeds.
