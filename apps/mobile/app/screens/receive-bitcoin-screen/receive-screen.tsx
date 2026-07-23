import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"

import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { AmountInputModal } from "@app/components/amount-input/amount-input-modal"
import { ContextualInfo } from "@app/components/contextual-info"
import { ModalNfc } from "@app/components/modal-nfc"
import { NoteInput } from "@app/components/note-input"
import { ReceiveAmountRow } from "@app/components/receive-amount-row"
import { Screen } from "@app/components/screen"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import { useNotificationPermission, usePriceConversion } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { usePaymentRequest as useSelfCustodialPaymentRequest } from "@app/self-custodial/hooks"
import type { SelfCustodialPaymentRequestState } from "@app/self-custodial/hooks/types"
import { ActiveWalletStatus } from "@app/types/wallet"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

import { NfcHeaderButton } from "./nfc-header-button"
import { QRView } from "./qr-view"
import { withMyLnUpdateSub } from "./my-ln-updates-sub"
import { Invoice, InvoiceType, PaymentRequestState } from "./payment/index.types"
import {
  useDisplayPaymentRequest,
  useNfcReceive,
  usePaymentRequest,
  useReceiveFlow,
} from "./hooks"

const AUTO_DISMISS_DELAY = 5000

const SELF_CUSTODIAL_BLOCKED_STATUSES: ActiveWalletStatus[] = [
  ActiveWalletStatus.Error,
  ActiveWalletStatus.Unavailable,
]

const LoadingView: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  return (
    <Screen>
      <View style={styles.loadingContainer} testID="receive-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Screen>
  )
}

const ReceiveScreen = () => {
  const { isSelfCustodial, status } = useActiveWallet()
  const { convertMoneyAmount } = usePriceConversion()
  const custodialRequest = usePaymentRequest()
  const selfCustodialRequest = useSelfCustodialPaymentRequest()

  if (isSelfCustodial && SELF_CUSTODIAL_BLOCKED_STATUSES.includes(status)) {
    return null
  }

  /** Loader while price conversion bootstraps after an account switch. */
  if (!convertMoneyAmount) {
    return <LoadingView />
  }

  const requestState = isSelfCustodial ? selfCustodialRequest : custodialRequest
  if (!requestState) return null

  return (
    <ReceiveScreenContent
      requestState={requestState}
      isSelfCustodial={isSelfCustodial}
      selfCustodialRequest={isSelfCustodial ? selfCustodialRequest : undefined}
    />
  )
}

type ReceiveScreenContentProps = {
  requestState: SelfCustodialPaymentRequestState
  isSelfCustodial: boolean
  selfCustodialRequest: SelfCustodialPaymentRequestState | null | undefined
}

const ReceiveScreenContent: React.FC<ReceiveScreenContentProps> = ({
  requestState,
  isSelfCustodial,
  selfCustodialRequest,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useNotificationPermission()

  const isDollarBalanceRestricted = useDollarBalanceRestricted()

  const [isTrialModalVisible, setIsTrialModalVisible] = useState(false)
  const openTrialModal = useCallback(() => setIsTrialModalVisible(true), [])
  const closeTrialModal = useCallback(() => setIsTrialModalVisible(false), [])
  const reopenUpgradeModal = useRef(false)
  const markReopenUpgradeModal = useCallback(() => {
    reopenUpgradeModal.current = true
  }, [])

  const [isLightningModalVisible, setIsLightningModalVisible] = useState(false)
  const toggleLightningModal = useCallback(
    () => setIsLightningModalVisible((prev) => !prev),
    [],
  )

  const {
    handleSetAmount,
    handleMemoBlur,
    handleToggleWallet,
    handleCopy,
    handleShare,
    receiveViaNFC,
  } = useReceiveFlow(requestState)

  const { displayPaymentRequest, showActions } = useDisplayPaymentRequest(requestState)

  const {
    displayReceiveNfc,
    setDisplayReceiveNfc,
    isNfcAmountModalOpen,
    closeNfcAmountModal,
    handleNfcAmountSet,
    showNfcButton,
    onNfcPress,
  } = useNfcReceive({
    requestType: requestState.type,
    requestState: requestState.state,
    hasSettlementAmount: Boolean(requestState.settlementAmount),
    handleSetAmount,
  })

  const titleByInvoiceType: Record<InvoiceType, string> = {
    [Invoice.OnChain]: LL.ReceiveScreen.bitcoinOnchain(),
    [Invoice.Lightning]: LL.ReceiveScreen.lightningInvoice(),
    [Invoice.PayCode]: LL.ReceiveScreen.lightningAddress(),
  }
  const dynamicTitle = titleByInvoiceType[requestState.type ?? Invoice.Lightning]

  useEffect(() => {
    navigation.setOptions({ title: dynamicTitle })
  }, [navigation, dynamicTitle])

  useFocusEffect(
    useCallback(() => {
      if (reopenUpgradeModal.current) {
        openTrialModal()
        reopenUpgradeModal.current = false
      }
    }, [openTrialModal]),
  )

  const isConverting = requestState.state === PaymentRequestState.Converting

  useEffect(() => {
    if (requestState.state !== PaymentRequestState.Paid) return
    const id = setTimeout(() => navigation.goBack(), AUTO_DISMISS_DELAY)
    return () => clearTimeout(id)
  }, [requestState.state, navigation])

  const canToggleWallet = isSelfCustodial
    ? !selfCustodialRequest?.isAssetToggleDisabled
    : !isDollarBalanceRestricted

  return (
    <Screen
      preset="scroll"
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
      style={styles.screenStyle}
      {...testProps("receive-screen")}
    >
      <View style={styles.content}>
        {/* Lightning pill badge */}
        <View style={styles.lightningPill}>
          <GaloyIcon name="lightning" size={14} color={colors.primary} />
          <Text style={styles.lightningPillText}>Lightning</Text>
        </View>

        {/* QR code */}
        <QRView
          type={requestState.info?.data?.invoiceType || requestState.type}
          getFullUri={requestState.info?.data?.getFullUriFn}
          loading={requestState.state === PaymentRequestState.Loading}
          completed={requestState.state === PaymentRequestState.Paid}
          converting={isConverting}
          err={
            requestState.state === PaymentRequestState.Error
              ? LL.ReceiveScreen.error()
              : ""
          }
          expired={requestState.state === PaymentRequestState.Expired}
          regenerateInvoiceFn={requestState.regenerateInvoice}
          copyToClipboard={handleCopy}
          isPayCode={requestState.type === Invoice.PayCode}
          canUsePayCode={requestState.canUsePaycode}
          toggleIsSetLightningAddressModalVisible={toggleLightningModal}
        />

        {/* Payment identifier pill */}
        <Pressable
          style={styles.paymentIdentifier}
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityHint={LL.ReceiveScreen.copyClipboard()}
        >
          <Text
            {...testProps("readable-payment-request")}
            style={styles.paymentIdentifierText}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {displayPaymentRequest}
          </Text>
          <GaloyIcon name="copy-paste" size={16} color={colors.grey3} />
        </Pressable>

        {/* Explanatory text */}
        <Text style={styles.hintText}>{LL.ReceiveScreen.tapQrCodeCopy()}</Text>

        {/* Copy / Share buttons */}
        {showActions && (
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.copyButton,
                pressed && styles.copyButtonPressed,
              ]}
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityHint={LL.ReceiveScreen.copyClipboard()}
            >
              <Text style={styles.copyButtonText}>
                {LL.ReceiveScreen.copyInvoice()}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.shareButtonPressed,
              ]}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityHint={LL.common.shareLightning()}
            >
              <Text style={styles.shareButtonText}>
                {LL.ReceiveScreen.shareInvoice()}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Inputs section */}
        <View style={styles.inputsContainer}>
          <ReceiveAmountRow
            unitOfAccountAmount={requestState.unitOfAccountAmount}
            walletCurrency={requestState.receivingWalletDescriptor.currency}
            convertMoneyAmount={requestState.convertMoneyAmount}
            setAmount={handleSetAmount}
            canSetAmount={requestState.canSetAmount}
            onToggleWallet={handleToggleWallet}
            canToggleWallet={canToggleWallet}
          />

          <NoteInput
            onBlur={handleMemoBlur}
            onChangeText={requestState.setMemoChangeText}
            value={requestState.memoChangeText || ""}
            editable={requestState.canSetMemo}
            big={false}
            iconSize={16}
            fontSize={14}
          />

          <ContextualInfo
            type={requestState.type}
            expirationTime={requestState.expirationTime ?? 0}
            setExpirationTime={requestState.setExpirationTime}
            walletCurrency={requestState.receivingWalletDescriptor.currency}
            canSetExpirationTime={requestState.canSetExpirationTime}
            feesInformation={requestState.feesInformation}
            shouldShowAutoConvertMinWarning={
              selfCustodialRequest?.shouldShowAutoConvertMinWarning
            }
            autoConvertMinSats={selfCustodialRequest?.autoConvertMinSats}
            autoConvertMinFiat={selfCustodialRequest?.autoConvertMinFiat}
          />
        </View>
      </View>

      <SetLightningAddressModal
        isVisible={isLightningModalVisible}
        toggleModal={toggleLightningModal}
      />

      <ModalNfc
        isActive={displayReceiveNfc}
        setIsActive={setDisplayReceiveNfc}
        settlementAmount={requestState.settlementAmount}
        receiveViaNFC={receiveViaNFC}
      />

      <AmountInputModal
        moneyAmount={requestState.unitOfAccountAmount}
        walletCurrency={requestState.receivingWalletDescriptor.currency}
        convertMoneyAmount={requestState.convertMoneyAmount}
        onSetAmount={handleNfcAmountSet}
        isOpen={isNfcAmountModalOpen}
        close={closeNfcAmountModal}
      />

      <NfcHeaderButton visible={showNfcButton} onPress={onNfcPress} />

      <TrialAccountLimitsModal
        isVisible={isTrialModalVisible}
        closeModal={closeTrialModal}
        beforeSubmit={markReopenUpgradeModal}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    flexGrow: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },

  // ── Lightning pill ──
  lightningPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.grey5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  lightningPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // ── Payment identifier pill ──
  paymentIdentifier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: colors.grey5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: "100%",
  },
  paymentIdentifierText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },

  // ── Hint text ──
  hintText: {
    color: colors.grey3,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 40,
  },

  // ── Actions row ──
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  copyButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  copyButtonPressed: {
    backgroundColor: colors.grey6,
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.black,
  },
  shareButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  shareButtonPressed: {
    opacity: 0.85,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: "700",
    // Fixed white, not a theme token: this text always sits on the solid
    // colors.primary button, so it must stay readable regardless of theme.
    color: "#FFFFFF",
  },

  // ── Inputs ──
  inputsContainer: {
    marginTop: 20,
    width: "100%",
    rowGap: 14,
  },
}))

export default withMyLnUpdateSub(ReceiveScreen)
