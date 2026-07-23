/**
 * KE-QR (Kenyan EMVCo Merchant-Presented QR) parser — v2, sandbox only.
 *
 * Recognizes two formats found in the wild:
 *
 *  1. PesaQR simple format (older/consumer-facing):
 *       BG|{tillNumber}|{amount}
 *       PB|{paybillNumber}|{amount}|{accountNumber}
 *       SM|{phoneNumber}|{amount}
 *
 *  2. EMVCo MPQR TLV format (official KE-QR standard, per CBK spec):
 *       Tag(2 digits) + Length(2 digits) + Value(Length digits), repeated.
 *       - Tag "00": Payload Format Indicator → "01" = EMVCo format.
 *       - Tags "02"–"51": Merchant Account Information (sub-TLV).
 *       - Tag "52": Merchant Category Code.
 *       - Tag "53": Transaction Currency (ISO 4217 numeric).
 *       - Tag "54": Transaction Amount (decimal, optional).
 *       - Tag "58": Country Code (ISO 3166-1 numeric).
 *       - Tag "59": Merchant Name.
 *       - Tag "60": Merchant City.
 *       - Tag "62": Additional Data Field Template (sub-TLV).
 *
 * Safaricom Daraja API TrxCode values (confirmed from public docs):
 *   BG = Buy Goods (Till Number)
 *   PB = Paybill
 *   SM = Send Money (P2P / phone number)
 *   WA = Withdraw Cash
 *   SB = Send to Business
 *
 * Sub-type detection strategy for EMVCo TLV (when we can't find the TrxCode
 * directly encoded — the exact sub-tag mapping is NOT publicly documented):
 *   - If tag 62 contains a sub-tag 01 (Bill Number / account reference),
 *     the QR is likely a Paybill (paybills need an account number to route).
 *   - If the merchant name includes "PAYBILL" or the merchant identifier
 *     looks like a paybill (typically 5-6 digits), lean paybill.
 *   - Otherwise, "ke_qr_generic" with whatever we could extract.
 *
 * This file is a PURE parser — no network calls, no SDKs, no persistence.
 */

export type KeQrSubType = "till" | "paybill" | "send_money" | "unknown"

export type KeQrResult =
  | {
      type: "ke_qr"
      subType: KeQrSubType
      merchantName: string | null
      amount: string | null
    }
  | { type: "lightning" }
  | { type: "unknown" }

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

/**
 * Detect PesaQR simple pipe-delimited format.
 * Confirmed from public source: github.com/DavidAmunga/pesaqr
 */
function parsePesaqrSimple(
  input: string,
): { type: "ke_qr"; subType: KeQrSubType; merchantName: string | null; amount: string | null } | null {
  const parts = input.split("|")
  if (parts.length < 2) return null

  const prefix = parts[0].toUpperCase()

  if (prefix === "BG" && parts.length >= 2) {
    return {
      type: "ke_qr",
      subType: "till",
      merchantName: `Till ${parts[1]}`,
      amount: parts.length >= 3 ? parts[2] : null,
    }
  }

  if (prefix === "PB" && parts.length >= 3) {
    return {
      type: "ke_qr",
      subType: "paybill",
      merchantName: `Paybill ${parts[1]}`,
      amount: parts.length >= 3 ? parts[2] : null,
    }
  }

  if (prefix === "SM" && parts.length >= 2) {
    return {
      type: "ke_qr",
      subType: "send_money",
      merchantName: parts[1],
      amount: parts.length >= 3 ? parts[2] : null,
    }
  }

  return null
}

/**
 * Detect EMVCo TLV-format KE-QR and determine sub-type.
 *
 * Confirmed from public sources:
 * - EMVCo MPQR standard structure
 * - Safaricom GUI "506101"
 * - Gidraf Orenja's KE-QR open-source implementation confirms CRC16 + EMVCo
 *
 * Inferred (not confirmed from a public spec):
 * - Tag 62 sub-tag 01 (Bill Number / account reference) indicates paybill
 * - Merchant name text heuristics (PAYBILL, TILL, LIPA) are fallback for sub-type
 */
function parseEmvcoKeQr(fields: TlvFields): {
  type: "ke_qr"
  subType: KeQrSubType
  merchantName: string | null
  amount: string | null
} | null {
  const merchantName: string | null = fields["59"] ?? null
  const amount: string | null = fields["54"] ?? null

  let isKeQr = false
  for (const tag of Object.keys(fields)) {
    const tagNum = parseInt(tag, 10)
    if (tagNum >= 2 && tagNum <= 51) {
      const subFields = parseTlv(fields[tag])
      if (subFields["00"] === SAFARICOM_GUI) {
        isKeQr = true
        break
      }
    }
  }

  if (!isKeQr) {
    const merchUpper = (merchantName ?? "").toUpperCase()
    if (
      merchUpper.includes("MPESA") ||
      merchUpper.includes("M-PESA") ||
      merchUpper.includes("SAFARICOM") ||
      merchUpper.includes("LIPA NA M-PESA")
    ) {
      isKeQr = true
    }
  }

  if (!isKeQr && fields["58"] === KE_COUNTRY_CODE) {
    isKeQr = true
  }

  if (!isKeQr) return null

  const subType = inferEmvcoSubType(fields, merchantName)
  return { type: "ke_qr", subType, merchantName, amount }
}

function inferEmvcoSubType(fields: TlvFields, merchantName: string | null): KeQrSubType {
  if (fields["62"]) {
    const additionalFields = parseTlv(fields["62"])
    if (additionalFields["01"]) {
      return "paybill"
    }
  }

  if (merchantName) {
    const upper = merchantName.toUpperCase()
    if (upper.includes("PAYBILL") || upper.includes("PAY BILL")) {
      return "paybill"
    }
    if (upper.includes("TILL") || upper.includes("BUY GOODS") || upper.includes("LIPA NA")) {
      return "till"
    }
  }

  return "unknown"
}

export function parseKeQr(input: string): KeQrResult {
  const trimmed = input.trim()

  if (looksLikeLightning(trimmed)) {
    return { type: "lightning" }
  }

  const pesaqrResult = parsePesaqrSimple(trimmed)
  if (pesaqrResult) {
    return pesaqrResult
  }

  if (trimmed.length < 8) {
    return { type: "unknown" }
  }

  try {
    const fields = parseTlv(trimmed)
    if (fields["00"] !== "01") {
      return { type: "unknown" }
    }

    const emvResult = parseEmvcoKeQr(fields)
    if (emvResult) {
      return emvResult
    }

    return { type: "unknown" }
  } catch {
    return { type: "unknown" }
  }
}