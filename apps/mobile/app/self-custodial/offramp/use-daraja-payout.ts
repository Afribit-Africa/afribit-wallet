import { useCallback, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"

import { WalletCurrency } from "@app/graphql/generated"
import { SATS_PER_BTC, usePriceConversion } from "@app/hooks/use-price-conversion"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { DisplayCurrency } from "@app/types/amounts"
import { prepareSend, executeSend } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

import type { PayoutDestinationType, PayoutProvider, PayoutQuote } from "./payout-provider"
import { createDarajaPayoutProvider } from "./daraja/daraja-payout-provider"
import {
  DARAJA_SANDBOX_BASE_URL,
  DARAJA_SANDBOX_SHORTCODE,
  hasDarajaSecurityCredential,
  hasDarajaTreasuryLnAddress,
  requireDarajaConsumerKey,
  requireDarajaConsumerSecret,
  requireDarajaInitiatorPassword,
  requireDarajaCertificatePem,
  requireDarajaSecurityCredential,
  requireDarajaTreasuryLnAddress,
} from "./daraja/daraja-config"

export type DarajaPayoutStatus =
  | "not-configured"
  | "idle"
  | "quote-ready"
  | "sending-sats"
  | "paying-mpesa"
  | "submitted"
  | "error"

export type UseDarajaPayoutParams = {
  destinationType: PayoutDestinationType
  destination: string
  kesAmount: number
  accountReference?: string
}

export type UseDarajaPayoutResult = {
  execute: () => Promise<void>
  confirmPayout: () => Promise<void>
  status: DarajaPayoutStatus
  error: string | null
  quote: PayoutQuote | null
}

const createProvider = (btcToKesRate: number): PayoutProvider | null => {
  try {
    const hasPrecomputedCred = hasDarajaSecurityCredential()
    return createDarajaPayoutProvider({
      btcToKesRate,
      baseUrl: DARAJA_SANDBOX_BASE_URL,
      consumerKey: requireDarajaConsumerKey(),
      consumerSecret: requireDarajaConsumerSecret(),
      securityCredential: hasPrecomputedCred
        ? requireDarajaSecurityCredential()
        : undefined,
      initiatorPassword: hasPrecomputedCred
        ? undefined
        : requireDarajaInitiatorPassword(),
      certificatePem: hasPrecomputedCred
        ? undefined
        : requireDarajaCertificatePem(),
      shortcode: DARAJA_SANDBOX_SHORTCODE,
    })
  } catch {
    return null
  }
}

export const useDarajaPayout = ({
  destinationType,
  destination,
  kesAmount,
  accountReference,
}: UseDarajaPayoutParams): UseDarajaPayoutResult => {
  const { convertMoneyAmountWithRounding, toDisplayMoneyAmount } = usePriceConversion()
  const { fractionDigits } = useDisplayCurrency()
  const { sdk } = useSelfCustodialWallet()
  const [status, setStatus] = useState<DarajaPayoutStatus>(
    hasDarajaTreasuryLnAddress() ? "idle" : "not-configured",
  )
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<PayoutQuote | null>(null)
  const quoteRef = useRef<PayoutQuote | null>(null)

  const execute = useCallback(async () => {
    if (!hasDarajaTreasuryLnAddress()) {
      setStatus("not-configured")
      return
    }

    if (!convertMoneyAmountWithRounding || !toDisplayMoneyAmount) {
      setError("Price data unavailable — please try again later")
      setStatus("error")
      return
    }

    try {
      setError(null)

      // DisplayCurrency MoneyAmounts are stored in MINOR units (e.g. KES
      // cents), same convention as everywhere else in this codebase (see
      // use-display-currency.ts's amountInMajorUnitOrSatsToMoneyAmount) -
      // `kesAmount` here is the major-unit figure the user typed, so it must
      // be scaled by 10^fractionDigits before wrapping.
      const displayAmount = toDisplayMoneyAmount(
        Math.round(kesAmount * 10 ** fractionDigits),
      )
      const btcAmount = convertMoneyAmountWithRounding(
        displayAmount,
        WalletCurrency.Btc,
        Math.ceil,
      )

      // computeDarajaQuote() needs a real KES-per-whole-BTC rate to recompute
      // its own authoritative kesAmount/feeKes - derive it from the same
      // real-time price data rather than hardcoding it.
      const oneBtcInDisplayMinorUnits = convertMoneyAmountWithRounding(
        { amount: SATS_PER_BTC, currency: WalletCurrency.Btc, currencyCode: "BTC" },
        DisplayCurrency,
        Math.round,
      )
      const btcToKesRate = oneBtcInDisplayMinorUnits.amount / 10 ** fractionDigits

      const provider = createProvider(btcToKesRate)
      if (!provider) {
        setError("M-Pesa payout configuration is incomplete — credentials are missing")
        setStatus("error")
        return
      }

      const newQuote = await provider.getQuote({ satsAmount: btcAmount.amount })
      quoteRef.current = newQuote
      setQuote(newQuote)
      setStatus("quote-ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get rate quote")
      setStatus("error")
    }
  }, [kesAmount, fractionDigits, convertMoneyAmountWithRounding, toDisplayMoneyAmount])

  const confirmPayout = useCallback(async () => {
    const currentQuote = quoteRef.current
    if (!currentQuote) return

    if (!sdk) {
      setError("Wallet not connected — please wait for sync to complete")
      setStatus("error")
      return
    }

    let treasuryAddress: string
    try {
      treasuryAddress = requireDarajaTreasuryLnAddress()
    } catch {
      setError("Treasury Lightning address not configured")
      setStatus("error")
      return
    }

    // btcToKesRate is unused on this path - confirmPayout() only calls
    // executePayout() with the quote already fetched by execute(), never
    // getQuote() again.
    const provider = createProvider(0)
    if (!provider) {
      setError("M-Pesa payout configuration is incomplete — credentials are missing")
      setStatus("error")
      return
    }

    try {
      setError(null)
      setStatus("sending-sats")

      const satsBigInt = BigInt(currentQuote.satsAmount)
      const prepared = await prepareSend(sdk, {
        paymentRequest: treasuryAddress,
        amount: satsBigInt,
      })
      await executeSend(sdk, prepared)

      setStatus("paying-mpesa")

      const idempotencyKey = uuidv4()
      await provider.executePayout({
        quote: currentQuote,
        destinationType,
        destination,
        idempotencyKey,
        accountReference,
      })

      setStatus("submitted")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout failed")
      setStatus("error")
    }
  }, [sdk, destinationType, destination])

  return { execute, confirmPayout, status, error, quote }
}
