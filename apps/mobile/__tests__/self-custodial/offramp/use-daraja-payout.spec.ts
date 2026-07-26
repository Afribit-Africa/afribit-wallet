import { renderHook, act } from "@testing-library/react-native"

import type { PayoutProvider, PayoutQuote } from "@app/self-custodial/offramp/payout-provider"

const mockGetQuote = jest.fn()
const mockExecutePayout = jest.fn()
const mockGetPayoutStatus = jest.fn()

const mockProvider: PayoutProvider = {
  getQuote: mockGetQuote,
  executePayout: mockExecutePayout,
  getPayoutStatus: mockGetPayoutStatus,
}

const mockPrepareSend = jest.fn()
const mockExecuteSend = jest.fn()

const mockTreasuryAddress = "treasury@afribit.africa"

let treasuryConfigured = false
let providerCreationFails = false
let securityCredentialAvailable = false
const mockSecurityCredential = "precomputed-sc-from-mock"

const createProviderMock = jest.fn()

jest.mock("@app/self-custodial/offramp/daraja/daraja-config", () => {
  const actual = jest.requireActual(
    "@app/self-custodial/offramp/daraja/daraja-config",
  )
  return {
    ...actual,
    hasDarajaTreasuryLnAddress: () => treasuryConfigured,
    requireDarajaTreasuryLnAddress: () => {
      if (!treasuryConfigured) throw new Error("not configured")
      return mockTreasuryAddress
    },
    requireDarajaConsumerKey: () => "ck",
    requireDarajaConsumerSecret: () => "cs",
    requireDarajaInitiatorPassword: () => {
      if (providerCreationFails) throw new Error("initiator password missing")
      return "ipass"
    },
    requireDarajaCertificatePem: () => {
      if (providerCreationFails) throw new Error("cert pem missing")
      return "-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----"
    },
    hasDarajaSecurityCredential: () => securityCredentialAvailable,
    requireDarajaSecurityCredential: () => {
      if (!securityCredentialAvailable) throw new Error("security credential missing")
      return mockSecurityCredential
    },
  }
})

jest.mock("@app/self-custodial/offramp/daraja/daraja-payout-provider", () => {
  const actual = jest.requireActual(
    "@app/self-custodial/offramp/daraja/daraja-payout-provider",
  )
  return {
    ...actual,
    createDarajaPayoutProvider: createProviderMock,
  }
})

// Must be assigned AFTER the mock is defined so the factory file can resolve it.
createProviderMock.mockReturnValue(mockProvider)

// Fake rate: 1 BTC = 5,000,000 KES => 1 sat = 5 KES cents (minor units).
// Mirrors the real convertMoneyAmountWithRounding's contract: DisplayCurrency
// amounts are always minor units, direction-aware conversion.
const CENTS_PER_SAT = 5

jest.mock("@app/hooks/use-price-conversion", () => {
  const actual = jest.requireActual("@app/hooks/use-price-conversion")
  return {
    ...actual,
    usePriceConversion: () => ({
      convertMoneyAmountWithRounding: (
        amount: { amount: number; currency: string },
        toCurrency: string,
        fn: (n: number) => number,
      ) => {
        if (toCurrency === "BTC") {
          return { amount: fn(amount.amount / CENTS_PER_SAT), currency: toCurrency, currencyCode: "BTC" }
        }
        return { amount: fn(amount.amount * CENTS_PER_SAT), currency: toCurrency, currencyCode: "KES" }
      },
      // Matches the real createToDisplayAmount - a pure pass-through, no
      // scaling. Scaling to minor units is the hook's own responsibility.
      toDisplayMoneyAmount: (amount: number) => ({
        amount,
        currency: "DisplayCurrency",
        currencyCode: "KES",
      }),
      convertMoneyAmount: undefined,
      displayCurrency: "KES",
      usdPerSat: null,
    }),
  }
})

jest.mock("@app/hooks/use-display-currency", () => {
  const actual = jest.requireActual("@app/hooks/use-display-currency")
  return {
    ...actual,
    useDisplayCurrency: () => ({ fractionDigits: 2 }),
  }
})

let mockSdkIsNull = false

jest.mock("@app/self-custodial/providers/wallet", () => {
  const actual = jest.requireActual("@app/self-custodial/providers/wallet")
  return {
    ...actual,
    useSelfCustodialWallet: () => ({
      sdk: mockSdkIsNull
        ? null
        : ({
            someMethod: jest.fn(),
          } as unknown as import("@breeztech/breez-sdk-spark-react-native").BreezSdkInterface),
      lightningAddress: "user@afribit.africa",
      wallets: [],
      status: mockSdkIsNull ? "unavailable" : "ready",
      retry: jest.fn(),
      allTransactions: [],
      lastReceivedPaymentId: null,
      hasMoreTransactions: false,
      loadingMore: false,
      loadMore: jest.fn(),
      refreshWallets: jest.fn(),
      refreshStableBalanceActive: jest.fn(),
      updateCurrentSelfCustodialAccount: jest.fn(),
      isStableBalanceActive: false,
    }),
  }
})

jest.mock("@app/self-custodial/bridge", () => ({
  prepareSend: mockPrepareSend,
  executeSend: mockExecuteSend,
}))

import { useDarajaPayout } from "@app/self-custodial/offramp/use-daraja-payout"

const makeQuote = (sats: number, kes: number, fee: number): PayoutQuote => ({
  quotedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30000).toISOString(),
  satsAmount: sats,
  kesAmount: kes,
  feeKes: fee,
  btcToKesRate: 400000,
})

describe("useDarajaPayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    treasuryConfigured = false
    providerCreationFails = false
    mockSdkIsNull = false
    securityCredentialAvailable = false
    createProviderMock.mockClear()
    createProviderMock.mockReturnValue(mockProvider)
  })

  describe("not-configured state", () => {
    it("returns not-configured when treasury address is missing", () => {
      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      expect(result.current.status).toBe("not-configured")
      expect(result.current.error).toBeNull()
      expect(result.current.quote).toBeNull()
    })

    it("stays not-configured after execute when treasury is missing", async () => {
      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("not-configured")
    })
  })

  describe("quote flow", () => {
    beforeEach(() => {
      treasuryConfigured = true
    })

    it("transitions to quote-ready after execute", async () => {
      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      expect(result.current.status).toBe("idle")

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("quote-ready")
      expect(result.current.quote).toEqual(quote)
      expect(mockGetQuote).toHaveBeenCalledTimes(1)
      // kesAmount 500 (major units) -> 50,000 minor units (fractionDigits: 2)
      // -> 10,000 sats at the fake CENTS_PER_SAT=5 rate. Guards against the
      // KES-minor-unit scaling bug (typed "500" being treated as 5 KES).
      expect(mockGetQuote).toHaveBeenCalledWith({ satsAmount: 10000 })
    })

    it("transitions to error when getQuote fails", async () => {
      mockGetQuote.mockRejectedValueOnce(new Error("Rate unavailable"))

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("error")
      expect(result.current.error).toContain("Rate unavailable")
    })

    it("transitions to error when provider creation fails (missing initiator password)", async () => {
      providerCreationFails = true

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("error")
      expect(result.current.error).toContain("credentials")
    })
  })

  describe("full payout flow", () => {
    beforeEach(() => {
      treasuryConfigured = true
    })

    it("goes through full flow: quote → sending-sats → paying-mpesa → submitted", async () => {
      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)
      mockPrepareSend.mockResolvedValueOnce({})
      mockExecuteSend.mockResolvedValueOnce(undefined)
      mockExecutePayout.mockResolvedValueOnce({
        payoutId: "payout-1",
        status: "processing",
        message: "Payout submitted",
        destination: "254708374149",
        kesAmount: 500,
        updatedAt: new Date().toISOString(),
      })

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })
      expect(result.current.status).toBe("quote-ready")

      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(result.current.status).toBe("submitted")
      expect(result.current.error).toBeNull()
      expect(mockPrepareSend).toHaveBeenCalledTimes(1)
      expect(mockExecuteSend).toHaveBeenCalledTimes(1)
      expect(mockExecutePayout).toHaveBeenCalledTimes(1)
      expect(mockExecutePayout).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationType: "PhoneNumber",
          destination: "254708374149",
        }),
      )
    })

    it("transitions to error when prepareSend fails", async () => {
      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)
      mockPrepareSend.mockRejectedValueOnce(new Error("Network error"))

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })
      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(result.current.status).toBe("error")
      expect(result.current.error).toContain("Network error")
      expect(mockExecutePayout).not.toHaveBeenCalled()
    })

    it("transitions to error when executePayout fails", async () => {
      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)
      mockPrepareSend.mockResolvedValueOnce({})
      mockExecuteSend.mockResolvedValueOnce(undefined)
      mockExecutePayout.mockRejectedValueOnce(new Error("M-Pesa declined"))

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })
      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(result.current.status).toBe("error")
      expect(result.current.error).toContain("M-Pesa declined")
      expect(mockPrepareSend).toHaveBeenCalledTimes(1)
    })

    it("transitions to error when confirmPayout called without sdk", async () => {
      mockSdkIsNull = true

      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "TillNumber",
          destination: "123456",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })
      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(result.current.status).toBe("error")
      expect(result.current.error).toContain("Wallet not connected")
    })

    it("does not call confirmPayout when no quote exists", async () => {
      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PayBill",
          destination: "247247",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(result.current.status).toBe("idle")
      expect(mockPrepareSend).not.toHaveBeenCalled()
    })

    it("uses correct destinationType and destination for PayBill", async () => {
      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)
      mockPrepareSend.mockResolvedValueOnce({})
      mockExecuteSend.mockResolvedValueOnce(undefined)
      mockExecutePayout.mockResolvedValueOnce({
        payoutId: "payout-2",
        status: "processing",
        message: "submitted",
        destination: "247247",
        kesAmount: 500,
        updatedAt: new Date().toISOString(),
      })

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PayBill",
          destination: "247247",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })
      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(mockExecutePayout).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationType: "PayBill",
          destination: "247247",
        }),
      )
    })

    it("uses correct destinationType and destination for TillNumber", async () => {
      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)
      mockPrepareSend.mockResolvedValueOnce({})
      mockExecuteSend.mockResolvedValueOnce(undefined)
      mockExecutePayout.mockResolvedValueOnce({
        payoutId: "payout-3",
        status: "processing",
        message: "submitted",
        destination: "123456",
        kesAmount: 500,
        updatedAt: new Date().toISOString(),
      })

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "TillNumber",
          destination: "123456",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })
      await act(async () => {
        await result.current.confirmPayout()
      })

      expect(mockExecutePayout).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationType: "TillNumber",
          destination: "123456",
        }),
      )
    })
  })

  describe("SecurityCredential resolution in createProvider", () => {
    beforeEach(() => {
      treasuryConfigured = true
    })

    it("passes precomputed SecurityCredential when available, skips fallback requires", async () => {
      securityCredentialAvailable = true

      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("quote-ready")
      expect(createProviderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          securityCredential: mockSecurityCredential,
          initiatorPassword: undefined,
          certificatePem: undefined,
        }),
      )
    })

    it("falls back to initiatorPassword + certificatePem when credential absent", async () => {
      securityCredentialAvailable = false

      const quote = makeQuote(2000, 500, 10)
      mockGetQuote.mockResolvedValueOnce(quote)

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("quote-ready")
      expect(createProviderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          securityCredential: undefined,
          initiatorPassword: "ipass",
          certificatePem: "-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----",
        }),
      )
    })

    it("provider creation fails (returns error) when NEITHER credential nor cert+password are available", async () => {
      securityCredentialAvailable = false
      providerCreationFails = true

      const { result } = renderHook(() =>
        useDarajaPayout({
          destinationType: "PhoneNumber",
          destination: "254708374149",
          kesAmount: 500,
        }),
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.status).toBe("error")
      expect(result.current.error).toContain("credentials")
    })
  })
})
