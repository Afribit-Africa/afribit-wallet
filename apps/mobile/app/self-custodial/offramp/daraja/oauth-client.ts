/**
 * OAuth 2.0 client-credentials token manager for Safaricom Daraja.
 *
 * Tokens are valid for 3600 seconds. This client fetches on first use and
 * refreshes automatically before the previous token expires (60s safety margin).
 *
 * It is stateless across app restarts — a cold start simply fetches a fresh
 * token. The host app MUST call the Safaricom OAuth endpoint directly (no
 * BFF proxy) because Daraja does not support server-side token scoping beyond
 * IP whitelist, and that's the standard mobile-app-to-Daraja pattern used by
 * most M-Pesa integrators.
 */

type OAuthToken = {
  accessToken: string
  expiresAtMs: number
}

const EXPIRY_BUFFER_MS = 60 * 1000

export type OAuthClient = {
  /**
   * Returns a valid access token, fetching a new one if the current token
   * is absent or expired (with buffer).
   */
  getAccessToken(): Promise<string>
}

export type OAuthClientOptions = {
  /** e.g. https://sandbox.safaricom.co.ke */
  readonly baseUrl: string
  readonly consumerKey: string
  readonly consumerSecret: string
}

export const createOAuthClient = (opts: OAuthClientOptions): OAuthClient => {
  const { baseUrl, consumerKey, consumerSecret } = opts
  let token: OAuthToken | null = null
  let pendingRefresh: Promise<OAuthToken> | null = null

  const authHeader =
    "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")

  const fetchToken = async (): Promise<OAuthToken> => {
    const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Daraja OAuth failed (${response.status}): ${body}`)
    }

    const data = (await response.json()) as {
      access_token?: string
      expires_in?: number | string
    }

    const accessToken = data.access_token
    if (!accessToken && typeof data === "string") {
      throw new Error("Daraja OAuth returned a string, expected JSON")
    }
    if (!accessToken) {
      throw new Error("Daraja OAuth response missing access_token")
    }

    const expiresIn = Number(data.expires_in ?? 3599)

    return {
      accessToken,
      expiresAtMs: Date.now() + expiresIn * 1000,
    }
  }

  return {
    async getAccessToken(): Promise<string> {
      if (token && Date.now() < token.expiresAtMs - EXPIRY_BUFFER_MS) {
        return token.accessToken
      }

      // Serializes concurrent callers on a single in-flight refresh so only
      // one OAuth round-trip fires even with rapid overlapping requests.
      // eslint-disable-next-line require-atomic-updates
      if (pendingRefresh) {
        // eslint-disable-next-line require-atomic-updates
        token = await pendingRefresh
      } else {
        // eslint-disable-next-line require-atomic-updates
        pendingRefresh = fetchToken()
        try {
          // eslint-disable-next-line require-atomic-updates
          token = await pendingRefresh
        } finally {
          // eslint-disable-next-line require-atomic-updates
          pendingRefresh = null
        }
      }

      return token.accessToken
    },
  }
}
