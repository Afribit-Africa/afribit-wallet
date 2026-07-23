import { createMockPayoutProvider } from "@app/self-custodial/offramp/mock-payout-provider"
import type {
  PayoutQuote,
  PayoutRequest,
  QuoteRequest,
} from "@app/self-custodial/offramp/payout-provider"

const TEST_BTC_TO_KES_RATE = 400_000 // 1 BTC = 400 000 KES

const provider = createMockPayoutProvider({ btcToKesRate: TEST_BTC_TO_KES_RATE })

const validDestination = "254712345678"
const validPhoneRequest = (
  quote: PayoutQuote,
  idempotencyKey = "idem-1",
): PayoutRequest => ({
  quote,
  destinationType: "PhoneNumber",
  destination: validDestination,
  idempotencyKey,
})

// ---------------------------------------------------------------------------
// getQuote
// ---------------------------------------------------------------------------

describe("MockPayoutProvider.getQuote", () => {
  it("returns a quote with correct sats → KES conversion", async () => {
    const quote = await provider.getQuote({
      satsAmount: 100_000,
    } satisfies QuoteRequest)

    // 100_000 sats × 400_000 / 100_000_000 = 400 KES
    expect(quote.kesAmount).toBe(400)
    expect(quote.satsAmount).toBe(100_000)
    expect(quote.feeKes).toBeGreaterThanOrEqual(0)
    expect(quote.btcToKesRate).toBe(TEST_BTC_TO_KES_RATE)
  })

  it("includes an expiry timestamp roughly 30 seconds in the future", async () => {
    const quote = await provider.getQuote({ satsAmount: 50_000 })
    const quotedMs = new Date(quote.quotedAt).getTime()
    const expiresMs = new Date(quote.expiresAt).getTime()

    const deltaSec = (expiresMs - quotedMs) / 1000
    expect(deltaSec).toBeGreaterThanOrEqual(29)
    expect(deltaSec).toBeLessThanOrEqual(31)
  })

  it("rejects tiny amounts that convert to zero KES", async () => {
    await expect(provider.getQuote({ satsAmount: 1 })).rejects.toThrow(
      "Sats amount too small",
    )
  })

  it("rejects zero sats with a descriptive error", async () => {
    await expect(provider.getQuote({ satsAmount: 0 })).rejects.toThrow(
      "Sats amount too small",
    )
  })

  it("rejects negative sats with a descriptive error", async () => {
    await expect(provider.getQuote({ satsAmount: -1 })).rejects.toThrow(
      "Sats amount too small",
    )
  })

  it("uses a flat fee for amounts below 10 000 sats", async () => {
    // 9 999 sats × 400 000 / 100 000 000 = 39 KES, fee = flat 10 KES
    const quote = await provider.getQuote({ satsAmount: 9_999 })
    expect(quote.feeKes).toBe(10)
  })

  it("uses a percentage fee (min 10 KES) for amounts >= 10 000 sats", async () => {
    // 10 000 sats × 400 000 / 100 000 000 = 40 KES, fee = max(10, floor(40 × 0.01)) = 10
    const smallQuote = await provider.getQuote({ satsAmount: 10_000 })
    expect(smallQuote.feeKes).toBe(10)

    // 50 000 sats × 400 000 / 100 000 000 = 200 KES, fee = max(10, floor(200 × 0.01)) = 10
    const mediumQuote = await provider.getQuote({ satsAmount: 50_000 })
    expect(mediumQuote.feeKes).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// executePayout — success paths
// ---------------------------------------------------------------------------

describe("MockPayoutProvider.executePayout (success)", () => {
  it("returns fulfilled after a simulated processing delay", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const started = Date.now()

    const result = await provider.executePayout(validPhoneRequest(quote))

    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThanOrEqual(1_400)

    expect(result.status).toBe("fulfilled")
    expect(result.payoutId).toBe("idem-1")
    expect(result.destination).toBe(validDestination)
    expect(result.kesAmount).toBe(quote.kesAmount)
    expect(result.message).toContain("sent to")
    expect(result.updatedAt).toBeTruthy()
  })

  it("is idempotent — same idempotencyKey returns same result", async () => {
    const quote = await provider.getQuote({ satsAmount: 200_000 })

    const first = await provider.executePayout(validPhoneRequest(quote, "idem-dup"))
    const second = await provider.executePayout(validPhoneRequest(quote, "idem-dup"))

    expect(first.kesAmount).toBe(second.kesAmount)
    expect(first.message).toBe(second.message)
  })

  it("works for TillNumber destinations", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const result = await provider.executePayout({
      ...validPhoneRequest(quote, "idem-till"),
      destinationType: "TillNumber",
      destination: "123456",
    })
    expect(result.status).toBe("fulfilled")
  })

  it("works for PayBill destinations", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const result = await provider.executePayout({
      ...validPhoneRequest(quote, "idem-paybill"),
      destinationType: "PayBill",
      destination: "247247",
    })
    expect(result.status).toBe("fulfilled")
  })
})

// ---------------------------------------------------------------------------
// executePayout — test failure convention (last 3 digits repeating)
// ---------------------------------------------------------------------------

describe("MockPayoutProvider.executePayout (test failures)", () => {
  it("fails when the last three digits are 000 (account not found)", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const result = await provider.executePayout({
      ...validPhoneRequest(quote, "fail-000"),
      destination: "254700000",
    })

    expect(result.status).toBe("failed")
    expect(result.message).toContain("account not found")
    expect(result.kesAmount).toBe(quote.kesAmount)
  })

  it("fails when the last three digits are 999 (payment declined)", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const result = await provider.executePayout({
      ...validPhoneRequest(quote, "fail-999"),
      destination: "254712999",
    })

    expect(result.status).toBe("failed")
    expect(result.message).toContain("declined")
    expect(result.kesAmount).toBe(quote.kesAmount)
  })

  it("rejects destination with other repeating triple (generic message)", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const result = await provider.executePayout({
      ...validPhoneRequest(quote, "fail-444"),
      destination: "254711444",
    })

    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/M-Pesa payment rejected/i)
  })
})

// ---------------------------------------------------------------------------
// getPayoutStatus
// ---------------------------------------------------------------------------

describe("MockPayoutProvider.getPayoutStatus", () => {
  it("returns the result of a previously completed payout", async () => {
    const quote = await provider.getQuote({ satsAmount: 100_000 })
    const payout = await provider.executePayout(validPhoneRequest(quote, "status-1"))

    const status = await provider.getPayoutStatus(payout.payoutId)
    expect(status.payoutId).toBe(payout.payoutId)
    expect(status.status).toBe(payout.status)
  })

  it("throws for an unknown payout ID", async () => {
    await expect(provider.getPayoutStatus("nonexistent-id")).rejects.toThrow(
      "Unknown payout ID",
    )
  })
})
