/**
 * Concrete `PayoutProvider` implementation for Safaricom Daraja (M-Pesa).
 *
 * ## Endpoints
 * - OAuth:         GET  /oauth/v1/generate?grant_type=client_credentials
 * - B2C (phone):  POST /mpesa/b2c/v3/paymentrequest
 * - B2B (till/paybill): POST /mpesa/b2b/v1/paymentrequest
 *
 * ## CommandID values
 * | Destination    | CommandID           | Status                 |
 * |---------------|--------------------|------------------------|
 * | PhoneNumber    | BusinessPayment    | ✅ confirmed           |
 * | PayBill        | BusinessPayBill    | ✅ confirmed           |
 * | TillNumber     | BusinessBuyGoods   | ✅ confirmed           |
 *
 * ## Callback receiver (see docs/BLOCKERS.md item 2 for the deployment story)
 * Both B2C and B2B are asynchronous. The initial POST returns an acknowledgement;
 * the real result (success/failure) arrives later at the `ResultURL`/`QueueTimeOutURL`
 * as an HTTPS POST from Safaricom. `afribit-daraja-callback` (deployed to the
 * production backend VM) now receives and persists these — see `resultUrl`/
 * `queueTimeoutUrl` above. `getPayoutStatus()` below checks the local
 * in-memory cache first, then falls back to querying that service directly
 * (see its own doc comment for the response-mapping details).
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
  path: "/mpesa/b2c/v3/paymentrequest",
  commandId: "BusinessPayment",
  partyB: destination,
})

/**
 * Maps a destination type to the correct Daraja endpoint + payload shape.
 * TillNumber uses `BusinessBuyGoods` CommandID per Safaricom's B2B API docs.
 */
const buildB2BConfig = (
  destination: string,
  destinationType: "TillNumber" | "PayBill",
  accountReference?: string,
): DarajaEndpointConfig => {
  const accountRef = accountReference || `PAYOUT-${Date.now()}`

  if (destinationType === "PayBill") {
    return {
      path: "/mpesa/b2b/v1/paymentrequest",
      commandId: "BusinessPayBill",
      partyB: destination,
      extraFields: { AccountReference: accountRef },
    }
  }

  // TillNumber (Buy Goods)
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
  accountReference?: string,
): DarajaEndpointConfig => {
  switch (destinationType) {
    case "PhoneNumber":
      return buildB2CConfig(destination)
    case "TillNumber":
    case "PayBill":
      return buildB2BConfig(destination, destinationType, accountReference)
  }
}

// ---------------------------------------------------------------------------
// Request body construction
// ---------------------------------------------------------------------------

type DarajaBasePayload = {
  OriginatorConversationID: string
  SecurityCredential: string
  CommandID: string
  Amount: string
  PartyA: string
  PartyB: string
  Remarks: string
  QueueTimeOutURL: string
  ResultURL: string
}

type B2CPayload = DarajaBasePayload & {
  InitiatorName: string
  Occassion: string
}

type B2BPayload = DarajaBasePayload & {
  Initiator: string
  SenderIdentifierType: string
  RecieverIdentifierType: string
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
  originatorConversationId: string
  isB2B: boolean
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
    originatorConversationId,
    isB2B,
  } = opts

  const base: DarajaBasePayload = {
    OriginatorConversationID: originatorConversationId,
    SecurityCredential: securityCredential,
    CommandID: config.commandId,
    Amount: String(amountKes),
    PartyA: shortcode,
    PartyB: config.partyB,
    Remarks: "Afribit Pay off-ramp",
    QueueTimeOutURL: timeoutUrl,
    ResultURL: resultUrl,
  }

  if (isB2B) {
    const b2b: B2BPayload = {
      ...base,
      Initiator: initiatorName,
      SenderIdentifierType: "4",
      RecieverIdentifierType: "4",
      ...(config.extraFields || {}),
    }
    return b2b
  }

  const b2c: B2CPayload = {
    ...base,
    InitiatorName: initiatorName,
    Occassion: "Afribit",
  }
  return b2c
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

  /** Pre-computed SecurityCredential (RSA-encrypted initiator password) from
   *  Safaricom's developer portal. When set, this value is sent verbatim and
   *  `certificatePem` / local encryption is skipped entirely.
   *  Sandbox: developer.safaricom.co.ke → Test Credentials → SecurityCredential.
   *  Production: issued during production API approval. */
  readonly securityCredential?: string

  /** X.509 certificate PEM for SecurityCredential encryption.
   *  Only used when `securityCredential` is not supplied. Optional — leave
   *  unset when using a pre-computed SecurityCredential from the portal.
   *  Sandbox cert: https://developer.safaricom.co.ke → Test Certificates page.
   *  Production cert: different — issued during production API approval. */
  readonly certificatePem?: string

  /** M-Pesa shortcode. Defaults to the sandbox shortcode 174379. */
  readonly shortcode?: string

  /** B2C/B2B initiator name (the username assigned for API access). For sandbox
   *  this is typically `"apitest"` or the Consumer Key prefix. */
  readonly initiatorName?: string

  /** Initiator password (plaintext — encrypted with the cert before sending).
   *  Required only when `securityCredential` is not supplied. */
  readonly initiatorPassword?: string

  /** HTTPS endpoint to receive Safaricom's async B2C/B2B result callback.
   *  Live as of 2026-07-26 — see `afribit-daraja-callback` (deployed to the
   *  production backend VM, reachable via a Pinggy Pro tunnel). */
  readonly resultUrl?: string

  /** Timeout callback URL — separate endpoint on the same callback receiver. */
  readonly queueTimeoutUrl?: string
}

const DEFAULT_RESULT_URL = "https://pay.afribit.africa/daraja/callback/result"
const DEFAULT_TIMEOUT_URL = "https://pay.afribit.africa/daraja/callback/timeout"

export const createDarajaPayoutProvider = (
  opts: DarajaPayoutProviderOptions,
): PayoutProvider => {
  const {
    btcToKesRate,
    baseUrl = DARAJA_SANDBOX_BASE_URL,
    certificatePem,
    securityCredential: precomputedCredential,
    consumerKey,
    consumerSecret,
    shortcode = "174379",
    initiatorName = "apitest",
    initiatorPassword,
    resultUrl = DEFAULT_RESULT_URL,
    queueTimeoutUrl = DEFAULT_TIMEOUT_URL,
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
      const { quote, destinationType, destination, idempotencyKey, accountReference } = req

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

      const endpointConfig = buildDarajaEndpointConfig(destinationType, digitsOnly, accountReference)

      const securityCredential = precomputedCredential
        ? precomputedCredential
        : certificatePem && initiatorPassword
          ? encryptSecurityCredential(certificatePem, initiatorPassword)
          : (() => {
              throw new Error(
                "No SecurityCredential available — provide either a pre-computed SecurityCredential or both a certificate PEM and initiator password",
              )
            })()

      const body = buildDarajaRequestBody({
        config: endpointConfig,
        amountKes: quote.kesAmount,
        shortcode,
        initiatorName,
        securityCredential,
        resultUrl,
        timeoutUrl: queueTimeoutUrl,
        originatorConversationId: idempotencyKey,
        isB2B: destinationType !== "PhoneNumber",
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

      const statusUrl = `${new URL(resultUrl).origin}/daraja/callback/status/${payoutId}`

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(statusUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.status === 404) {
          return {
            payoutId,
            status: "processing",
            message: "Awaiting callback from Safaricom",
            destination: "",
            kesAmount: 0,
            updatedAt: new Date().toISOString(),
          }
        }

        if (response.ok) {
          const record = (await response.json()) as {
            originatorConversationID?: string
            isSuccess?: boolean
            resultDesc?: string
            resultParameters?: Record<string, unknown>
            updatedAt?: string
            createdAt?: string
          }

          const isSuccess = record.isSuccess === true

          // amount was part of the original quote and is NOT stored by the
          // callback receiver (Safaricom's callback doesn't include it in a
          // single predictable field across B2C/B2B). B2C sends
          // TransactionAmount in resultParameters; B2B sends Amount. Try
          // both, fall back to 0 when neither is present.
          const kesAmount = (() => {
            const params = record.resultParameters ?? {}
            const raw = params.TransactionAmount ?? params.Amount
            const num = typeof raw === "number" ? raw : parseInt(String(raw), 10)
            return Number.isFinite(num) ? num : 0
          })()

          // destination is not returned by the callback receiver (it was
          // part of the original payout request, not the callback payload
          // that Safaricom sends). Returning "" here is a deliberate gap:
          // status checks via this path cannot reconstruct the destination
          // from callback data alone. The local in-memory cache (populated
          // by executePayout) has it for the same session.
          const destination = ""

          return {
            payoutId,
            status: isSuccess ? "fulfilled" : "failed",
            message: record.resultDesc ?? (isSuccess ? "M-Pesa payout completed" : "M-Pesa payout failed"),
            destination,
            kesAmount,
            updatedAt:
              record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
          }
        }

        console.warn(
          `Daraja callback status endpoint returned unexpected status ${response.status} for payout ${payoutId}`,
        )
      } catch (err) {
        console.warn(
          `Failed to check Daraja callback status for payout ${payoutId}:`,
          err instanceof Error ? err.message : String(err),
        )
      }

      return {
        payoutId,
        status: "processing",
        message: "Awaiting callback from Safaricom",
        destination: "",
        kesAmount: 0,
        updatedAt: new Date().toISOString(),
      }
    },
  }
}
