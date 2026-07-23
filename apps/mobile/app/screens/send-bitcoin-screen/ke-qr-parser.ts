/**
 * KE-QR (Kenyan EMVCo Merchant-Presented QR) parser — v1, sandbox only.
 *
 * EMVCo MPQR (Merchant-Presented QR) standard:
 *   Tag(2 digits) + Length(2 digits) + Value(Length digits), repeated.
 *   - Tag "00": Payload Format Indicator → "01" = EMVCo format.
 *   - Tags "02"–"51": Merchant Account Information (sub-TLV).
 *   - Tag "52": Merchant Category Code.
 *   - Tag "53": Transaction Currency (ISO 4217 numeric).
 *   - Tag "54": Transaction Amount (decimal, optional).
 *   - Tag "58": Country Code (ISO 3166-1 numeric).
 *   - Tag "59": Merchant Name.
 *   - Tag "60": Merchant City.
 *   - Tag "62": Additional Data Field Template.
 *
 * Safaricom M-Pesa KE-QR typically embeds the merchant identifier inside
 * tag 26 (or sometimes 27) under sub-tag "00" — the Globally Unique
 * Identifier (GUI) for Safaricom is often "506101".  We treat the presence
 * of a Safaricom GUI in any merchant-account tag, OR a merchant name that
 * mentions "MPESA" or "SAFARICOM", as a positive KE-QR hit.
 *
 * This file is a PURE parser — no network calls, no SDKs, no persistence.
 */

export type KeQrResult =
  | { type: "ke_qr"; merchantName: string | null; amount: string | null }
  | { type: "lightning" }
  | { type: "unknown" }

/** Raw TLV fields parsed from the root. */
type TlvFields = Record<string, string>

const SAFARICOM_GUI = "506101"
const KE_COUNTRY_CODE = "404"

function parseTlv(input: string): TlvFields {
  const fields: TlvFields = {}
  let i = 0
  const len = input.length

  while (i + 4 <= len) {
    const tag = input.substring(i, i + 2)
    const lengthStr = input.substring(i + 2, i + 4)
    const valueLen = parseInt(lengthStr, 10)
    if (isNaN(valueLen) || i + 4 + valueLen > len) break
    fields[tag] = input.substring(i + 4, i + 4 + valueLen)
    i += 4 + valueLen
  }

  return fields
}

function looksLikeLightning(input: string): boolean {
  if (input.startsWith("lnbc") || input.startsWith("lntb") || input.startsWith("lnbcrt"))
    return true
  if (input.startsWith("lno")) return true
  if (/^lightning:/i.test(input)) return true
  if (input.startsWith("lnurl")) return true
  if (input.startsWith("spark")) return true
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)) return true
  return false
}

function looksLikeKeQr(fields: TlvFields): {
  isKeQr: boolean
  merchantName: string | null
  amount: string | null
} {
  let merchantName: string | null = fields["59"] ?? null
  const amount: string | null = fields["54"] ?? null

  for (const tag of Object.keys(fields)) {
    const tagNum = parseInt(tag, 10)
    if (tagNum >= 2 && tagNum <= 51) {
      const subFields = parseTlv(fields[tag])
      if (subFields["00"] === SAFARICOM_GUI) {
        return { isKeQr: true, merchantName, amount }
      }
    }
  }

  const merchUpper = (merchantName ?? "").toUpperCase()
  if (
    merchUpper.includes("MPESA") ||
    merchUpper.includes("M-PESA") ||
    merchUpper.includes("SAFARICOM") ||
    merchUpper.includes("LIPA NA M-PESA")
  ) {
    return { isKeQr: true, merchantName, amount }
  }

  if (fields["58"] === KE_COUNTRY_CODE && fields["58"] != null) {
    return { isKeQr: true, merchantName, amount }
  }

  return { isKeQr: false, merchantName: null, amount: null }
}

export function parseKeQr(input: string): KeQrResult {
  const trimmed = input.trim()

  if (looksLikeLightning(trimmed)) {
    return { type: "lightning" }
  }

  if (trimmed.length < 8) {
    return { type: "unknown" }
  }

  try {
    const fields = parseTlv(trimmed)
    if (fields["00"] !== "01") {
      return { type: "unknown" }
    }

    const keQrResult = looksLikeKeQr(fields)
    if (keQrResult.isKeQr) {
      return {
        type: "ke_qr",
        merchantName: keQrResult.merchantName,
        amount: keQrResult.amount,
      }
    }

    return { type: "unknown" }
  } catch {
    return { type: "unknown" }
  }
}