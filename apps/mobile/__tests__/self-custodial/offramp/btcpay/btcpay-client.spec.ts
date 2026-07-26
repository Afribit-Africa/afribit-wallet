import {
  createBtcpayClient,
  type BtcpayClientOptions,
  type BtcpayLightningAddress,
} from "@app/self-custodial/offramp/btcpay/btcpay-client"

const TEST_OPTS: BtcpayClientOptions = {
  serverUrl: "https://pay.bitcoin.co.ke",
  apiKey: "test-api-key",
  storeId: "test-store-id",
}

const mockFetch = (status: number, body: unknown) =>
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  )

const mockApiKeyInfo = {
  apiKey: "test-api-key",
  label: "Afribit Pay",
  permissions: [
    "btcpay.store.canviewstoresettings",
    "btcpay.store.cancreatelightninginvoice",
    "btcpay.store.canuselightningnode",
  ],
}

const mockLightningAddresses: BtcpayLightningAddress[] = [
  {
    username: "afribitpay",
    currencyCode: "USD",
    min: null,
    max: null,
    invoiceMetadata: null,
  },
]

describe("createBtcpayClient", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("checkConnection", () => {
    it("returns ok:true with label and permissions on success", async () => {
      mockFetch(200, mockApiKeyInfo)
      const client = createBtcpayClient(TEST_OPTS)
      const result = await client.checkConnection()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.label).toBe("Afribit Pay")
        expect(result.permissions).toContain("btcpay.store.canviewstoresettings")
      }
    })

    it("uses the literal 'token' auth scheme, not 'Bearer'", async () => {
      const fetchSpy = mockFetch(200, mockApiKeyInfo)
      const client = createBtcpayClient(TEST_OPTS)
      await client.checkConnection()

      const [url, init] = fetchSpy.mock.calls[0]
      const headers = init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe("token test-api-key")
    })

    it("strips trailing slash from serverUrl", async () => {
      const fetchSpy = mockFetch(200, mockApiKeyInfo)
      const client = createBtcpayClient({
        ...TEST_OPTS,
        serverUrl: "https://pay.bitcoin.co.ke/",
      })
      await client.checkConnection()

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toBe("https://pay.bitcoin.co.ke/api/v1/api-keys/current")
    })

    it("returns ok:false on network error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"))
      const client = createBtcpayClient(TEST_OPTS)
      const result = await client.checkConnection()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("Network error")
      }
    })

    it("returns ok:false on 401 unauthorized", async () => {
      mockFetch(401, { message: "Unauthorized" })
      const client = createBtcpayClient(TEST_OPTS)
      const result = await client.checkConnection()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("401")
      }
    })

    it("returns ok:false on 404 (wrong URL)", async () => {
      mockFetch(404, {})
      const client = createBtcpayClient(TEST_OPTS)
      const result = await client.checkConnection()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("404")
      }
    })
  })

  describe("getStoreLightningAddresses", () => {
    it("returns lightning addresses for the store", async () => {
      mockFetch(200, mockLightningAddresses)
      const client = createBtcpayClient(TEST_OPTS)
      const addresses = await client.getStoreLightningAddresses()

      expect(addresses).toHaveLength(1)
      expect(addresses[0].username).toBe("afribitpay")
      expect(addresses[0].currencyCode).toBe("USD")
    })

    it("calls the correct store-scoped endpoint", async () => {
      const fetchSpy = mockFetch(200, mockLightningAddresses)
      const client = createBtcpayClient(TEST_OPTS)
      await client.getStoreLightningAddresses()

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toContain("/api/v1/stores/test-store-id/lightning-addresses")
    })

    it("throws on non-200 response", async () => {
      mockFetch(403, { message: "Forbidden" })
      const client = createBtcpayClient(TEST_OPTS)

      await expect(client.getStoreLightningAddresses()).rejects.toThrow("403")
    })

    it("throws on empty store (no addresses configured)", async () => {
      mockFetch(200, [])
      const client = createBtcpayClient(TEST_OPTS)
      const addresses = await client.getStoreLightningAddresses()

      expect(addresses).toEqual([])
    })
  })
})
