/* eslint-disable camelcase */
import {
  buildDarajaEndpointConfig,
  buildDarajaRequestBody,
  computeDarajaQuote,
} from "@app/self-custodial/offramp/daraja/daraja-payout-provider"
import { createOAuthClient } from "@app/self-custodial/offramp/daraja/oauth-client"
import { encryptSecurityCredential } from "@app/self-custodial/offramp/daraja/security-credential"
import {
  DARAJA_SANDBOX_SHORTCODE,
  DARAJA_SANDBOX_PASSKEY,
} from "@app/self-custodial/offramp/daraja/daraja-config"

// ---------------------------------------------------------------------------
// computeDarajaQuote
// ---------------------------------------------------------------------------

const TEST_RATE = 400_000

describe("computeDarajaQuote", () => {
  it("returns the correct fields and shapes", () => {
    const q = computeDarajaQuote(100_000, TEST_RATE)

    expect(q.satsAmount).toBe(100_000)
    expect(q.kesAmount).toBe(400) // 100k × 400k / 100M = 400
    expect(q.btcToKesRate).toBe(TEST_RATE)
    expect(q.feeKes).toBeGreaterThanOrEqual(0)
    expect(q.quotedAt).toBeTruthy()
    expect(q.expiresAt).toBeTruthy()
  })

  it("sets an expiry ~30 s in the future", () => {
    const q = computeDarajaQuote(50_000, TEST_RATE)
    const quotedMs = new Date(q.quotedAt).getTime()
    const expiresMs = new Date(q.expiresAt).getTime()
    expect((expiresMs - quotedMs) / 1000).toBe(30)
  })

  it("rejects zero sats", () => {
    expect(() => computeDarajaQuote(0, TEST_RATE)).toThrow("Sats amount too small")
  })

  it("rejects negative sats", () => {
    expect(() => computeDarajaQuote(-1, TEST_RATE)).toThrow("Sats amount too small")
  })

  it("uses flat fee for < 10k sats", () => {
    expect(computeDarajaQuote(9_999, TEST_RATE).feeKes).toBe(10)
  })

  it("uses percentage fee (min 10 KES) for >= 10k sats", () => {
    // 10k sats × 400k / 100M = 40 KES, 1% = 0 → max(10, 0) = 10
    expect(computeDarajaQuote(10_000, TEST_RATE).feeKes).toBe(10)
    // 50k sats × 400k / 100M = 200 KES, 1% = 2 → max(10, 2) = 10
    expect(computeDarajaQuote(50_000, TEST_RATE).feeKes).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// buildDarajaEndpointConfig
// ---------------------------------------------------------------------------

describe("buildDarajaEndpointConfig", () => {
  it("routes PhoneNumber to B2C with BusinessPayment", () => {
    const cfg = buildDarajaEndpointConfig("PhoneNumber", "254708374149")
    expect(cfg.path).toBe("/mpesa/b2c/v1/paymentrequest")
    expect(cfg.commandId).toBe("BusinessPayment")
    expect(cfg.partyB).toBe("254708374149")
    expect(cfg.extraFields).toBeUndefined()
  })

  it("routes PayBill to B2B with BusinessPayBill", () => {
    const cfg = buildDarajaEndpointConfig("PayBill", "247247")
    expect(cfg.path).toBe("/mpesa/b2b/v1/paymentrequest")
    expect(cfg.commandId).toBe("BusinessPayBill")
    expect(cfg.partyB).toBe("247247")
    expect(cfg.extraFields).toBeDefined()
    expect(cfg.extraFields?.AccountReference).toMatch(/^PAYOUT-/)
  })

  it("routes TillNumber to B2B with UNCONFIRMED BusinessBuyGoods", () => {
    const cfg = buildDarajaEndpointConfig("TillNumber", "123456")
    expect(cfg.path).toBe("/mpesa/b2b/v1/paymentrequest")
    expect(cfg.commandId).toBe("BusinessBuyGoods")
    expect(cfg.partyB).toBe("123456")
    expect(cfg.extraFields?.AccountReference).toMatch(/^PAYOUT-/)
  })
})

// ---------------------------------------------------------------------------
// buildDarajaRequestBody
// ---------------------------------------------------------------------------

describe("buildDarajaRequestBody", () => {
  const cert =
    "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3\n-----END CERTIFICATE-----"
  const cred = encryptSecurityCredential(cert, "testpassword")
  const shortcode = DARAJA_SANDBOX_SHORTCODE
  const initiator = "apitest"
  const resultUrl = "https://example.com/callback"
  const timeoutUrl = "https://example.com/timeout"
  const kesAmount = 500

  it("builds a valid B2C body for PhoneNumber", () => {
    const config = buildDarajaEndpointConfig("PhoneNumber", "254708374149")
    const body = buildDarajaRequestBody({
      config,
      amountKes: kesAmount,
      shortcode,
      initiatorName: initiator,
      securityCredential: cred,
      resultUrl,
      timeoutUrl,
    })

    expect(body.InitiatorName).toBe(initiator)
    expect(body.SecurityCredential).toBe(cred)
    expect(body.CommandID).toBe("BusinessPayment")
    expect(body.Amount).toBe("500")
    expect(body.PartyA).toBe(shortcode)
    expect(body.PartyB).toBe("254708374149")
    expect(body.ResultURL).toBe(resultUrl)
    expect(body.QueueTimeOutURL).toBe(timeoutUrl)
    expect(body.Remarks).toBe("Afribit Pay off-ramp")
    expect(body.Occasion).toBe("Afribit")
    expect((body as Record<string, unknown>).AccountReference).toBeUndefined()
  })

  it("includes AccountReference for PayBill", () => {
    const config = buildDarajaEndpointConfig("PayBill", "247247")
    const body = buildDarajaRequestBody({
      config,
      amountKes: kesAmount,
      shortcode,
      initiatorName: initiator,
      securityCredential: cred,
      resultUrl,
      timeoutUrl,
    })

    expect(body.CommandID).toBe("BusinessPayBill")
    expect(body.PartyB).toBe("247247")
    expect((body as Record<string, unknown>).AccountReference).toMatch(/^PAYOUT-/)
  })

  it("includes AccountReference for TillNumber", () => {
    const config = buildDarajaEndpointConfig("TillNumber", "123456")
    const body = buildDarajaRequestBody({
      config,
      amountKes: kesAmount,
      shortcode,
      initiatorName: initiator,
      securityCredential: cred,
      resultUrl,
      timeoutUrl,
    })

    expect(body.CommandID).toBe("BusinessBuyGoods")
    expect(body.PartyB).toBe("123456")
    expect((body as Record<string, unknown>).AccountReference).toMatch(/^PAYOUT-/)
  })
})

// ---------------------------------------------------------------------------
// encryptSecurityCredential
// ---------------------------------------------------------------------------

describe("encryptSecurityCredential", () => {
  it("produces a base64 string from a valid cert + password", () => {
    const cert =
      "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3\n-----END CERTIFICATE-----"
    const result = encryptSecurityCredential(cert, "testpassword")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
    expect(() => Buffer.from(result, "base64").toString("base64")).not.toThrow()
  })

  it("throws for empty cert PEM", () => {
    expect(() => encryptSecurityCredential("", "pw")).toThrow("certificate PEM is empty")
    expect(() => encryptSecurityCredential("   ", "pw")).toThrow(
      "certificate PEM is empty",
    )
  })

  it("throws for empty initiator password", () => {
    const cert =
      "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3\n-----END CERTIFICATE-----"
    expect(() => encryptSecurityCredential(cert, "")).toThrow(
      "Initiator password is required",
    )
  })

  it("produces deterministic output for same cert + password", () => {
    const cert =
      "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3\n-----END CERTIFICATE-----"
    const a = encryptSecurityCredential(cert, "samepassword")
    const b = encryptSecurityCredential(cert, "samepassword")
    expect(a).toBe(b)
  })
})

// ---------------------------------------------------------------------------
// OAuth client
// ---------------------------------------------------------------------------

describe("createOAuthClient", () => {
  beforeEach(() => {
    jest.spyOn(global, "fetch").mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("calls the correct Daraja endpoint and returns a token", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "test-token-123", expires_in: 3599 }), {
        status: 200,
      }),
    )

    const client = createOAuthClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "ck",
      consumerSecret: "cs",
    })

    const token = await client.getAccessToken()
    expect(token).toBe("test-token-123")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic "),
        }),
      }),
    )
  })

  it("returns a cached token without re-fetching on subsequent calls", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "cached-token", expires_in: 3599 }), {
        status: 200,
      }),
    )

    const client = createOAuthClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "ck",
      consumerSecret: "cs",
    })

    await client.getAccessToken()
    await client.getAccessToken()
    await client.getAccessToken()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("re-fetches when the token is expired", async () => {
    // Return first token with 0 seconds expiry so it's expired on next call
    const mockFetch = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "expired", expires_in: 0 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "fresh", expires_in: 3599 }), {
          status: 200,
        }),
      )

    const client = createOAuthClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "ck",
      consumerSecret: "cs",
    })

    const first = await client.getAccessToken()
    expect(first).toBe("expired")

    // Wait a tick so the token is definitely expired
    await new Promise((r) => setTimeout(r, 1))

    const second = await client.getAccessToken()
    expect(second).toBe("fresh")

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("throws when the OAuth endpoint returns non-200", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("Unauthorized", { status: 401 }))

    const client = createOAuthClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "bad",
      consumerSecret: "bad",
    })

    await expect(client.getAccessToken()).rejects.toThrow("Daraja OAuth failed (401)")
  })

  it("throws when the OAuth response is missing access_token", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_client" }), { status: 200 }),
      )

    const client = createOAuthClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "ck",
      consumerSecret: "cs",
    })

    await expect(client.getAccessToken()).rejects.toThrow(
      "Daraja OAuth response missing access_token",
    )
  })

  it("includes the Basic auth header with base64-encoded credentials", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3599 }), {
        status: 200,
      }),
    )

    const consumerKey = "myConsumerKey"
    const consumerSecret = "myConsumerSecret"
    const expectedBase64 = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      "base64",
    )

    const client = createOAuthClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey,
      consumerSecret,
    })

    await client.getAccessToken()

    const authHeader = mockFetch.mock.calls[0][1]?.headers as
      | { Authorization?: string }
      | undefined
    expect(authHeader?.Authorization).toBe(`Basic ${expectedBase64}`)
  })
})
