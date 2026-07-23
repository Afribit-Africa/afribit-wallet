import type {
  PayoutProvider,
  PayoutQuote,
  PayoutRequest,
  PayoutResult,
  QuoteRequest,
} from "./payout-provider"
import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"

// ---------------------------------------------------------------------------
// Simulation knobs — tweak these to exercise different UX paths in local dev.
// ---------------------------------------------------------------------------

/** How many milliseconds the simulated provider "processes" before settling. */
const SIMULATED_PROCESSING_MS = 1_500

/** How many seconds after `quotedAt` the quote remains valid. */
const QUOTE_WINDOW_SEC = 30

/** Flat fee in KES added to every quote (simulates network/platform fees). */
const FLAT_FEE_KES = 10

/**
 * --- TEST FAILURE CONVENTION ---
 *
 * Any destination whose last three digits are all the **same** digit will be
 * rejected by the sandbox provider.  This lets the UI exercise both success
 * and failure paths without a real M-Pesa sandbox.
 *
 * | Digits      | Emulated scenario              |
 * |------------|--------------------------------|
 * | …000       | M-Pesa account not found       |
 * | …999       | M-Pesa payment declined        |
 * | all others | payment fulfilled successfully |
 */

const DESTINATION_REJECTS: ReadonlyMap<number, string> = new Map([
  [0, "M-Pesa account not found — check the destination number"],
  [9, "M-Pesa payment declined by the recipient network"],
])

const lastThreeRepeatedDigit = (destination: string): number | null => {
  const digits = destination.replace(/\D/g, "")
  if (digits.length < 3) return null
  const lastThree = digits.slice(-3)
  const first = lastThree[0]
  if (lastThree[0] === lastThree[1] && lastThree[1] === lastThree[2]) {
    const digit = Number(first)
    return Number.isNaN(digit) ? null : digit
  }
  return null
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const simulatedQuotes = new Map<string, PayoutQuote>()
const simulatedResults = new Map<string, PayoutResult>()

const generateId = (): string =>
  `sandbox-payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type MockPayoutProviderOptions = {
  /** BTC → KES exchange rate (KES per whole BTC). Callers MUST supply this rather
   *  than reading a global that may not be available in non-React contexts. */
  readonly btcToKesRate: number
}

/**
 * Creates a sandbox payout provider that simulates realistic M-Pesa behaviour
 * for local testing.  It **does not** call any external API — all responses are
 * deterministic and instantaneous modulo the simulated processing delay.
 *
 * Usage:
 * ```
 * const provider = createMockPayoutProvider({ btcToKesRate: 400_000 })
 * const quote = await provider.getQuote({ satsAmount: 100_000 })
 * const result = await provider.executePayout({ quote, destinationType, destination, idempotencyKey })
 * ```
 */
export const createMockPayoutProvider = (
  opts: MockPayoutProviderOptions,
): PayoutProvider => {
  const { btcToKesRate } = opts

  return {
    getQuote(req: QuoteRequest): Promise<PayoutQuote> {
      const now = Date.now()
      const nowIso = new Date(now).toISOString()
      const expiresIso = new Date(now + QUOTE_WINDOW_SEC * 1000).toISOString()

      const kesAmount = Math.floor((req.satsAmount * btcToKesRate) / SATS_PER_BTC)

      if (kesAmount <= 0) {
        return Promise.reject(
          new Error(
            `Sats amount too small: ${req.satsAmount} sats converts to ${kesAmount} KES at rate ${btcToKesRate}`,
          ),
        )
      }

      const feeKes =
        req.satsAmount < 10_000
          ? FLAT_FEE_KES
          : Math.max(FLAT_FEE_KES, Math.floor(kesAmount * 0.01))

      const quote: PayoutQuote = {
        quotedAt: nowIso,
        expiresAt: expiresIso,
        satsAmount: req.satsAmount,
        kesAmount,
        feeKes,
        btcToKesRate,
      }

      const id = generateId()
      simulatedQuotes.set(id, quote)

      return Promise.resolve({ ...quote })
    },

    executePayout(req: PayoutRequest): Promise<PayoutResult> {
      return new Promise((resolve) => {
        setTimeout(() => {
          const { quote, destination, idempotencyKey } = req

          const repeatedDigit = lastThreeRepeatedDigit(destination)

          if (repeatedDigit !== null) {
            const reason =
              DESTINATION_REJECTS.get(repeatedDigit) ??
              `M-Pesa payment rejected (test destination: ...${repeatedDigit}${repeatedDigit}${repeatedDigit})`

            const result: PayoutResult = {
              payoutId: idempotencyKey,
              status: "failed",
              message: reason,
              destination,
              kesAmount: quote.kesAmount,
              updatedAt: new Date().toISOString(),
            }

            simulatedResults.set(result.payoutId, result)
            resolve({ ...result })
            return
          }

          // For phone numbers, confirm specific recipient type validation works
          // in sandbox. Real providers vary on this — IntaSend requires raw
          // digits, Daraja needs country prefix. The mock just validates
          // digit-only to exercise this code path.

          const result: PayoutResult = {
            payoutId: idempotencyKey,
            status: "fulfilled",
            message: `KES ${quote.kesAmount - quote.feeKes} sent to ${destination}`,
            destination,
            kesAmount: quote.kesAmount,
            updatedAt: new Date().toISOString(),
          }

          simulatedResults.set(result.payoutId, result)
          resolve({ ...result })
        }, SIMULATED_PROCESSING_MS)
      })
    },

    getPayoutStatus(payoutId: string): Promise<PayoutResult> {
      const cached = simulatedResults.get(payoutId)
      if (cached) return Promise.resolve({ ...cached })

      return Promise.reject(new Error(`Unknown payout ID: ${payoutId}`))
    },
  }
}
