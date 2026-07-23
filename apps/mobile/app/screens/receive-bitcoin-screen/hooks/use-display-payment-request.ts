import { useEffect, useRef } from "react"

import type { SelfCustodialPaymentRequestState } from "@app/self-custodial/hooks/types"
import { getLightningAddress } from "@app/utils/pay-links"

import { truncateMiddle } from "../payment/helpers"
import { Invoice } from "../payment/index.types"

type RequestState = SelfCustodialPaymentRequestState

type DisplayPaymentRequestReturn = {
  displayPaymentRequest: string
  showActions: boolean
}

export const useDisplayPaymentRequest = (
  request: RequestState,
): DisplayPaymentRequestReturn => {
  const { type: requestType, canUsePaycode, info, lnAddressHostname } = request

  const prevPaymentRequest = useRef("")

  const showActions = requestType !== Invoice.PayCode || canUsePaycode

  const readablePaymentRequest = (() => {
    if (info?.data?.invoiceType === Invoice.Lightning)
      return truncateMiddle(info.data.getFullUriFn({}))
    if (
      requestType === Invoice.PayCode &&
      info?.data?.invoiceType === Invoice.PayCode &&
      info.data.username
    )
      return getLightningAddress(lnAddressHostname, info.data.username)
  })()

  const displayPaymentRequest = readablePaymentRequest || prevPaymentRequest.current

  useEffect(() => {
    if (readablePaymentRequest) prevPaymentRequest.current = readablePaymentRequest
  }, [readablePaymentRequest])

  return { displayPaymentRequest, showActions }
}
