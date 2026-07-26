/**
 * Vendor-agnostic payout-provider abstraction.
 *
 * When a concrete M-Pesa payout vendor (IntaSend, Splice Africa, or direct
 * Safaricom Daraja) is chosen after real commercial conversations, its API
 * client implements this interface and slots in as the active provider.
 *
 * The vendor comparison and research notes live in docs/OFFRAMP_RESEARCH.md.
 * No provider is wired into the UI yet — the Scan screen shows "coming soon"
 * until the payout engine is integrated end-to-end.
 */

/** Supported M-Pesa destination types for B2C/B2B payouts. */
export type PayoutDestinationType = "PhoneNumber" | "TillNumber" | "PayBill"

/** Human-readable branch indicator returned alongside every payout status. */
export type PayoutStatus = "processing" | "fulfilled" | "failed"

/** A real-time rate quote that expires after a fixed window (typically 30 s). */
export type PayoutQuote = {
  /** ISO 8601 timestamp when this quote was generated. */
  readonly quotedAt: string
  /** ISO 8601 timestamp when this quote expires. */
  readonly expiresAt: string
  /** Source amount in satoshis. */
  readonly satsAmount: number
  /** Target amount in KES (whole shillings). */
  readonly kesAmount: number
  /** Platform / network fee in KES. */
  readonly feeKes: number
  /** BTC → KES exchange rate used for this quote (KES per BTC). */
  readonly btcToKesRate: number
}

/** What every payout execution returns. */
export type PayoutResult = {
  /** Opaque payout ID from the provider (stored for status checks). */
  readonly payoutId: string
  readonly status: PayoutStatus
  /** Human-readable status detail (e.g. "M-Pesa declined"). */
  readonly message: string
  /** The destination account number/phone that was credited. */
  readonly destination: string
  /** Final amount in KES that was paid out. */
  readonly kesAmount: number
  /** ISO 8601 timestamp of the latest status update. */
  readonly updatedAt: string
}

/** Parameters for requesting a fresh rate quote. */
export type QuoteRequest = {
  /** Amount in satoshis to convert. */
  readonly satsAmount: number
}

/** Parameters for executing a payout. */
export type PayoutRequest = {
  /** The quote that was accepted by the user (must not be expired). */
  readonly quote: PayoutQuote
  /** M-Pesa destination type. */
  readonly destinationType: PayoutDestinationType
  /** Destination account number / phone number (digits only). */
  readonly destination: string
  /** Opaque idempotency key set by the caller (prevents double-spend). */
  readonly idempotencyKey: string
  /**
   * Account reference for PayBill payouts (the customer's bill account number,
   * invoice ID, or other identifier the merchant needs to attribute the
   * payment). Only meaningful for PayBill; Till/PhoneNumber payouts do not
   * use this. When absent, the provider generates its own reference.
   */
  readonly accountReference?: string
}

/** Contract every M-Pesa payout provider must fulfil. */
export interface PayoutProvider {
  /**
   * Request a real-time BTC → KES rate quote.
   *
   * The returned quote includes an expiry window; the caller MUST re-quote if
   * the user hasn't accepted it before `expiresAt`.
   */
  getQuote(request: QuoteRequest): Promise<PayoutQuote>

  /**
   * Execute a payout from the platform's M-Pesa balance to the given
   * destination, at the rate agreed upon in the attached quote.
   *
   * Idempotency is guaranteed by the `idempotencyKey` — submitting the same
   * key twice returns the original result without double-spending.
   */
  executePayout(request: PayoutRequest): Promise<PayoutResult>

  /**
   * Poll the current status of a previously submitted payout.
   *
   * Useful for UI polling loops to update the user on "processing" payouts
   * that haven't reached a terminal state yet.
   */
  getPayoutStatus(payoutId: string): Promise<PayoutResult>
}
