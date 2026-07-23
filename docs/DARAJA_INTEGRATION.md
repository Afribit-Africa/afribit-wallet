# Direct Safaricom Daraja API — Research & Registration Steps
Status: Draft v1 · 2026-07-24 · Vendor decided: direct Daraja (per founder decision, supersedes the IntaSend/Splice comparison in `docs/OFFRAMP_RESEARCH.md`)

This is what you need to actually go register, plus the technical shape the app will build against. Registration is entirely something only you (as the business owner/director) can do — it needs real KYC documents and signatures. Sandbox development can start today, in parallel, without waiting on any of it.

## Part 1 — What you need to register (do this now)

### Step 1: Get a business Till or Paybill number
Apply at **m-pesaforbusiness.co.ke** (Safaricom's self-onboarding portal — "Apply Now").

**Which one:** Given the off-ramp needs to both receive nothing (Afribit never collects money — Bitika handles the buy side) and only pay OUT to tills/paybills/phone numbers, you technically don't need a C2B-collecting shortcode for this at all — you need a shortcode with **B2C and B2B API access enabled**, funded from a working-capital balance you top up, not from customer payments. Confirm this framing directly with Safaricom Business support when you apply, since M-Pesa for Business's self-service flow is built around merchants collecting money, not disbursing it — your use case (pure payout engine) may need to be described explicitly as such.

**Documents needed** (have these ready before starting the application):
- KRA PIN certificate (the business's)
- Certificate of Incorporation / business registration certificate
- CR12 (valid within 90 days) if registered as a company
- Directors'/signatories' national ID or passport (front and back scans)
- Directors' individual KRA PIN certificates
- Bank account details for the business
- A signed M-Pesa Authorization form (needs two directors' signatures)

**Timeline:** Paybill applications typically take 5–10 working days due to additional use-case review. Till (Buy Goods) numbers are often faster.

### Step 2: Apply for Daraja API (B2C + B2B) production access
Only possible *after* Step 1 is approved and you have an active shortcode. Register for a free developer account at **developer.safaricom.co.ke**, then submit a production API application referencing your live shortcode.

**Important constraint:** B2C and C2B (collections) access are mutually exclusive on the same shortcode in some configurations — make sure whatever you register explicitly requests B2C (pay-to-phone) and B2B (pay-to-paybill/till) capability, not the default collections setup.

**Timeline:** Typically 2–5 business days after submission, occasionally up to 10 during busy periods.

**Total realistic timeline, Step 1 + Step 2: 2–4 weeks.** This matches what `docs/OFFRAMP_RESEARCH.md` already flagged about direct Daraja being the slowest path — going in with that expectation now avoids surprise later.

### Step 3 (can happen in parallel with Step 1/2): register a sandbox app
No waiting required for this one — do it today:
1. Create a free account at developer.safaricom.co.ke.
2. Create a new "App" in the portal — this issues a sandbox **Consumer Key** and **Consumer Secret** immediately.
3. Visit the portal's **Test Credentials** page for default sandbox values (shortcode, passkey, test phone number) — these are shared/public sandbox values, not secrets.
4. Hand the Consumer Key/Secret to me once issued (same handling as the Bitika/Breez keys — goes into `.env.local`, never committed).

This lets the actual integration get built and tested against Safaricom's real (simulated) infrastructure well before the business KYC clears.

## Part 2 — Technical shape (for building against, once sandbox keys exist)

**Authentication:** OAuth 2.0 client-credentials grant.
`GET https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials` (production: `api.safaricom.co.ke`), HTTP Basic Auth with Consumer Key as username, Consumer Secret as password. Returns an access token valid for 3600 seconds — must be refreshed hourly.

**B2C (pay out to a phone number)** — matches KE-QR "send money" and plain phone-number Send:
`POST /mpesa/b2c/v1/paymentrequest`
Fields: `InitiatorName`, `SecurityCredential` (see below), `CommandID` (`BusinessPayment`/`SalaryPayment`/`PromotionPayment`), `Amount`, `PartyA` (our shortcode), `PartyB` (recipient phone, `254...`), `Remarks`, `QueueTimeOutURL`, `ResultURL`, `Occasion`.

**B2B (pay out to a paybill or till)** — matches KE-QR till/paybill detection:
`CommandID: "BusinessPayBill"` (paybill, `AccountReference` mandatory) or the till-specific command Safaricom's docs specify for Buy Goods. `PartyB` is the recipient's shortcode rather than a phone number.

**SecurityCredential:** Not a plain password — it's your M-Pesa initiator password encrypted with Safaricom's public certificate using RSA PKCS#1 v1.5 (`openssl x509 ... -pubkey -noout` to extract the key, then encrypt). Safaricom publishes separate sandbox and production certificates; must use the matching one for each environment.

**Callbacks:** Both APIs are asynchronous — the initial call just acknowledges receipt; the real result arrives at your `ResultURL` (and `QueueTimeOutURL` for timeouts) as an HTTPS POST. **This app has no backend server to receive these** — the same gap already noted for Bitika's webhooks (see `docs/OFFRAMP_RESEARCH.md`/on-ramp notes: this app is a pure mobile client). Needs a small always-on endpoint somewhere (even a minimal serverless function) before this can work end-to-end; polling alone won't work here since Daraja doesn't offer a customer-facing status-check endpoint the way Bitika does.

## What's still open
- Whether the M-Pesa for Business self-service portal actually supports a payout-only (no collections) use case cleanly, or whether this needs a direct conversation with Safaricom Business support to configure correctly.
- Where the callback receiver (`ResultURL`/`QueueTimeOutURL` handler) will live — this is a real backend, however small, that doesn't exist yet.
- Till-specific B2B `CommandID` value (found `BusinessPayBill` for paybills; the Buy-Goods/till equivalent needs confirming directly from Safaricom's current API reference once portal access exists).
