# UI/UX Roadmap — Atlas's dedicated brief
Status: Draft v1 · 2026-07-24 · Scope: full-app fidelity to `Mocks/Afribit Pay.dc.html`

This is Atlas's own roadmap, separate from `docs/ROADMAP.md` (which tracks the whole product). Eddie's feedback that led to this: "Sending button/page does not follow our mocks... many screens are just a design of default Blink. Even the scan screen is." That feedback is correct, and it points at a real distinction this doc exists to fix:

**"Themed" is not the same bar as "matches the Mock."** Most screens restyled so far got theme tokens applied correctly (colors.white/black/grey3/grey5/primary swapped in for hardcoded hex, so light/dark mode works) — but a color-token swap over Blink's original LAYOUT still *feels* like Blink, because the spacing, information hierarchy, component choices, and copy are still Blink's, not the Mock's. Every item below needs to be judged against that stricter bar: does this screen's structure — not just its palette — match what `Afribit Pay.dc.html` actually shows.

## How to use the Mock file
`Mocks/Afribit Pay.dc.html` lives outside the git repo (`G:\My Drive\workspaces\Afribit-Pay\Mocks\`), invisible to an opencode session whose cwd is `~/afribit-wallet`. Claude (the orchestrator) has read access and pastes the relevant `<sc-if value="{{ isXxx }}">` section directly into each task prompt. Don't guess at Mock structure from memory of a prior task — ask for the current excerpt if a task references a section not already pasted into your context.

## Section A — The 7 Mock-defined screens

| Screen | Mock section | Status | What's actually needed |
|---|---|---|---|
| **Home** | `isHome` | Themed + matches Mock structure | Done earlier this session — balance, Send/Scan/Receive row, Buy button, Activity list all match. Re-check after this doc's other changes land, in case shared components shifted. |
| **Scan** | `isScan` | Done (2026-07-24) | Detected-sheet + KE-QR recognition + the real manual Lightning/M-Pesa mode toggle all built and tested (39 tests). |
| **Confirm** (payment confirmation after scan) | `isConfirm` | **Decision made: one shared Confirm screen for both Scan and manual Send.** | Redesign `send-bitcoin-confirmation-screen.tsx` to the Mock's full-screen centered layout ("You're paying" / merchant / amount / rail pill / Confirm & Pay) and use it for both the post-Scan flow and the end of the collapsed Send flow (see below) — one screen, not two. |
| **Paid** (success) | `isPaid` | Partially themed | `send-bitcoin-completed-screen.tsx` was restyled with tokens; verify its structure (large amount, "Payment sent" headline, "Done" button) actually matches the Mock's centered layout rather than Blink's original structure. |
| **Send** | `isSend` | **Decision made: collapse to match the Mock.** Not started. | Redesign into the Mock's single-field flow ("Phone number or Lightning address" input, auto-detected rail badge, "Try one" quick-fill suggestions) feeding into the shared Confirm screen above. This replaces the current 3-step destination → details → confirmation flow — a real architecture change, not a restyle. See Section C for the scoped task. |
| **Receive** | `isReceive` | Themed + matches Mock structure | Done earlier this session (QR, pill badge, identifier row, Copy/Share). Re-verify against current Mock excerpt for any missed details (the Mock's exact copy: "Anyone can pay you at this address from any Lightning or Afribit wallet"). |
| **Buy** | `isBuy` | Structure matches, needs the redesigned setup-prompt polish applied consistently | Amount entry + quick chips + keypad structure matches the Mock. The Lightning-address-missing state (not in the Mock, since the Mock assumes a happy path) was redesigned 2026-07-24 — check it doesn't clash with the Mock-matching parts above it. |

## Section B — Known dead/leftover Blink surface (not urgent, but real)
Found via a route inventory of `root-navigator.tsx` while writing this doc — flagging for a future cleanup pass, not a current priority:
- A full debit-card feature (`cardDashboardScreen`, 15+ `cardOnboarding*` routes) — entirely out of PRD scope, likely unreachable via any current nav path but still registered and shipping in the bundle.
- `peopleHome`, `contactDetail`, `allContacts`, `circlesDashboard` — the People/Circles tabs were removed from navigation earlier this session, but these screen files and routes are still registered.
This is the same shape of cleanup as the Settings-screen pass (`f55bca51e`) — worth a dedicated pass later, following the same "confirm unreachable, delete cleanly, regenerate storybook requires" process, but it's not blocking anything in Section A or C.

## Section C — Immediate priorities, in order
1. ~~Scan screen manual mode toggle~~ — done 2026-07-24.
2. **Collapse the Send flow + unify the Confirm screen** (both decided 2026-07-24, see table above) — the single biggest remaining structural gap. This spans the destination screen, details/amount screen, and confirmation screen; needs careful handling since real payment logic (fee tiers, LNURL, wallet selection, limits) lives in the current 3 screens and must not be lost in the collapse, only re-laid-out.
3. **General polish pass**: once #2 lands, re-verify Home/Receive/Paid/Scan against the CURRENT Mock excerpt (not memory of what it said earlier), since iterating on the Send flow may surface better patterns worth back-porting.
4. **Dead-surface cleanup** (Section B) — lower priority, do after the above.

## Standing rule for every task from this roadmap
Apply [[ux-quality-bar]] (Claude's memory, paraphrased here for Atlas): a screen isn't done when it typechecks and shows the right data — it's done when it would look intentionally designed to someone comparing it side-by-side with the Mock. If a task produces something that's functionally right but visually a placeholder-grade patch, that's not finished work.
