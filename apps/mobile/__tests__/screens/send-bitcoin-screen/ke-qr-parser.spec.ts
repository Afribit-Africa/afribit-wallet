import { parseKeQr as _parseKeQr } from "@app/screens/send-bitcoin-screen/ke-qr-parser"

const parseKeQr = _parseKeQr

describe("ke-qr-parser", () => {
  describe("Lightning detection", () => {
    const lightningCases = [
      "lnbc1pw9q8eppp5d8x4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q",
      "lntb1pw9q8eppp5d8x4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q",
      "lnbcrt1pw9q8eppp5d8x4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q",
      "lno1qwertyuiopasdfghjklzxcvbnm",
      "lightning:LNBC1...",
      "lnurl1qwertyuiopasdfghjklzxcvbnm",
      "sparkrt1qwertyuiopasdfghjkl",
      "alice@blink.sv",
      "test@example.co.ke",
    ]

    lightningCases.forEach((input) => {
      it(`detects "${input.slice(0, 20)}..." as lightning`, () => {
        expect(parseKeQr(input).type).toBe("lightning")
      })
    })
  })

  describe("PesaQR simple format", () => {
    it("detects till (BG) format", () => {
      const result = parseKeQr("BG|123456|100")
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("till")
        expect(result.merchantName).toBe("Till 123456")
        expect(result.amount).toBe("100")
      }
    })

    it("detects paybill (PB) format with account number", () => {
      const result = parseKeQr("PB|888880|500|ACC123")
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("paybill")
        expect(result.merchantName).toBe("Paybill 888880")
        expect(result.amount).toBe("500")
      }
    })

    it("detects send money (SM) format", () => {
      const result = parseKeQr("SM|0712345678|200")
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("send_money")
        expect(result.merchantName).toBe("0712345678")
        expect(result.amount).toBe("200")
      }
    })

    it("detects send money (SM) format without amount", () => {
      const result = parseKeQr("SM|0712345678")
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("send_money")
        expect(result.merchantName).toBe("0712345678")
        expect(result.amount).toBeNull()
      }
    })

    it("detects till (BG) format without amount", () => {
      const result = parseKeQr("BG|123456")
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("till")
        expect(result.merchantName).toBe("Till 123456")
        expect(result.amount).toBeNull()
      }
    })
  })

  describe("EMVCo TLV format", () => {
    it("detects KE-QR via Safaricom GUI in tag 26", () => {
      const tag26 = buildTlv("00", "506101") + buildTlv("01", "123456")
      const emvco = buildEmvcoQr({
        "26": tag26,
        "59": "Test Shop",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
    })

    it("detects KE-QR via merchant name containing MPESA", () => {
      const emvco = buildEmvcoQr({
        "59": "LIPA NA MPESA SHOP",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
    })

    it("detects KE-QR via Kenya country code 404", () => {
      const emvco = buildEmvcoQr({
        "58": "404",
        "59": "Acme Grocers",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
    })

    it("returns unknown for non-KE EMVCo QR (non-404 country code)", () => {
      const emvco = buildEmvcoQr({
        "58": "840",
        "59": "US Store",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("unknown")
    })

    it("infers paybill sub-type from additional data field with bill number", () => {
      const tag26 = buildTlv("00", "506101") + buildTlv("01", "888880")
      const tag62 = buildTlv("01", "ACC123") // Bill Number / Account Reference
      const emvco = buildEmvcoQr({
        "26": tag26,
        "59": "Test Paybill",
        "62": tag62,
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("paybill")
      }
    })

    it("infers paybill sub-type from merchant name containing PAYBILL", () => {
      const tag26 = buildTlv("00", "506101") + buildTlv("01", "888880")
      const emvco = buildEmvcoQr({
        "26": tag26,
        "59": "ACME PAYBILL SERVICE",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("paybill")
      }
    })

    it("infers till sub-type from merchant name containing TILL", () => {
      const tag26 = buildTlv("00", "506101") + buildTlv("01", "123456")
      const emvco = buildEmvcoQr({
        "26": tag26,
        "59": "DOWNTOWN TILL SHOP",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("till")
      }
    })

    it("returns unknown sub-type when no sub-type indicator found", () => {
      const tag26 = buildTlv("00", "506101") + buildTlv("01", "999999")
      const emvco = buildEmvcoQr({
        "26": tag26,
        "59": "Safaricom Merchant",
      })
      const result = parseKeQr(emvco)
      expect(result.type).toBe("ke_qr")
      if (result.type === "ke_qr") {
        expect(result.subType).toBe("unknown")
      }
    })
  })

  describe("Unknown / edge cases", () => {
    it("returns unknown for random string", () => {
      expect(parseKeQr("garbage").type).toBe("unknown")
    })

    it("returns unknown for empty string", () => {
      expect(parseKeQr("").type).toBe("unknown")
    })

    it("returns unknown for short string", () => {
      expect(parseKeQr("abc").type).toBe("unknown")
    })

    it("returns unknown for string starting with 0001 but no KE-QR indicators", () => {
      const emvco = buildEmvcoQr({
        "58": "840",
        "59": "Generic US Store",
      })
      expect(parseKeQr(emvco).type).toBe("unknown")
    })
  })
})

/** Helper: build an EMVCo TLV tag-value pair. */
function buildTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0")
  return tag + len + value
}

/** Helper: build a full EMVCo QR string from root-level fields. */
function buildEmvcoQr(fields: Record<string, string>): string {
  let result = buildTlv("00", "01") + buildTlv("01", "11")
  for (const [tag, value] of Object.entries(fields)) {
    result += buildTlv(tag, value)
  }
  return result
}