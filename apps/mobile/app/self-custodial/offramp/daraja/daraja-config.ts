import Config from "react-native-config"

/**
 * Daraja API configuration (Safaricom M-Pesa — vendor decided per founder,
 * superseding IntaSend / Splice Africa; see docs/DARAJA_INTEGRATION.md).
 *
 * Sandbox values below are Safaricom's own shared/public sandbox defaults
 * (shortcode 174379, passkey …e2c919) — they are NOT secrets. The Consumer
 * Key / Consumer Secret come from `.env.local` via `react-native-config` and
 * are provisioned from the developer.safaricom.co.ke portal.
 */

export const DARAJA_SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke"
export const DARAJA_PRODUCTION_BASE_URL = "https://api.safaricom.co.ke"

/**
 * Safaricom's public sandbox shortcode. Production shortcode is issued during
 * business KYC (see docs/DARAJA_INTEGRATION.md Part 1).
 */
export const DARAJA_SANDBOX_SHORTCODE = "174379"

/**
 * Safaricom's public sandbox passkey. Not a secret — it's available on the
 * developer portal's "Test Credentials" page.
 */
export const DARAJA_SANDBOX_PASSKEY =
  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"

// ---------------------------------------------------------------------------
// Required env variables — follow the requireBreezApiKey/requireBitikaApiKey
// convention in apps/mobile/app/self-custodial/config.ts.
// ---------------------------------------------------------------------------

export const requireDarajaConsumerKey = (): string => {
  const key = Config.DARAJA_CONSUMER_KEY
  if (!key) {
    throw new Error("DARAJA_CONSUMER_KEY is not configured for this build")
  }
  return key
}

export const requireDarajaConsumerSecret = (): string => {
  const secret = Config.DARAJA_CONSUMER_SECRET
  if (!secret) {
    throw new Error("DARAJA_CONSUMER_SECRET is not configured for this build")
  }
  return secret
}

export const requireDarajaInitiatorPassword = (): string => {
  const password = Config.DARAJA_INITIATOR_PASSWORD
  if (!password) {
    throw new Error("DARAJA_INITIATOR_PASSWORD is not configured for this build")
  }
  return password
}

export const requireDarajaCertificatePem = (): string => {
  const pem = Config.DARAJA_CERTIFICATE_PEM
  if (!pem) {
    throw new Error("DARAJA_CERTIFICATE_PEM is not configured for this build")
  }
  return pem
}

export const requireDarajaTreasuryLnAddress = (): string => {
  const address = Config.DARAJA_TREASURY_LN_ADDRESS
  if (!address) {
    throw new Error("DARAJA_TREASURY_LN_ADDRESS is not configured for this build")
  }
  return address
}

export const hasDarajaTreasuryLnAddress = (): boolean =>
  Boolean(Config.DARAJA_TREASURY_LN_ADDRESS)

export const requireDarajaSecurityCredential = (): string => {
  const cred = Config.DARAJA_SECURITY_CREDENTIAL
  if (!cred) {
    throw new Error("DARAJA_SECURITY_CREDENTIAL is not configured for this build")
  }
  return cred
}

export const hasDarajaSecurityCredential = (): boolean =>
  Boolean(Config.DARAJA_SECURITY_CREDENTIAL)
