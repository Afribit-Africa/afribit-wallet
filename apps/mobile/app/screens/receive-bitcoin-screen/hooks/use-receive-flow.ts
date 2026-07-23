import { useCallback } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  isNonZeroMoneyAmount,
} from "@app/types/amounts"

import type { SelfCustodialPaymentRequestState } from "@app/self-custodial/hooks/types"

import { Invoice, PaymentRequestState } from "../payment/index.types"
import { usePaymentActions } from "./use-payment-actions"
import { useLnurlWithdraw } from "./use-lnurl-withdraw"

type RequestState = SelfCustodialPaymentRequestState

export const useReceiveFlow = (request: RequestState) => {
  const {
    pr,
    setAmount,
    setType,
    setMemo,
    switchReceivingWallet,
    type: requestType,
    state: requestState,
    canUsePaycode,
    memoChangeText,
    unitOfAccountAmount,
    receivingWalletDescriptor,
  } = request

  const activeCopyableContent = pr?.info?.data?.getCopyableInvoiceFn()

  const { copyToClipboard: handleCopy, share: handleShare } = usePaymentActions({
    copyableContent: activeCopyableContent,
    invoiceType: requestType,
  })

  const receiveViaNFC = useLnurlWithdraw(pr)

  const isReady = requestState !== PaymentRequestState.Loading

  const handleSetAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
      setAmount(amount)
      if (isNonZeroMoneyAmount(amount) && requestType === Invoice.PayCode) {
        setType(Invoice.Lightning)
        return
      }
      if (
        !isNonZeroMoneyAmount(amount) &&
        requestType === Invoice.Lightning &&
        canUsePaycode &&
        !memoChangeText
      ) {
        setType(Invoice.PayCode)
      }
    },
    [setAmount, setType, requestType, canUsePaycode, memoChangeText],
  )

  const handleMemoBlur = useCallback(() => {
    setMemo()
    if (memoChangeText && requestType === Invoice.PayCode) {
      setType(Invoice.Lightning)
      return
    }
    if (
      !memoChangeText &&
      requestType === Invoice.Lightning &&
      canUsePaycode &&
      !isNonZeroMoneyAmount(unitOfAccountAmount)
    ) {
      setType(Invoice.PayCode)
    }
  }, [setMemo, setType, memoChangeText, requestType, canUsePaycode, unitOfAccountAmount])

  const handleToggleWallet = useCallback(() => {
    if (!isReady) return

    const current = receivingWalletDescriptor.currency
    const next = current === WalletCurrency.Btc ? WalletCurrency.Usd : WalletCurrency.Btc

    const hasContent = isNonZeroMoneyAmount(unitOfAccountAmount) || memoChangeText
    const revertToPaycode = next === WalletCurrency.Btc && canUsePaycode && !hasContent

    switchReceivingWallet(revertToPaycode ? Invoice.PayCode : Invoice.Lightning, next)
  }, [
    isReady,
    receivingWalletDescriptor.currency,
    switchReceivingWallet,
    canUsePaycode,
    unitOfAccountAmount,
    memoChangeText,
  ])

  return {
    handleSetAmount,
    handleMemoBlur,
    handleToggleWallet,
    handleCopy,
    handleShare,
    receiveViaNFC,
  }
}
