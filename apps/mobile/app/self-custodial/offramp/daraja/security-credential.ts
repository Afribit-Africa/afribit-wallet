import Crypto from "react-native-quick-crypto"

/**
 * Encrypts the Daraja B2C/B2B initiator password using Safaricom's public
 * X.509 certificate (RSA PKCS#1 v1.5 padding).
 *
 * Daraja's `SecurityCredential` field is NOT a plain password — it's the
 * plaintext initiator password encrypted with Safaricom's public cert.
 * The certificate differs between sandbox and production environments;
 * obtaining the correct cert from developer.safaricom.co.ke is a pre-
 * requisite for this function to work.
 *
 * Encryption uses `react-native-quick-crypto` (already in this app's
 * dependency tree for Breez SDK / AES encryption in `app/utils/crypto.ts`).
 * No additional dependency is required.
 */
export const encryptSecurityCredential = (
  /** PEM-encoded X.509 certificate (Safaricom's public cert). */
  certificatePem: string,
  /** Plaintext initiator password. */
  initiatorPassword: string,
): string => {
  if (!certificatePem || certificatePem.trim().length === 0) {
    throw new Error("Daraja certificate PEM is empty or missing")
  }
  if (!initiatorPassword) {
    throw new Error("Initiator password is required for SecurityCredential")
  }

  const encrypted = Crypto.publicEncrypt(
    {
      key: certificatePem,
      padding: Crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(initiatorPassword, "utf-8"),
  )

  return encrypted.toString("base64")
}
