/**
 * Concrete `PayoutProvider` implementation for Safaricom Daraja (M-Pesa).
 *
 * ## Endpoints
 * - OAuth:         GET  /oauth/v1/generate?grant_type=client_credentials
 * - B2C (phone):  POST /mpesa/b2c/v1/paymentrequest
 * - B2B (till/paybill): POST /mpesa/b2b/v1/paymentrequest
 *
 * ## CommandID values
 * | Destination    | CommandID           | Status                 |
 * |---------------|--------------------|------------------------|
 * | PhoneNumber    | BusinessPayment    | ✅ confirmed           |
 * | PayBill        | BusinessPayBill    | ✅ confirmed           |
 * | TillNumber     | BusinessBuyGoods   | ⚠️ UNCONFIRMED — see summary |
 *
 * ## Callback gap (CRITICAL — see docs/DARAJA_INTEGRATION.md § Callbacks)
 * Both B2C and B2B are asynchronous. The initial POST returns an acknowledgement;
 * the real result (success/failure) arrives later at the `ResultURL`/`QueueTimeOutURL`
 * as an HTTPS POST from Safaricom. This app is a **pure mobile client with no
 * backend server** — there is currently no HTTPS endpoint to receive these callbacks.
 *
 * Until a callback receiver exists (even a minimal serverless function),
 * `getPayoutStatus()` cannot return the true result and will always report
 * "processing". This is an architectural gap, not an implementation gap —
 * documented here so it does not get lost.
 */

import type {
  PayoutDestinationType,
  PayoutProvider,
  PayoutQuote,
  PayoutRequest,
  PayoutResult,
  PayoutStatus,
  QuoteRequest,
} from "../payout-provider"
import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"
import { DARAJA_SANDBOX_BASE_URL } from "./daraja-config"
import { createOAuthClient, type OAuthClient } from "./oauth-client"
import { encryptSecurityCredential } from "./security-credential"

// ---------------------------------------------------------------------------
// Quote (local computation — Daraja has no native quoting)
//
// Exported for testing; callers should use `getQuote()` on the provider.
// ---------------------------------------------------------------------------

const QUOTE_WINDOW_SEC = 30
const FLAT_FEE_KES = 10

export const computeDarajaQuote = (
  satsAmount: number,
  btcToKesRate: number,
): PayoutQuote => {
  const now = Date.now()
  const kesAmount = Math.floor((satsAmount * btcToKesRate) / SATS_PER_BTC)

  if (kesAmount <= 0) {
    throw new Error(
      `Sats amount too small: ${satsAmount} sats converts to ${kesAmount} KES at rate ${btcToKesRate}`,
    )
  }

  const feeKes =
    satsAmount < 10_000
      ? FLAT_FEE_KES
      : Math.max(FLAT_FEE_KES, Math.floor(kesAmount * 0.01))

  return {
    quotedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_WINDOW_SEC * 1000).toISOString(),
    satsAmount,
    kesAmount,
    feeKes,
    btcToKesRate,
  }
}

// ---------------------------------------------------------------------------
// Destination routing
// ---------------------------------------------------------------------------

type DarajaEndpointConfig = {
  path: string
  commandId: string
  partyB: string
  /** Fields added only for specific endpoint types. */
  extraFields?: Record<string, string>
}

const buildB2CConfig = (destination: string): DarajaEndpointConfig => ({
  path: "/mpesa/b2c/v1/paymentrequest",
  commandId: "BusinessPayment",
  partyB: destination,
})

/**
 * Maps a destination type to the correct Daraja endpoint + payload shape.
 *
 * ## TillNumber CommandID
 * `"BusinessBuyGoods"` is the likely value for Buy Goods tills per community
 * implementations, but this has NOT been confirmed from Safaricom's current
 * API reference. The Daraja portal (developer.safaricom.co.ke) issues an API
 * reference PDF once an app is registered — the correct CommandID for tills
 * MUST be verified from that document before tills can work in production.
 */
const buildB2BConfig = (
  destination: string,
  destinationType: "TillNumber" | "PayBill",
): DarajaEndpointConfig => {
  const accountRef = `PAYOUT-${Date.now()}`

  if (destinationType === "PayBill") {
    return {
      path: "/mpesa/b2b/v1/paymentrequest",
      commandId: "BusinessPayBill",
      partyB: destination,
      extraFields: { AccountReference: accountRef },
    }
  }

  // TillNumber (Buy Goods) — CommandID unconfirmed (see summary).
  return {
    path: "/mpesa/b2b/v1/paymentrequest",
    commandId: "BusinessBuyGoods",
    partyB: destination,
    extraFields: { AccountReference: accountRef },
  }
}

export const buildDarajaEndpointConfig = (
  destinationType: PayoutDestinationType,
  destination: string,
): DarajaEndpointConfig => {
  switch (destinationType) {
    case "PhoneNumber":
      return buildB2CConfig(destination)
    case "TillNumber":
    case "PayBill":
      return buildB2BConfig(destination, destinationType)
  }
}

// ---------------------------------------------------------------------------
// Request body construction
// ---------------------------------------------------------------------------

type B2CPayload = {
  InitiatorName: string
  SecurityCredential: string
  CommandID: string
  Amount: string
  PartyA: string
  PartyB: string
  Remarks: string
  QueueTimeOutURL: string
  ResultURL: string
  Occasion: string
}

type B2BPayload = B2CPayload & {
  AccountReference?: string
}

export type DarajaRequestBodyOptions = {
  config: DarajaEndpointConfig
  amountKes: number
  shortcode: string
  initiatorName: string
  securityCredential: string
  resultUrl: string
  timeoutUrl: string
}

export const buildDarajaRequestBody = (
  opts: DarajaRequestBodyOptions,
): B2CPayload | B2BPayload => {
  const {
    config,
    amountKes,
    shortcode,
    initiatorName,
    securityCredential,
    resultUrl,
    timeoutUrl,
  } = opts
  const base: B2CPayload = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: config.commandId,
    Amount: String(amountKes),
    PartyA: shortcode,
    PartyB: config.partyB,
    Remarks: "Afribit Pay off-ramp",
    QueueTimeOutURL: timeoutUrl,
    ResultURL: resultUrl,
    Occasion: "Afribit",
  }

  if (config.extraFields) {
    return { ...base, ...config.extraFields }
  }

  return base
}

// ---------------------------------------------------------------------------
// DarajaResult — local tracking for payouts
// ---------------------------------------------------------------------------

type DarajaResult = {
  payoutId: string
  status: PayoutStatus
  message: string
  destination: string
  kesAmount: number
  updatedAt: string
  /** Daraja's ConversationID / OriginatorConversationID for correlation. */
  darajaConversationId: string | null
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type DarajaPayoutProviderOptions = {
  /** BTC → KES exchange rate (KES per whole BTC) — caller's responsibility to
   *  provide, same pattern as the mock provider. */
  readonly btcToKesRate: number

  /** Safaricom API base URL. Defaults to sandbox. */
  readonly baseUrl?: string

  /** OAuth consumer key from developer.safaricom.co.ke. */
  readonly consumerKey: string

  /** OAuth consumer secret from developer.safaricom.co.ke. */
  readonly consumerSecret: string

  /** X.509 certificate PEM for SecurityCredential encryption.
   *  Sandbox cert: https://developer.safaricom.co.ke → Test Certificates page.
   *  Production cert: different — issued during production API approval. */
  readonly certificatePem: string

  /** M-Pesa shortcode. Defaults to the sandbox shortcode 174379. */
  readonly shortcode?: string

  /** B2C/B2B initiator name (the username assigned for API access). For sandbox
   *  this is typically `"apitest"` or the Consumer Key prefix. */
  readonly initiatorName?: string

  /** Initiator password (plaintext — encrypted with the cert before sending). */
  readonly initiatorPassword: string

  /** HTTPS endpoint to receive Safaricom's async B2C/B2B result callback.
   *  **This endpoint does not exist yet** — the app is pure mobile client with
   *  no backend. A minimal serverless function must be deployed before the
   *  callback flow can work end-to-end. Passing a placeholder URL here lets the
   *  provider submit payouts; results will remain "processing" until the
   *  callback receiver is live. */
  readonly resultUrl?: string

  /** Timeout callback URL. Same architectural gap as `resultUrl`. */
  readonly queueTimeoutUrl?: string
}

const DEFAULT_RESULT_URL = "https://placeholder.afribit.africa/daraja/callback"

export const createDarajaPayoutProvider = (
  opts: DarajaPayoutProviderOptions,
): PayoutProvider => {
  const {
    btcToKesRate,
    baseUrl = DARAJA_SANDBOX_BASE_URL,
    certificatePem,
    consumerKey,
    consumerSecret,
    shortcode = "174379",
    initiatorName = "apitest",
    initiatorPassword,
    resultUrl = DEFAULT_RESULT_URL,
    queueTimeoutUrl = DEFAULT_RESULT_URL,
  } = opts

  const oauth: OAuthClient = createOAuthClient({
    baseUrl,
    consumerKey,
    consumerSecret,
  })

  const storedResults = new Map<string, DarajaResult>()

  return {
    async getQuote(req: QuoteRequest): Promise<PayoutQuote> {
      if (req.satsAmount <= 0) {
        throw new Error(`Invalid sats amount: ${req.satsAmount}`)
      }
      return computeDarajaQuote(req.satsAmount, btcToKesRate)
    },

    async executePayout(req: PayoutRequest): Promise<PayoutResult> {
      const { quote, destinationType, destination, idempotencyKey } = req

      const existing = storedResults.get(idempotencyKey)
      if (existing) {
        return {
          payoutId: existing.payoutId,
          status: existing.status,
          message: existing.message,
          destination: existing.destination,
          kesAmount: existing.kesAmount,
          updatedAt: existing.updatedAt,
        }
      }

      const nowIso = new Date().toISOString()
      if (new Date(quote.expiresAt).getTime() < Date.now()) {
        return {
          payoutId: idempotencyKey,
          status: "failed",
          message: "Quote has expired — request a new quote and try again",
          destination,
          kesAmount: quote.kesAmount,
          updatedAt: nowIso,
        }
      }

      const digitsOnly = destination.replace(/\D/g, "")
      if (digitsOnly.length === 0) {
        return {
          payoutId: idempotencyKey,
          status: "failed",
          message: "Destination is empty after removing non-digit characters",
          destination,
          kesAmount: quote.kesAmount,
          updatedAt: nowIso,
        }
      }

      const endpointConfig = buildDarajaEndpointConfig(destinationType, digitsOnly)

      const securityCredential = encryptSecurityCredential(
        certificatePem,
        initiatorPassword,
      )

      const body = buildDarajaRequestBody({
        config: endpointConfig,
        amountKes: quote.kesAmount,
        shortcode,
        initiatorName,
        securityCredential,
        resultUrl,
        timeoutUrl: queueTimeoutUrl,
      })

      try {
        const accessToken = await oauth.getAccessToken()

        const response = await fetch(`${baseUrl}${endpointConfig.path}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        const responseBody = (await response.json().catch(() => ({}))) as {
          ConversationID?: string
          OriginatorConversationID?: string
          ResponseCode?: string
          ResponseDescription?: string
        }

        if (!response.ok) {
          const message =
            responseBody.ResponseDescription ||
            `Daraja ${endpointConfig.path} failed (${response.status})`
          const failure: DarajaResult = {
            payoutId: idempotencyKey,
            status: "failed",
            message,
            destination,
            kesAmount: quote.kesAmount,
            updatedAt: nowIso,
            darajaConversationId: responseBody.ConversationID ?? null,
          }
          storedResults.set(idempotencyKey, failure)
          return {
            payoutId: failure.payoutId,
            status: failure.status,
            message: failure.message,
            destination: failure.destination,
            kesAmount: failure.kesAmount,
            updatedAt: failure.updatedAt,
          }
        }

        /**
         * Daraja accepted the request. The real result arrives ASYNCHRONOUSLY
         * at `resultUrl` — see the callback gap documentation at the top of
         * this file. For now we store "processing" and rely on
         * `getPayoutStatus()` to surface the stored state.
         */
        const processing: DarajaResult = {
          payoutId: idempotencyKey,
          status: "processing",
          message: "M-Pesa payout submitted — awaiting callback confirmation",
          destination,
          kesAmount: quote.kesAmount,
          updatedAt: nowIso,
          darajaConversationId:
            responseBody.ConversationID ?? responseBody.OriginatorConversationID ?? null,
        }

        storedResults.set(idempotencyKey, processing)

        return {
          payoutId: processing.payoutId,
          status: processing.status,
          message: processing.message,
          destination: processing.destination,
          kesAmount: processing.kesAmount,
          updatedAt: processing.updatedAt,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const failure: DarajaResult = {
          payoutId: idempotencyKey,
          status: "failed",
          message: `Daraja request failed: ${message}`,
          destination,
          kesAmount: quote.kesAmount,
          updatedAt: nowIso,
          darajaConversationId: null,
        }
        storedResults.set(idempotencyKey, failure)
        return {
          payoutId: failure.payoutId,
          status: failure.status,
          message: failure.message,
          destination: failure.destination,
          kesAmount: failure.kesAmount,
          updatedAt: failure.updatedAt,
        }
      }
    },

    async getPayoutStatus(payoutId: string): Promise<PayoutResult> {
      const cached = storedResults.get(payoutId)
      if (cached) {
        return {
          payoutId: cached.payoutId,
          status: cached.status,
          message: cached.message,
          destination: cached.destination,
          kesAmount: cached.kesAmount,
          updatedAt: cached.updatedAt,
        }
      }

      /**
       * Daraja does not offer a customer-facing status-check endpoint —
       * results arrive exclusively via the asynchronous ResultURL callback.
       * Without a live callback receiver, unknown payout IDs will always
       * show "processing" with this placeholder message.
       */
      return {
        payoutId,
        status: "processing",
        message:
          "Payout status unknown — Daraja results are delivered via callback URL which requires a backend endpoint not yet deployed",
        destination: "",
        kesAmount: 0,
        updatedAt: new Date().toISOString(),
      }
    },
  }
}
