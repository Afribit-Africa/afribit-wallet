# Afribit Pay — Product Requirements Document
Status: Draft v1 · Living document

## 1. Summary

Afribit Pay is a non-custodial Bitcoin wallet that lets people in Kibera, Nairobi buy Bitcoin with M-Pesa, hold it in a wallet only they control, and spend it anywhere M-Pesa is accepted — merchants, paybills, or a phone number — without either party needing to think about Bitcoin as anything other than money that moves fast.

## 2. Problem statement

Two working tools already exist in this space: one to buy Bitcoin with M-Pesa, another to spend it. People who use Bitcoin day to day in Kibera are already stitching these together manually. There's no single tool that treats buying and spending as one continuous action, and no wallet built specifically around this community's actual usage patterns — small, frequent, everyday transactions, not speculation.

## 3. Goals

- Collapse "buy" and "spend" into a single app and a single flow.
- Never take custody of user funds — self-custody is a product requirement, not a feature toggle.
- Make spending feel instant — near-immediate settlement on both the buy and the spend side.
- Be usable by people already comfortable with M-Pesa and nothing else, without requiring them to learn "crypto" concepts first.

## 4. Non-goals (explicitly out of scope)

- Not a trading app or exchange interface — no charts, no price speculation framing anywhere in the primary flow.
- Not a custodial wallet at any point, even temporarily, beyond what's structurally unavoidable during a swap.
- Not attempting full VASP licensing and a real KES float before the compliance and funding groundwork is done — see Open questions.
- Not building the full 25-section brand book, merchandise, or marketing ecosystem before the wallet itself works. Brand and landing page work runs in parallel but doesn't block core product engineering.

## 5. Target users

Primary: Kibera merchants and residents already transacting informally with Bitcoin, who currently need two apps to do it. Small, frequent transaction sizes (comparable to buying food or small goods), not large-value transfers.

## 6. Core features

### 6.1 Wallet (foundation)
Non-custodial, forked from Blink 3.0's Spark-based architecture. 12-word recovery phrase, user-controlled keys throughout. Rebased from the existing `AfriBit-wallet` fork onto current Blink core.

### 6.2 On-ramp — Buy Bitcoin with M-Pesa
Integrates the Bitika API. User pays via M-Pesa STK push; Bitika settles sats directly to the user's own Lightning address — Afribit Pay never holds funds in this leg, since Bitika delivers straight to a destination the app specifies.

### 6.3 Off-ramp — Spend Bitcoin via M-Pesa
Built in-house. Two entry points:
- **Scan** — a single scan flow that recognizes either a Lightning invoice/address or a Kenyan M-Pesa QR code (KE-QR standard, EMV-based — covers till, paybill, and send-money formats) and routes accordingly.
- **Send to number** — manual entry of a phone number or Lightning address, auto-detected.

This is the piece where Afribit Pay is the principal converting sats to KES and triggering the M-Pesa payout — see the compliance note below.

### 6.4 Theming
Light and dark mode, defaulting to system preference. Full brand palette applied in both, not just an inverted background.

## 7. Technical architecture (summary)

```
M-Pesa/Airtel Money → Bitika API (buy) → Afribit Pay wallet (non-custodial, Blink 3.0 core)
                                                      ↓
                                    Off-ramp module (KE-QR + M-Pesa payout, in-house)
                                                      ↓
                                          Merchant / phone number
```

Off-ramp payout rails: evaluating Splice Africa and IntaSend as infrastructure providers to avoid a direct Safaricom Daraja relationship at this stage — see Open questions.

## 8. Compliance note

Kenya's Virtual Asset Service Providers Act (2025) is in force; draft VASP Regulations (2026) are in consultation. The non-custodial wallet reduces exposure to "custodial wallet provider" classification, but the off-ramp — Afribit Pay acting as principal in a BTC-to-KES exchange — is very likely captured as VASP activity regardless of wallet custody model. This has direct implications for entity structure, KYC tiering, and launch sequencing. Full compliance read is a prerequisite for going live with real funds, not a parallel-track nice-to-have.

## 9. Success metrics (initial)

- Working sandbox demo: buy → hold → scan → spend, end to end, no real money.
- Pilot: a defined small number of Kibera merchants transacting for real, once float and compliance are in place.
- Settlement time on both legs at or near what Tando/Bitika already deliver — "almost a second after paying" is the bar, not an aspiration.

## 10. Open questions

- **Off-ramp infrastructure**: Splice Africa vs. IntaSend — pending direct conversations on crypto-business tolerance and real settlement speed. Direct Safaricom Daraja remains a fallback. Desk research complete, see `docs/OFFRAMP_RESEARCH.md` (2026-07-24) — does not replace the direct conversations still needed.
- **Entity structure**: whether the off-ramp needs a legal entity separate from Afribit's existing structure.
- **Funding**: float capital not yet secured; sized to realistic pilot transaction volumes rather than large-scale assumptions.
- **Tando relationship**: partnership conversation not yet had; building in-house regardless, per prior decision. Worth revisiting given how directly Tando's live product overlaps this phase's goal (see off-ramp research doc).
- **Splice/Tando acquisition claim**: reported but unverified — confirm before treating Splice as a fully independent vendor relationship. Public research found nothing either way; still needs a direct question.