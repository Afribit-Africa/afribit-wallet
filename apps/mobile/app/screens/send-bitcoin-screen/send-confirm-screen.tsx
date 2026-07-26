import { requestInvoice, Satoshis, utils } from "lnurl-pay"
import React, { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import ReactNativeModal from "react-native-modal"
import { PanGestureHandler } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { gql } from "@apollo/client"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import { Screen } from "@app/components/screen"
import { WarningBanner } from "@app/components/warning-banner"
import { HIDDEN_AMOUNT_PLACEHOLDER } from "@app/config"
import {
  useSendBitcoinInternalLimitsQuery,
  useSendBitcoinWithdrawalLimitsQuery,
  Wallet,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"

import {
  decodeInvoiceString,
  Network as NetworkLibGaloy,
  PaymentType,
} from "@blinkbitcoin/blink-client"
import crashlytics from "@react-native-firebase/crashlytics"
import { NavigationProp, RouteProp, useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { useClipboard, usePriceConversion } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  DisplayCurrency,
  MoneyAmount,
  addMoneyAmounts,
  greaterThan,
  lessThanOrEqualTo,
  moneyAmountIsCurrencyType,
  multiplyMoneyAmounts,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  WalletOrDisplayCurrency,
  ZeroBtcMoneyAmount,
  ZeroUsdMoneyAmount,
} from "@app/types/amounts"

import { FeeTierSelector } from "./fee-tier-selector"
import { useOnchainFeeAlert } from "./hooks/use-onchain-fee-alert"
import { useOnchainFeeTierOptions } from "./hooks/use-onchain-fee-tier-options"
import { useSendWallets } from "./hooks/use-send-wallets"

import { testProps } from "../../utils/testProps"
import { ConfirmFeesModal } from "./confirm-fees-modal"
import { isValidAmount } from "./payment-details"
import { PaymentDetail } from "./payment-details/index.types"
import useFee from "./use-fee"
import { useSendPayment } from "./use-send-payment"
import { useSaveLnAddressContact } from "./use-save-lnaddress-contact"
import { ellipsizeMiddle } from "@app/utils/helper"
import { useSendDustWarning, useTranslateSdkError } from "@app/self-custodial/hooks"
import { logPaymentAttempt, logPaymentResult } from "@app/utils/analytics"
import { CommonActions } from "@react-navigation/native"
import { SendKeypad, SendKeypadKey } from "./send-keypad"

gql`
  query sendConfirmScreen {
    me {
      id
      defaultAccount {
        id
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }

  query sendConfirmWithdrawalLimits {
    me {
      id
      defaultAccount {
        id
        limits {
          withdrawal {
            totalLimit
            remainingLimit
            interval
          }
        }
      }
    }
  }

  query sendConfirmInternalLimits {
    me {
      id
      defaultAccount {
        id
        limits {
          internalSend {
            totalLimit
            remainingLimit
            interval
          }
        }
      }
    }
  }
`

type Props = {
  route: RouteProp<RootStackParamList, "sendConfirm">
}

const SUGGESTED_AMOUNTS = ["100", "500", "1000", "5000"]

const SendConfirmScreen: React.FC<Props> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { bottom } = useSafeAreaInsets()
  const styles = useStyles({ bottom })

  const navigation =
    useNavigation<NavigationProp<RootStackParamList, "sendConfirm">>()

  const { currentLevel } = useLevel()
  const { hideAmount } = useHideAmount()
  const { wallets, defaultWallet, btcWallet, usdWallet, network, isSelfCustodial } =
    useSendWallets()
  const {
    formatMoneyAmount,
    zeroDisplayAmount,
    formatDisplayAndWalletAmount,
    getSecondaryAmountIfCurrencyIsDifferent,
    fractionDigits: displayCurrencyFractionDigits,
  } = useDisplayCurrency()
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const [isLoadingLnurl, setIsLoadingLnurl] = useState(false)
  const [modalHighFeesVisible, setModalHighFeesVisible] = useState(false)

  const { convertMoneyAmount: _convertMoneyAmount } = usePriceConversion()
  const { paymentDestination } = route.params

  const [paymentDetail, setPaymentDetail] =
    useState<PaymentDetail<WalletCurrency> | null>(null)
  const { feeTier, setFeeTier, feeTierOptions, feeTierErrorMessage } =
    useOnchainFeeTierOptions({
      paymentDetail,
      isSelfCustodial,
      paymentDestination,
      convertMoneyAmount: _convertMoneyAmount,
    })

  const handleFeeTierChange = (tier: typeof feeTier) => {
    const rebuilt = setFeeTier(tier, paymentDetail)
    if (rebuilt) setPaymentDetail(rebuilt)
  }

  const { data: withdrawalLimitsData } = useSendBitcoinWithdrawalLimitsQuery({
    fetchPolicy: "no-cache",
    skip:
      !useIsAuthed() ||
      !paymentDetail?.paymentType ||
      paymentDetail.paymentType === "intraledger",
  })

  const { data: intraledgerLimitsData } = useSendBitcoinInternalLimitsQuery({
    fetchPolicy: "no-cache",
    skip:
      !useIsAuthed() ||
      !paymentDetail?.paymentType ||
      paymentDetail.paymentType !== "intraledger",
  })

  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false)
  const [asyncErrorMessage, setAsyncErrorMessage] = useState("")
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()

  const [paymentError, setPaymentError] = useState<string | undefined>(undefined)
  const translateSdkError = useTranslateSdkError()
  const saveLnAddressContact = useSaveLnAddressContact()

  type AmountUnit = "KES" | "sats"
  const [rawAmount, setRawAmount] = useState("")
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("KES")

  useEffect(() => {
    if (!_convertMoneyAmount) return
    setPaymentDetail((prev) => prev?.setConvertMoneyAmount(_convertMoneyAmount) ?? prev)
  }, [_convertMoneyAmount])

  useEffect(() => {
    if (paymentDetail || !defaultWallet || !_convertMoneyAmount) return

    let initialPaymentDetail = paymentDestination.createPaymentDetail({
      convertMoneyAmount: _convertMoneyAmount,
      sendingWalletDescriptor: {
        id: defaultWallet.id,
        currency: defaultWallet.walletCurrency,
      },
    })

    if (initialPaymentDetail.canSetAmount) {
      initialPaymentDetail = initialPaymentDetail.setAmount(zeroDisplayAmount)
    }

    setPaymentDetail(initialPaymentDetail)
  }, [setPaymentDetail, paymentDestination, _convertMoneyAmount, paymentDetail, defaultWallet, btcWallet, zeroDisplayAmount])

  const alertHighFees = useOnchainFeeAlert({
    paymentDetail,
    walletId: btcWallet?.id as string,
    network,
    isSelfCustodial,
  })

  const btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet?.balance)
  const usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet?.balance)

  // These hooks must run unconditionally on every render (Rules of Hooks) even
  // though paymentDetail starts null and resolves async via the effect above -
  // hence the optional chaining/fallbacks instead of gating on the guard below.
  const fee = useFee(paymentDetail?.getFee)
  const settledFee = fee.status === "set" ? fee : undefined

  const dustWarning = useSendDustWarning({
    amountAdjustment: settledFee?.amountAdjustment,
    fromCurrency: paymentDetail?.sendingWalletDescriptor.currency,
    fromWalletBalance: usdWallet?.balance,
    unitOfAccountAmount: paymentDetail?.unitOfAccountAmount ?? zeroDisplayAmount,
    settlementAmount: paymentDetail?.settlementAmount.amount ?? 0,
    feeSats: settledFee?.amount.amount,
    usdBalanceMoneyAmount,
  })

  const {
    loading: sendPaymentLoading,
    sendPayment,
    hasAttemptedSend,
  } = useSendPayment(paymentDetail?.sendPaymentMutation)

  if (!paymentDetail) return <></>

  const { sendingWalletDescriptor, convertMoneyAmount } = paymentDetail
  const lnurlParams =
    paymentDetail?.paymentType === "lnurl" ? paymentDetail?.lnurlParams : undefined

  const sendingWalletBalance =
    sendingWalletDescriptor.currency === WalletCurrency.Btc
      ? btcBalanceMoneyAmount
      : usdBalanceMoneyAmount

  const btcPrimaryText = formatMoneyAmount({ moneyAmount: btcBalanceMoneyAmount })
  const btcSecondaryText = formatMoneyAmount({
    moneyAmount: convertMoneyAmount(btcBalanceMoneyAmount, DisplayCurrency),
    isApproximate: true,
  })
  const usdPrimaryText = formatMoneyAmount({ moneyAmount: usdBalanceMoneyAmount })
  const usdSecondaryText = formatMoneyAmount({
    moneyAmount: convertMoneyAmount(usdBalanceMoneyAmount, WalletCurrency.Btc),
    isApproximate: true,
  })

  const amountStatus = isValidAmount({
    paymentDetail,
    usdWalletAmount: usdBalanceMoneyAmount,
    btcWalletAmount: btcBalanceMoneyAmount,
    intraledgerLimits: intraledgerLimitsData?.me?.defaultAccount?.limits?.internalSend,
    withdrawalLimits: withdrawalLimitsData?.me?.defaultAccount?.limits?.withdrawal,
  })

  const toggleWalletModal = () => setIsWalletModalVisible(!isWalletModalVisible)

  const chooseWallet = (wallet: Pick<Wallet, "id" | "walletCurrency">) => {
    let updatedPaymentDetail = paymentDetail.setSendingWalletDescriptor({
      id: wallet.id,
      currency: wallet.walletCurrency,
    })
    if (updatedPaymentDetail.canSetAmount) {
      const displayAmount = updatedPaymentDetail.convertMoneyAmount(
        paymentDetail.unitOfAccountAmount,
        DisplayCurrency,
      )
      updatedPaymentDetail = updatedPaymentDetail.setAmount(displayAmount)
    }
    setPaymentDetail(updatedPaymentDetail)
    toggleWalletModal()
  }

  const transactionType = () => {
    const pType = paymentDetail?.paymentType
    if (pType === "intraledger") return LL.common.intraledger()
    if (pType === "onchain") return LL.common.onchain()
    if (pType === "lightning") return LL.common.lightning()
    if (pType === "lnurl") return LL.common.lightning()
    if (pType === "spark") return LL.common.spark()
  }

  const zeroSettlementAmount = moneyAmountIsCurrencyType(
    paymentDetail.settlementAmount,
    WalletCurrency.Btc,
  )
    ? ZeroBtcMoneyAmount
    : ZeroUsdMoneyAmount

  const feeInSettlementCurrency = fee.amount
    ? paymentDetail.convertMoneyAmount(fee.amount, paymentDetail.settlementAmount.currency)
    : zeroSettlementAmount

  const totalAmount = addMoneyAmounts({
    a: paymentDetail.settlementAmount,
    b: feeInSettlementCurrency,
  })

  const feeUnavailable = fee.status === "loading" || (fee.status === "error" && !fee.amount)
  const dustNotEvaluable = dustWarning.status === "pending" || dustWarning.status === "blocked"

  const defaultAmount = formatMoneyAmount({ moneyAmount: ZeroUsdMoneyAmount })
  let currencyFeeAmount = defaultAmount
  let satFeeAmount = defaultAmount
  const feeErrorText = String(LL.SendBitcoinConfirmationScreen.feeError())
  let feeDisplayText = feeErrorText
  currencyFeeAmount = feeErrorText
  satFeeAmount = feeErrorText
  if (fee.amount) {
    const feeDisplayAmount = paymentDetail.convertMoneyAmount(fee.amount, DisplayCurrency)
    feeDisplayText = formatDisplayAndWalletAmount({
      displayAmount: feeDisplayAmount,
      walletAmount: fee.amount,
    })
    currencyFeeAmount = formatMoneyAmount({ moneyAmount: feeDisplayAmount })
    const secondaryFeeAmount = getSecondaryAmountIfCurrencyIsDifferent({
      primaryAmount: feeDisplayAmount,
      walletAmount: paymentDetail.convertMoneyAmount(fee.amount, WalletCurrency.Btc),
      displayAmount: paymentDetail.convertMoneyAmount(fee.amount, DisplayCurrency),
    })
    satFeeAmount = formatMoneyAmount({ moneyAmount: secondaryFeeAmount ?? ZeroUsdMoneyAmount })
  }

  const displayAmount = paymentDetail.convertMoneyAmount(
    paymentDetail.settlementAmount,
    DisplayCurrency,
  )
  const currencyAmount = formatMoneyAmount({ moneyAmount: displayAmount })
  const secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: displayAmount,
    walletAmount: paymentDetail.convertMoneyAmount(paymentDetail.settlementAmount, WalletCurrency.Btc),
    displayAmount: paymentDetail.convertMoneyAmount(paymentDetail.settlementAmount, DisplayCurrency),
  })
  const satAmount = formatMoneyAmount({ moneyAmount: secondaryAmount ?? ZeroUsdMoneyAmount })

  // Not useCallback: paymentDetail is guaranteed non-null only past the guard
  // above, so this can't be a hook (hooks must run unconditionally every
  // render) - it's only ever read once per render via onSwipe anyway.
  const handleSendPayment = async () => {
    if (!sendPayment || !sendingWalletDescriptor?.currency) return

    try {
      logPaymentAttempt({
        paymentType: paymentDetail.paymentType,
        sendingWallet: sendingWalletDescriptor.currency,
      })
      const { status, errorsMessage, extraInfo, transaction } = await sendPayment()
      logPaymentResult({
        paymentType: paymentDetail.paymentType,
        paymentStatus: status,
        sendingWallet: sendingWalletDescriptor.currency,
      })

      if (status === "SUCCESS" || status === "PENDING") {
        await saveLnAddressContact({
          paymentType: paymentDetail.paymentType,
          destination: paymentDetail.destination,
          isMerchant:
            paymentDetail.paymentType === "lnurl" ? paymentDetail.isMerchant : undefined,
        })
        navigation.dispatch((state) => {
          const routes = [
            { name: "Primary" },
            {
              name: "sendBitcoinCompleted",
              params: {
                arrivalAtMempoolEstimate: extraInfo?.arrivalAtMempoolEstimate,
                status,
                successAction: extraInfo?.successAction ?? paymentDetail?.successAction,
                preimage: extraInfo?.preimage,
                note: paymentDetail.memo,
                currencyAmount,
                satAmount,
                currencyFeeAmount,
                satFeeAmount,
                destination:
                  paymentDetail?.paymentType === "intraledger"
                    ? paymentDetail.destination
                    : ellipsizeMiddle(paymentDetail.destination, {
                        maxLength: 50,
                        maxResultLeft: 13,
                        maxResultRight: 8,
                      }),
                paymentType: paymentDetail?.paymentType,
                createdAt: transaction?.createdAt,
              },
            },
          ]
          return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
        })
        ReactNativeHapticFeedback.trigger("notificationSuccess", {
          ignoreAndroidSystemSettings: true,
        })
        return
      }

      if (status === "ALREADY_PAID") {
        setPaymentError(LL.SendBitcoinConfirmationScreen.invoiceAlreadyPaid())
        ReactNativeHapticFeedback.trigger("notificationError", {
          ignoreAndroidSystemSettings: true,
        })
        return
      }

      setPaymentError(
        translateSdkError(errorsMessage) ||
          LL.SendBitcoinConfirmationScreen.somethingWentWrong(),
      )
      ReactNativeHapticFeedback.trigger("notificationError", {
        ignoreAndroidSystemSettings: true,
      })
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        const indempotencyErrorPattern = /409: Conflict/i
        if (indempotencyErrorPattern.test(err.message)) {
          setPaymentError(LL.SendBitcoinConfirmationScreen.paymentAlreadyAttempted())
          return
        }
        setPaymentError(err.message || err.toString())
      }
    }
  }

  let validAmount = true
  let invalidAmountErrorMessage = ""
  const skipBalanceCheck = paymentDetail.isSendingMax || hasAttemptedSend

  if (
    moneyAmountIsCurrencyType(paymentDetail.settlementAmount, WalletCurrency.Btc) &&
    btcBalanceMoneyAmount &&
    !skipBalanceCheck
  ) {
    validAmount = lessThanOrEqualTo({
      value: totalAmount,
      lessThanOrEqualTo: btcBalanceMoneyAmount,
    })
    if (!validAmount) {
      invalidAmountErrorMessage = LL.SendBitcoinScreen.amountExceed({
        balance: hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText,
      })
    }
  }

  if (
    moneyAmountIsCurrencyType(paymentDetail.settlementAmount, WalletCurrency.Usd) &&
    usdBalanceMoneyAmount &&
    !skipBalanceCheck
  ) {
    validAmount = lessThanOrEqualTo({
      value: totalAmount,
      lessThanOrEqualTo: usdBalanceMoneyAmount,
    })
    if (!validAmount) {
      invalidAmountErrorMessage = LL.SendBitcoinScreen.amountExceed({
        balance: hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText,
      })
    }
  }

  const isLightningRecommended = () => {
    const ratioFeeToAmount = 50
    if (!fee.amount) return false
    const feeMultiplied = multiplyMoneyAmounts({ value: fee.amount, multiplier: ratioFeeToAmount })
    if (
      paymentDetail.paymentType === "onchain" &&
      greaterThan({ value: feeMultiplied, greaterThan: totalAmount })
    )
      return true
    return false
  }

  const goToNextScreen =
    (paymentDetail.sendPaymentMutation ||
      (paymentDetail.paymentType === "lnurl" && paymentDetail.unitOfAccountAmount)) &&
    (async () => {
      let paymentDetailForConfirmation: PaymentDetail<WalletCurrency> = paymentDetail

      if (paymentDetail.paymentType === "lnurl" && !paymentDetail.sendPaymentMutation) {
        try {
          setIsLoadingLnurl(true)
          const btcAmount = paymentDetail.convertMoneyAmount(
            paymentDetail.unitOfAccountAmount,
            "BTC",
          )
          const requestInvoiceParams: {
            lnUrlOrAddress: string
            tokens: Satoshis
            comment?: string
          } = {
            lnUrlOrAddress: paymentDetail.destination,
            tokens: utils.toSats(btcAmount.amount),
          }
          if (lnurlParams?.commentAllowed) {
            requestInvoiceParams.comment = paymentDetail.memo
          }
          const result = await requestInvoice(requestInvoiceParams)
          setPaymentDetail(paymentDetail.setSuccessAction(result.successAction))
          setIsLoadingLnurl(false)
          const invoice = result.invoice
          const decodedInvoice = decodeInvoiceString(invoice, network as NetworkLibGaloy)
          if (Math.round(Number(decodedInvoice.millisatoshis) / 1000) !== btcAmount.amount) {
            setAsyncErrorMessage(LL.SendBitcoinScreen.lnurlInvoiceIncorrectAmount())
            return
          }
          paymentDetailForConfirmation = {
            ...paymentDetail.setInvoice({ paymentRequest: invoice, paymentRequestAmount: btcAmount }),
            successAction: result.successAction,
          }
        } catch (error) {
          setIsLoadingLnurl(false)
          if (error instanceof Error) crashlytics().recordError(error)
          setAsyncErrorMessage(LL.SendBitcoinScreen.failedToFetchLnurlInvoice())
          return
        }
      }

      if (paymentDetailForConfirmation.sendPaymentMutation) {
        if (alertHighFees) {
          setModalHighFeesVisible(true)
        } else {
          setPaymentDetail(paymentDetailForConfirmation)
        }
      }
    })

  const setAmount = (moneyAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setPaymentDetail((prev) => (prev?.setAmount ? prev.setAmount(moneyAmount) : prev))
  }

  const sendAll = () => {
    let moneyAmount: MoneyAmount<WalletCurrency>
    if (paymentDetail.sendingWalletDescriptor.currency === WalletCurrency.Btc) {
      moneyAmount = { amount: btcWallet?.balance ?? 0, currency: WalletCurrency.Btc, currencyCode: "BTC" }
    } else {
      moneyAmount = { amount: usdWallet?.balance ?? 0, currency: WalletCurrency.Usd, currencyCode: "USD" }
    }
    setPaymentDetail((prev) => (prev?.setAmount ? prev.setAmount(moneyAmount, true) : prev))
  }

  const handleCopyToClipboard = () => {
    copyToClipboard({
      content: paymentDetail.destination,
      message: LL.SendBitcoinConfirmationScreen.copiedDestination(),
    })
  }

  const errorMessage = paymentError || invalidAmountErrorMessage || asyncErrorMessage || feeTierErrorMessage

  const isFixedAmount = !paymentDetail.canSetAmount
  const satsDisplay = paymentDetail.canSetAmount
    ? (rawAmount ? rawAmount : "0")
    : satAmount.replace(/[^0-9,]/g, "")
  const finalSatsDisplay = isFixedAmount
    ? formatMoneyAmount({ moneyAmount: paymentDetail.settlementAmount })
    : rawAmount || "0"

  const kesPrimary = amountUnit === "KES" && !isFixedAmount

  const handleKeypadPress = (key: SendKeypadKey) => {
    const next = key === "backspace" ? rawAmount.slice(0, -1) : rawAmount + key
    setRawAmount(next)
    if (next && setAmount) {
      const numeric = Number(next) || 0
      if (amountUnit === "KES") {
        // DisplayCurrency amounts are stored in minor units (e.g. cents) -
        // `numeric` here is the major-unit figure the user typed (e.g. "500"
        // meaning 500 KES), so it must be scaled by 10^fractionDigits before
        // being wrapped in a MoneyAmount, matching amountInMajorUnitOrSatsToMoneyAmount's
        // internal DisplayCurrency case in use-display-currency.ts.
        const minorUnits = Math.round(numeric * 10 ** displayCurrencyFractionDigits)
        setAmount({ amount: minorUnits, currency: DisplayCurrency, currencyCode: DisplayCurrency })
      } else {
        // Sats are already the base/minor unit for BTC - no scaling needed.
        setAmount({ amount: numeric, currency: WalletCurrency.Btc, currencyCode: "BTC" })
      }
    }
  }

  return (
    <Screen preset="scroll" style={styles.screenStyle} backgroundColor={colors.white}>
      <ConfirmFeesModal
        action={() => {
          setModalHighFeesVisible(false)
        }}
        isVisible={modalHighFeesVisible}
        cancel={() => setModalHighFeesVisible(false)}
      />
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <GaloyIcon name="arrow-left" size={22} color={colors.black} />
        </Pressable>

        <View style={styles.centeredSection}>
          <Text style={styles.payingLabel}>You're paying</Text>
          <Text style={styles.recipientText} numberOfLines={2}>
            {paymentDetail.destination}
          </Text>
          <Text style={styles.subDetailText}>{transactionType()}</Text>
          <View style={styles.railPill}>
            <GaloyIcon name="lightning" size={12} color={colors.primary} />
            <Text style={styles.railPillText}>Paying via {transactionType()}</Text>
          </View>

          {isFixedAmount ? (
            <>
              <View style={styles.amountRow}>
                <Text style={styles.amountValue}>
                  {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : finalSatsDisplay}
                </Text>
              </View>
              <Text style={styles.amountSecondary}>
                {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : `≈ ${currencyAmount}`}
              </Text>
            </>
) : (
              <>
                <View style={styles.amountRow}>
                  <Text style={styles.amountValue}>
                    {kesPrimary ? `KSh ${rawAmount || "0"}` : satAmount}
                  </Text>
                  {!kesPrimary && <Text style={styles.amountUnit}>sats</Text>}
                </View>
                <Text style={styles.amountSecondary}>
                  ≈ {kesPrimary ? satAmount : currencyAmount}
                </Text>
                <View style={styles.toggleRow}>
                  <Pressable
                    style={[styles.toggleSeg, kesPrimary && styles.toggleSegActive]}
                    onPress={() => setAmountUnit("KES")}
                  >
                    <Text style={[styles.toggleText, kesPrimary && styles.toggleTextActive]}>KES</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleSeg, !kesPrimary && styles.toggleSegActive]}
                    onPress={() => setAmountUnit("sats")}
                  >
                    <Text style={[styles.toggleText, !kesPrimary && styles.toggleTextActive]}>sats</Text>
                  </Pressable>
                </View>
              </>
          )}
        </View>

        {!isFixedAmount && (
          <>
            <View style={styles.quickAmounts}>
              {SUGGESTED_AMOUNTS.map((sa) => (
                <Pressable
                  key={sa}
                  style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
                  onPress={() => {
                    setRawAmount(sa)
                  }}
                >
                  <Text style={styles.quickChipText}>{sa}</Text>
                </Pressable>
              ))}
            </View>
            <SendKeypad onPress={handleKeypadPress} />
          </>
        )}

        <View style={styles.detailSection}>
          {isSelfCustodial && paymentDetail.paymentType === PaymentType.Onchain && (
            <View style={styles.fieldContainer}>
              <FeeTierSelector
                title={LL.SendBitcoinScreen.feeTier()}
                options={feeTierOptions}
                selected={feeTier}
                onSelect={handleFeeTierChange}
              />
            </View>
          )}

          <Pressable onPress={toggleWalletModal} style={styles.fieldRow}>
            <CurrencyPill
              currency={sendingWalletDescriptor.currency}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(sendingWalletDescriptor.currency)}
            />
            <Text style={styles.fieldRowValue}>
              {sendingWalletDescriptor.currency === WalletCurrency.Btc
                ? hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText
                : hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText}
            </Text>
            <GaloyIcon name="caret-down" size={16} color={colors.grey3} />
          </Pressable>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{LL.SendBitcoinConfirmationScreen.feeLabel()}</Text>
            {fee.status === "loading" && <ActivityIndicator size="small" color={colors.primary} />}
            {fee.status === "set" && (
              <Text style={styles.fieldRowValue}>
                {feeDisplayText}
              </Text>
            )}
            {fee.status === "error" && (
              <Text style={styles.fieldRowValue}>{feeDisplayText}</Text>
            )}
          </View>
        </View>

        {dustWarning.status === "visible" && (
          <WarningBanner>
            {LL.SendBitcoinConfirmationScreen.usdRemainderSweep({
              remaining: formatMoneyAmount({ moneyAmount: dustWarning.remaining }),
              remainingSats: formatMoneyAmount({ moneyAmount: dustWarning.remainingSats }),
              minimum: formatMoneyAmount({ moneyAmount: dustWarning.minimum }),
            })}
          </WarningBanner>
        )}

        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        <View style={styles.sliderArea}>
          <PanGestureHandler>
            <View>
              <GaloySliderButton
                isLoading={sendPaymentLoading || isLoadingLnurl}
                initialText={LL.SendBitcoinConfirmationScreen.slideToConfirm()}
                loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()}
                onSwipe={handleSendPayment}
                disabled={
                  !validAmount || hasAttemptedSend || feeUnavailable || dustNotEvaluable
                }
              />
            </View>
          </PanGestureHandler>
        </View>
      </View>

      <ReactNativeModal
        style={styles.walletModal}
        animationIn="fadeInDown"
        animationOut="fadeOutUp"
        isVisible={isWalletModalVisible}
        onBackButtonPress={toggleWalletModal}
        onBackdropPress={toggleWalletModal}
      >
        <View>
          {wallets
            ?.filter(
              // Onchain sends have no USD-conversion path in the self-custodial
              // payment-details layer yet (see onchain.ts) - the raw USD cent
              // amount would be sent to the SDK as if it were satoshis. Hide USD
              // here rather than let that silently happen.
              (wallet) =>
                wallet.walletCurrency !== WalletCurrency.Usd ||
                paymentDetail.paymentType !== PaymentType.Onchain,
            )
            .map((wallet) => (
            <Pressable
              key={wallet.id}
              {...testProps(wallet.walletCurrency)}
              style={styles.walletItem}
              onPress={() => chooseWallet(wallet)}
            >
              <CurrencyPill
                currency={wallet.walletCurrency}
                containerSize="medium"
                containerStyle={pillWidthStyle}
                onLayout={onPillLayout(wallet.walletCurrency)}
              />
              <View style={styles.walletInfo}>
                <Text style={styles.walletBalanceText}>
                  {wallet.walletCurrency === WalletCurrency.Btc
                    ? hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText
                    : hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText}
                </Text>
                <Text type="p2" color={colors.grey3}>
                  {wallet.walletCurrency === WalletCurrency.Btc
                    ? hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcSecondaryText
                    : hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdSecondaryText}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ReactNativeModal>
    </Screen>
  )
}

export default SendConfirmScreen

const useStyles = makeStyles(({ colors }, { bottom }: { bottom: number }) => ({
  screenStyle: {
    flexGrow: 1,
    paddingBottom: bottom + 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  centeredSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  payingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.grey3,
    marginBottom: 6,
  },
  recipientText: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.black,
    textAlign: "center",
    lineHeight: 34,
    marginBottom: 4,
  },
  subDetailText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.grey3,
    marginBottom: 14,
  },
  railPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.backdropWhite,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 34,
  },
  railPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 52,
    fontWeight: "800",
    color: colors.black,
  },
  amountUnit: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.grey3,
  },
  amountSecondary: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.grey3,
    marginBottom: 4,
  },
  editableHint: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 4,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    marginBottom: 8,
  },
  toggleSeg: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleSegActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.grey3,
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  quickAmounts: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  quickChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.backdropWhite,
    borderWidth: 1,
    borderColor: colors.backdropWhiter ?? colors.grey4,
  },
  quickChipPressed: {
    backgroundColor: colors.grey4,
  },
  quickChipText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.black,
  },
  detailSection: {
    marginTop: 20,
    gap: 8,
  },
  fieldContainer: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.grey3,
    flex: 0,
    marginRight: 8,
  },
  fieldRowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
    flex: 1,
    textAlign: "right",
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
    marginTop: 12,
    fontSize: 13,
  },
  sliderArea: {
    marginTop: 20,
    paddingHorizontal: 4,
  },
  walletModal: {
    marginBottom: "90%",
  },
  walletItem: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
    minHeight: 60,
  },
  walletInfo: {
    flex: 1,
    flexDirection: "column",
    marginLeft: 28,
  },
  walletBalanceText: {
    fontWeight: "bold",
    fontSize: 18,
    color: colors.black,
  },
}))