/**
 * BTCPay Server Greenfield API client for the Afribit treasury node.
 *
 * Auth: `Authorization: token <api-key>` (uses literal "token", not "Bearer").
 * Base URL from BTCPAY_SERVER_URL in .env.local.
 *
 * Endpoints consumed:
 *   GET /api/v1/api-keys/current      — connection check + permission audit
 *   GET /api/v1/stores/{storeId}/lightning-addresses — Lightning Address config
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BtcpayApiKeyInfo = {
  apiKey: string
  label: string
  permissions: string[]
}

export type BtcpayLightningAddress = {
  username: string
  currencyCode: string | null
  min: number | null
  max: number | null
  invoiceMetadata: Record<string, unknown> | null
}

export type BtcpayConnectionResult = {
  ok: true
  label: string
  permissions: string[]
}

export type BtcpayConnectionError = {
  ok: false
  error: string
  status?: number
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const authHeader = (apiKey: string): Record<string, string> => ({
  "Authorization": `token ${apiKey}`,
  "Content-Type": "application/json",
})

export type BtcpayClientOptions = {
  readonly serverUrl: string
  readonly apiKey: string
  readonly storeId: string
}

const stripTrailingSlash = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url

export type BtcpayClient = {
  checkConnection: () => Promise<BtcpayConnectionResult | BtcpayConnectionError>
  getStoreLightningAddresses: () => Promise<BtcpayLightningAddress[]>
}

export const createBtcpayClient = (opts: BtcpayClientOptions): BtcpayClient => {
  const baseUrl = stripTrailingSlash(opts.serverUrl)
  const { apiKey } = opts
  const { storeId } = opts

  const request = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: authHeader(apiKey),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => "unknown")
      throw new Error(
        `BTCPay ${path} returned ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    return (await response.json()) as T
  }

  return {
    async checkConnection(): Promise<BtcpayConnectionResult | BtcpayConnectionError> {
      try {
        const info = await request<BtcpayApiKeyInfo>("/api/v1/api-keys/current")
        return {
          ok: true,
          label: info.label,
          permissions: info.permissions,
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },

    async getStoreLightningAddresses(): Promise<BtcpayLightningAddress[]> {
      return request<BtcpayLightningAddress[]>(
        `/api/v1/stores/${storeId}/lightning-addresses`,
      )
    },
  }
}
