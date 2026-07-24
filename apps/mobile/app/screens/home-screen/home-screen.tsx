import * as React from "react"
import { useMemo } from "react"
import { RefreshControl, View, Alert, Pressable } from "react-native"
import { gql } from "@apollo/client"
import Modal from "react-native-modal"
import { useNavigation, useIsFocused, useFocusEffect } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { ScrollView, TouchableWithoutFeedback } from "react-native-gesture-handler"

import { AppUpdate } from "@app/components/app-update/app-update"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BulletinsCard } from "@app/components/notifications/bulletins"
import { SetDefaultAccountModal } from "@app/components/set-default-account-modal"
import { StableSatsModal } from "@app/components/stablesats-modal"
import { DollarBalanceRestrictionModal } from "@app/components/dollar-balance-restriction-modal"
import { UsdConvertToBtcModal } from "@app/components/usd-convert-to-btc-modal"
import { useTotalBalance } from "@app/components/balance-header"
import { BalanceMode, useBalanceMode } from "@app/hooks/use-balance-mode"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { StableTokenConvertToBtcModal } from "@app/screens/conversion-flow/stable-token-convert-to-btc-modal"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import SlideUpHandle from "@app/components/slide-up-handle"
import { Screen } from "@app/components/screen"
import AfribitMonogramWhite from "@app/assets/logo/afribit/afribit-monogram-white.svg"
import AfribitMonogramBlack from "@app/assets/logo/afribit/afribit-monogram-black.svg"
import BitikaIcon from "@app/assets/logo/bitika/bitika-icon.svg"
import {
  UnseenTxAmountBadge,
  useUnseenTxAmountBadge,
  useOutgoingBadgeVisibility,
  useIncomingBadgeAutoSeen,
} from "@app/components/unseen-tx-amount-badge"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { BackupNudgeBanner } from "@app/components/backup-nudge-banner"
import { SelfCustodialInfoBulletin } from "@app/components/self-custodial-info-bulletin"
import { BackupNudgeModal } from "@app/components/backup-nudge-modal"
import { NetworkStatusBanner } from "@app/components/network-status-banner"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useDefaultAccountModalShown } from "@app/hooks/use-default-account-modal-shown"
import {
  useDollarBalanceRestricted,
  useDollarBalanceRestrictionSync,
} from "@app/hooks/use-dollar-balance-restricted"
import { useDollarBalanceForcedConversion } from "@app/hooks/use-dollar-balance-forced-conversion"
import { MigrateNowModal } from "@app/components/migrate-now-modal"
import { MigrationReminderBulletin } from "@app/components/migration-reminder-bulletin"
/** Deep import on purpose: keeps the migration hooks barrel out of the home graph. */
import { useWindDownHomeNudges } from "@app/screens/account-migration/hooks/use-wind-down-home-nudges"
import {
  useTransferBlocked,
  useTransferBlockedSync,
} from "@app/hooks/use-transfer-blocked"
import { useSelfCustodialNetworkMismatchToast } from "@app/self-custodial/hooks/use-network-mismatch-toast"
import { useNonCustodialConversionLimits } from "@app/self-custodial/hooks"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { ConvertDirection } from "@app/types/payment"
import { useBackupNudgeState } from "@app/hooks/use-backup-nudge-state"
import { useSelfCustodialInfoBulletinState } from "@app/hooks/use-self-custodial-info-bulletin-state"
import { getErrorMessages } from "@app/graphql/utils"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UnclaimedDepositBanner } from "@app/components/unclaimed-deposit-banner"
import { testProps } from "@app/utils/testProps"
import { extractLightningAddressUsername } from "@app/utils/pay-links"
import {
  useAppConfig,
  useAutoShowUpgradeModal,
  useTransactionSeenState,
} from "@app/hooks"
import {
  AccountLevel,
  TransactionFragment,
  TxDirection,
  TxStatus,
  useBulletinsQuery,
  useHomeAuthedQuery,
  useHomeUnauthedQuery,
  useRealtimePriceQuery,
  useSettingsScreenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet"
import { useLevel } from "@app/graphql/level-context"

const TransactionCountToTriggerSetDefaultAccountModal = 1
const UPGRADE_MODAL_INITIAL_DELAY_MS = 1500
/** Floor for conversions without a pool minimum (custodial intraledger always,
 *  self-custodial when the SDK reports none): any positive cent converts. */
const ANY_POSITIVE_CENT_MINIMUM = 1

gql`
  query homeAuthed {
    me {
      id
      language
      username
      phone
      email {
        address
        verified
      }

      defaultAccount {
        id
        level
        defaultWalletId
        pendingIncomingTransactions {
          ...Transaction
        }
        transactions(first: 20) {
          ...TransactionList
        }
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }

  query homeUnauthed {
    globals {
      network
    }

    currencyList {
      id
      flag
      name
      symbol
      fractionDigits
    }
  }

  query Bulletins($first: Int!, $after: String) {
    me {
      id
      unacknowledgedStatefulNotificationsWithBulletinEnabled(
        first: $first
        after: $after
      ) {
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            id
            title
            body
            createdAt
            acknowledgedAt
            bulletinEnabled
            icon
            action {
              ... on OpenDeepLinkAction {
                deepLink
                label
              }
              ... on OpenExternalLinkAction {
                url
                label
              }
            }
          }
          cursor
        }
      }
    }
  }
`

const timeAgo = (pastTimestamp: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - pastTimestamp
  if (diff < 60) return "now"
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const getTxMethodLabel = (tx: TransactionFragment): string => {
  const via = tx.initiationVia
  switch (via.__typename) {
    case "InitiationViaLn":
      return "Lightning"
    case "InitiationViaOnChain":
      return "On-chain"
    case "InitiationViaIntraLedger":
      return "Afribit Pay"
    default:
      return "Bitcoin"
  }
}

export const HomeScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors, mode },
  } = useTheme()
  const AfribitMonogram = mode === "dark" ? AfribitMonogramWhite : AfribitMonogramBlack
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { balanceLimitToTriggerUpgradeModal, upgradeModalCooldownDays } =
    useRemoteConfig()

  const { defaultAccountModalShown } = useDefaultAccountModalShown()
  const [setDefaultAccountModalVisible, setSetDefaultAccountModalVisible] =
    React.useState(false)
  const reopenUpgradeModal = React.useRef(false)
  const toggleSetDefaultAccountModal = () =>
    setSetDefaultAccountModalVisible(!setDefaultAccountModalVisible)

  const { isAtLeastLevelOne: _isAtLeastLevelOne } = useLevel()

  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial } = activeWallet
  useSelfCustodialNetworkMismatchToast()
  const {
    refreshWallets: refreshSelfCustodialWallets,
    isStableBalanceActive,
    lightningAddress: selfCustodialLightningAddress,
  } = useSelfCustodialWallet()
  const { accounts, activeAccount } = useAccountRegistry()
  const hasMultipleAccounts = accounts.length > 1
  const { stableBalanceEnabled } = useFeatureFlags()
  const { mode: balanceMode, toggleMode: toggleBalanceMode } = useBalanceMode()
  const { shouldShowBanner, shouldShowModal, dismissBanner } = useBackupNudgeState()
  const {
    shouldShow: shouldShowSelfCustodialInfoBulletin,
    dismiss: dismissSelfCustodialInfoBulletin,
  } = useSelfCustodialInfoBulletinState()
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { id: galoyInstanceId },
    },
  } = useAppConfig()

  const isFocused = useIsFocused()

  const {
    data: dataAuthed,
    loading: loadingAuthed,
    error,
    refetch: refetchAuthed,
  } = useHomeAuthedQuery({
    skip: !isAuthed || isSelfCustodial,
    fetchPolicy: "network-only",
    errorPolicy: "all",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  const { loading: loadingPrice, refetch: refetchRealtimePrice } = useRealtimePriceQuery({
    skip: !isAuthed || isSelfCustodial,
    fetchPolicy: "network-only",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  const {
    refetch: refetchUnauthed,
    loading: loadingUnauthed,
    data: dataUnauthed,
  } = useHomeUnauthedQuery({
    skip: !isAuthed,
    fetchPolicy: "network-only",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  // keep settings info cached and ignore network call if it's already cached
  const { data: currentUser, loading: loadingSettings } = useSettingsScreenQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  // load bulletins on home screen
  const {
    data: bulletins,
    loading: bulletinsLoading,
    refetch: refetchBulletins,
  } = useBulletinsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
    variables: { first: 1 },
  })

  // not loaded yet: no wallets while not ready (a loaded account keeps its balance
  // when a refresh goes offline, and a ready empty account shows zero, not a skeleton)
  const queryLoading = isSelfCustodial
    ? !activeWallet.isReady && activeWallet.wallets.length === 0
    : loadingAuthed || loadingPrice || loadingUnauthed || loadingSettings

  const { username, phone } = currentUser?.me ?? {}
  const selfCustodialFallbackTitle = hasMultipleAccounts ? LL.common.anonymousUser() : ""

  const selfCustodialUsername = extractLightningAddressUsername(
    selfCustodialLightningAddress,
  )
  const usernameTitle = isSelfCustodial
    ? selfCustodialUsername ?? selfCustodialFallbackTitle
    : username || phone || LL.common.blinkUser()

  const wallets = isSelfCustodial
    ? activeWallet.wallets.map((w) => ({
        id: w.id,
        balance: w.balance.amount,
        walletCurrency: w.walletCurrency,
      }))
    : dataAuthed?.me?.defaultAccount?.wallets
  const {
    formattedBalance: defaultFormattedBalance,
    satsBalance,
    isLoading: balanceConversionLoading,
  } = useTotalBalance(wallets)

  const loading = queryLoading || balanceConversionLoading

  const showStableBalanceToggle =
    stableBalanceEnabled && isSelfCustodial && isStableBalanceActive

  const { formatMoneyAmount, displayCurrency, moneyAmountToDisplayCurrencyString } =
    useDisplayCurrency()

  const formattedBalance =
    showStableBalanceToggle && balanceMode === BalanceMode.Btc
      ? formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(satsBalance) })
      : defaultFormattedBalance

  const fiatEquivalent = moneyAmountToDisplayCurrencyString({
    moneyAmount: toBtcMoneyAmount(satsBalance),
    isApproximate: false,
  })

  const accountId = dataAuthed?.me?.defaultAccount?.id
  const levelAccount = dataAuthed?.me?.defaultAccount.level
  const pendingIncomingTransactions =
    dataAuthed?.me?.defaultAccount?.pendingIncomingTransactions
  const transactionsEdges = dataAuthed?.me?.defaultAccount?.transactions?.edges

  const transactions = useMemo(() => {
    const txs: TransactionFragment[] = []
    if (pendingIncomingTransactions) txs.push(...pendingIncomingTransactions)
    const settled =
      transactionsEdges
        ?.map((e) => e.node)
        .filter(
          (tx) => tx.status !== TxStatus.Pending || tx.direction === TxDirection.Send,
        ) ?? []
    txs.push(...settled)
    return txs
  }, [pendingIncomingTransactions, transactionsEdges])

  const { hasUnseenBtcTx, hasUnseenUsdTx, markTxSeen } = useTransactionSeenState(
    accountId || "",
    transactions,
  )

  const { canShowUpgradeModal, markShownUpgradeModal } = useAutoShowUpgradeModal({
    cooldownDays: upgradeModalCooldownDays,
    enabled: isAuthed && levelAccount === AccountLevel.Zero,
  })

  const { latestUnseenTx, unseenAmountText, handleUnseenBadgePress, isOutgoing } =
    useUnseenTxAmountBadge({
      transactions,
      hasUnseenBtcTx,
      hasUnseenUsdTx,
    })

  const handleOutgoingBadgeHide = React.useCallback(() => {
    if (latestUnseenTx?.settlementCurrency) {
      markTxSeen(latestUnseenTx.settlementCurrency)
    }
  }, [latestUnseenTx?.settlementCurrency, markTxSeen])

  const showOutgoingBadge = useOutgoingBadgeVisibility({
    txId: latestUnseenTx?.id,
    amountText: unseenAmountText,
    isOutgoing,
    onHide: handleOutgoingBadgeHide,
  })

  const showIncomingBadge = useIncomingBadgeAutoSeen({
    isFocused,
    isOutgoing,
    unseenCurrency: latestUnseenTx?.settlementCurrency,
    markTxSeen,
  })

  const [modalVisible, setModalVisible] = React.useState(false)
  const [isStablesatModalVisible, setIsStablesatModalVisible] = React.useState(false)
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = React.useState(false)
  const [isRestrictionModalVisible, setIsRestrictionModalVisible] = React.useState(false)
  const isDollarBalanceRestricted = useDollarBalanceRestricted()
  useDollarBalanceRestrictionSync()

  const isTransferBlocked = useTransferBlocked()
  useTransferBlockedSync()

  const restrictedUsdWallet = getUsdWallet(dataAuthed?.me?.defaultAccount?.wallets)
  const restrictedBtcWallet = getBtcWallet(dataAuthed?.me?.defaultAccount?.wallets)
  /** Balance and restriction policy must resolve for the SAME account type: right
   *  after switching to self-custodial the SDK is still connecting (so
   *  `isSelfCustodial` is false) while the restriction already applies the
   *  self-custodial policy; reading the cached custodial balance in that window
   *  would trigger the previous account's modal. */
  const isCustodialAccount = activeWallet.accountType === AccountType.Custodial
  const selfCustodialUsdWallet = activeWallet.wallets.find(
    (w) => w.walletCurrency === WalletCurrency.Usd,
  )
  const custodialUsdWalletBalance = restrictedUsdWallet?.balance ?? 0
  const selfCustodialUsdWalletBalance = selfCustodialUsdWallet?.balance.amount ?? 0
  const restrictedUsdWalletBalance = isCustodialAccount
    ? custodialUsdWalletBalance
    : selfCustodialUsdWalletBalance
  /** Memoized so the self-custodial quote does not refire on unrelated re-renders. */
  const restrictedUsdMoneyAmount = useMemo(
    () => toUsdMoneyAmount(restrictedUsdWalletBalance),
    [restrictedUsdWalletBalance],
  )

  /** The limits fetch only runs when a forced conversion is actually on the
   *  table (the hook skips entirely on an undefined direction), and gating on
   *  focus re-runs it on each home visit, so one failed fetch cannot mute the
   *  trigger for the whole session. Below the Breez pool minimum the trigger
   *  stays closed: the bridge rejects below-minimum conversions, so the modal
   *  would nag with a retry that can never succeed. */
  const shouldCheckConversionMinimum =
    !isCustodialAccount &&
    isDollarBalanceRestricted &&
    restrictedUsdWalletBalance > 0 &&
    isFocused
  const { limits: stableTokenConversionLimits } = useNonCustodialConversionLimits(
    shouldCheckConversionMinimum ? ConvertDirection.UsdToBtc : undefined,
  )
  /** A fetched limits response without a minimum means "none": mirror the bridge
   *  (`checkConversionMinimum`), which lets any positive amount through. */
  const stableTokenConversionMinimum = stableTokenConversionLimits
    ? stableTokenConversionLimits.minFromAmount ?? ANY_POSITIVE_CENT_MINIMUM
    : null
  const minimumConvertibleBalance = isCustodialAccount
    ? ANY_POSITIVE_CENT_MINIMUM
    : stableTokenConversionMinimum

  const { isConvertModalVisible, closeConvertModal } = useDollarBalanceForcedConversion({
    accountId: activeAccount?.id,
    isRestricted: isDollarBalanceRestricted,
    usdWalletBalance: restrictedUsdWalletBalance,
    minimumBalance: minimumConvertibleBalance,
    isFocused,
  })

  /** Each account type renders its own convert modal; the guards keep them exclusive
   *  locally instead of relying on the skipped custodial query staying empty. */
  const custodialConvertWallets =
    isCustodialAccount && restrictedUsdWallet && restrictedBtcWallet
      ? { usdWalletId: restrictedUsdWallet.id, btcWalletId: restrictedBtcWallet.id }
      : null
  const shouldShowStableTokenConvertModal = isSelfCustodial && isConvertModalVisible

  const { migrateNowPrompt, reminderBulletin, receiveBlocked } = useWindDownHomeNudges()
  const { dismissForSession: dismissMigrateNowPrompt } = migrateNowPrompt
  /** Dismissing first keeps the modal from floating over the pushed migration flow. */
  const goToMigration = React.useCallback(() => {
    dismissMigrateNowPrompt()
    navigation.navigate("accountMigrationEntry")
  }, [dismissMigrateNowPrompt, navigation])
  /** The migrate-now push is the lowest-priority nudge: two native modals cannot
   *  present at once on iOS, so it waits while any other home modal is up. */
  const isAnotherHomeModalVisible =
    isConvertModalVisible ||
    isUpgradeModalVisible ||
    isRestrictionModalVisible ||
    isStablesatModalVisible ||
    modalVisible
  const shouldShowMigrateNowPrompt =
    migrateNowPrompt.isVisible && !isAnotherHomeModalVisible

  const closeUpgradeModal = () => setIsUpgradeModalVisible(false)
  const closeRestrictionModal = () => setIsRestrictionModalVisible(false)
  const openUpgradeModal = React.useCallback(() => {
    setIsUpgradeModalVisible(true)
  }, [])

  const triggerUpgradeModal = React.useCallback(() => {
    if (!accountId || levelAccount !== AccountLevel.Zero) return
    if (!canShowUpgradeModal || satsBalance <= balanceLimitToTriggerUpgradeModal) return

    openUpgradeModal()
    markShownUpgradeModal()
  }, [
    accountId,
    levelAccount,
    canShowUpgradeModal,
    satsBalance,
    balanceLimitToTriggerUpgradeModal,
    markShownUpgradeModal,
    openUpgradeModal,
  ])

  const refetch = React.useCallback(() => {
    if (isSelfCustodial) {
      refreshSelfCustodialWallets()
      return
    }

    if (!isAuthed) return

    Promise.all([
      refetchRealtimePrice(),
      refetchAuthed(),
      refetchUnauthed(),
      refetchBulletins(),
    ]).then(() => {
      // Triggers the upgrade trial account modal after refetch
      triggerUpgradeModal()
    })
  }, [
    isAuthed,
    isSelfCustodial,
    refreshSelfCustodialWallets,
    refetchAuthed,
    refetchBulletins,
    refetchRealtimePrice,
    refetchUnauthed,
    triggerUpgradeModal,
  ])

  const numberOfTxs = transactions.length

  const onMenuClick = (target: Target) => {
    if (!isSelfCustodial && !isAuthed) {
      setModalVisible(true)
      return
    }

    if (
      !isSelfCustodial &&
      !isDollarBalanceRestricted &&
      target === "receiveBitcoin" &&
      !defaultAccountModalShown &&
      numberOfTxs >= TransactionCountToTriggerSetDefaultAccountModal &&
      galoyInstanceId === "Main"
    ) {
      toggleSetDefaultAccountModal()
      return
    }

    navigation.navigate(target)
  }

  const activateWallet = () => {
    setModalVisible(false)
    navigation.navigate("acceptTermsAndConditions", { flow: "phone" })
  }

  // debug code. verify that we have 2 wallets. mobile doesn't work well with only one wallet
  // TODO: add this code in a better place
  React.useEffect(() => {
    if (isSelfCustodial) return
    if (wallets?.length !== undefined && wallets?.length !== 2) {
      Alert.alert(LL.HomeScreen.walletCountNotTwo())
    }
  }, [wallets, LL, isSelfCustodial])

  // Trigger the upgrade trial account modal
  useFocusEffect(
    React.useCallback(() => {
      if (reopenUpgradeModal.current) {
        openUpgradeModal()
        reopenUpgradeModal.current = false
        return
      }

      const id = setTimeout(() => {
        triggerUpgradeModal()
      }, UPGRADE_MODAL_INITIAL_DELAY_MS)

      return () => clearTimeout(id)
    }, [openUpgradeModal, triggerUpgradeModal]),
  )

  type Target =
    | "scanningQRCode"
    | "sendManual"
    | "receiveBitcoin"
    | "conversionDetails"

  const AccountCreationNeededModal = (
    <Modal
      style={styles.modal}
      isVisible={modalVisible}
      swipeDirection={modalVisible ? ["down"] : ["up"]}
      onSwipeComplete={() => setModalVisible(false)}
      animationOutTiming={1}
      swipeThreshold={50}
    >
      <View style={styles.modalFlex}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalCover} />
        </TouchableWithoutFeedback>
      </View>
      <View style={styles.viewModal}>
        <GaloyIcon name="minus" size={64} color={colors.grey3} style={styles.modalIcon} />
        <Text type="h1">{LL.common.needWallet()}</Text>
        <View style={styles.openWalletContainer}>
          <GaloyPrimaryButton
            title={LL.GetStartedScreen.logInCreateAccount()}
            onPress={activateWallet}
          />
        </View>
        <View style={styles.modalFlex} />
      </View>
    </Modal>
  )

  const handleSwitchPress = () => {
    navigation.navigate("settings")
  }

  const avatarInitial =
    usernameTitle && usernameTitle !== LL.common.blinkUser()
      ? usernameTitle[0]?.toUpperCase()
      : null

  const showBalanceInBtcMode = showStableBalanceToggle && balanceMode === BalanceMode.Btc

  const limitedTransactions = useMemo(() => transactions.slice(0, 5), [transactions])

  return (
    <Screen
      headerShown={false}
      backgroundColor={colors.white}
      statusBar={mode === "dark" ? "light-content" : "dark-content"}
    >
      {AccountCreationNeededModal}
      <StableSatsModal
        isVisible={isStablesatModalVisible}
        setIsVisible={setIsStablesatModalVisible}
        variant={isSelfCustodial ? "selfCustodial" : "custodial"}
      />
      <TrialAccountLimitsModal
        isVisible={isUpgradeModalVisible}
        closeModal={closeUpgradeModal}
        beforeSubmit={() => {
          reopenUpgradeModal.current = true
        }}
      />
      <DollarBalanceRestrictionModal
        isVisible={isRestrictionModalVisible}
        toggleModal={closeRestrictionModal}
      />
      {custodialConvertWallets && (
        <UsdConvertToBtcModal
          isVisible={isConvertModalVisible}
          toggleModal={closeConvertModal}
          usdWalletBalance={restrictedUsdMoneyAmount}
          usdWalletId={custodialConvertWallets.usdWalletId}
          btcWalletId={custodialConvertWallets.btcWalletId}
        />
      )}
      {shouldShowStableTokenConvertModal && (
        <StableTokenConvertToBtcModal
          isVisible={isConvertModalVisible}
          toggleModal={closeConvertModal}
          usdWalletBalance={restrictedUsdMoneyAmount}
          conversionMinimum={stableTokenConversionMinimum}
        />
      )}
      {/* Kept mounted (not conditionally rendered) so its exit animation plays on dismiss. */}
      <MigrateNowModal
        isVisible={shouldShowMigrateNowPrompt}
        toggleModal={migrateNowPrompt.dismissForSession}
        onMigrate={goToMigration}
        deadlineTimestamp={migrateNowPrompt.deadlineTimestamp}
        timezone={migrateNowPrompt.timezone}
      />
      <ScrollView
        {...testProps("home-screen")}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && isFocused}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ─── HEADER ROW ─── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.apBadge}>
              <AfribitMonogram width={26} height={12} />
              <View style={[styles.apBadgeDot, { backgroundColor: colors.primary }]} />
            </View>
            <Text style={styles.wordmark}>Afribit Pay</Text>
          </View>
          <View style={styles.headerRight}>
            <GaloyIconButton
              onPress={() => navigation.navigate("priceHistory")}
              size={"medium"}
              name="graph"
              iconOnly={true}
              weight="bold"
              color={colors.black}
            />
            <Pressable onPress={handleSwitchPress}>
              <View style={styles.avatarCircle}>
                {avatarInitial ? (
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                ) : (
                  <GaloyIcon name="user" size={18} color={colors.grey3} />
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── BALANCE SECTION ─── */}
        <Pressable onPress={showStableBalanceToggle ? toggleBalanceMode : undefined}>
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>
                {showBalanceInBtcMode
                  ? satsBalance.toLocaleString()
                  : defaultFormattedBalance}
              </Text>
              {showBalanceInBtcMode && <Text style={styles.balanceUnit}> sats</Text>}
            </View>
            {fiatEquivalent && (
              <Text style={styles.fiatEquivalent}>≈ {fiatEquivalent}</Text>
            )}
          </View>
        </Pressable>

        {/* ─── ACTION BUTTONS ─── */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => onMenuClick("sendManual")}
          >
            <View style={styles.smallActionCircle}>
              <GaloyIcon name="send" size={22} color={colors.black} />
            </View>
            <Text style={styles.actionLabel}>Send</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => onMenuClick("scanningQRCode")}
          >
            <View style={[styles.largeActionCircle, { backgroundColor: colors.primary }]}>
              {/* Fixed off-white, not a theme token: this icon always sits on the
                  solid primary-orange circle, independent of light/dark mode. */}
              <GaloyIcon name="scan" size={32} color="#F7F5F2" />
            </View>
            <Text style={styles.actionLabelPrimary}>Scan</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => onMenuClick("receiveBitcoin")}
          >
            <View style={styles.smallActionCircle}>
              <GaloyIcon name="receive" size={22} color={colors.black} />
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </Pressable>
        </View>

        {/* ─── BUY BITCOIN WITH M-PESA ─── */}
        <Pressable
          style={styles.buyButton}
          onPress={() => navigation.navigate("buyBitcoin")}
        >
          <BitikaIcon width={16} height={16} />
          <Text style={styles.buyButtonText}>Buy bitcoin with M-Pesa</Text>
        </Pressable>

        {/* ─── ACTIVITY SECTION ─── */}
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>Activity</Text>
          <Pressable onPress={() => navigation.navigate("transactionHistory")}>
            <Text style={styles.seeAllText}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.badgeSlot}>
          <UnseenTxAmountBadge
            key={latestUnseenTx?.id}
            amountText={unseenAmountText ?? ""}
            visible={
              isOutgoing
                ? showOutgoingBadge
                : showIncomingBadge && Boolean(unseenAmountText)
            }
            onPress={handleUnseenBadgePress}
            isOutgoing={isOutgoing}
          />
        </View>

        {/* Transaction list */}
        {limitedTransactions.map((tx) => (
          <Pressable
            key={tx.id}
            style={styles.transactionRow}
            onPress={() => navigation.navigate("transactionDetail", { txid: tx.id })}
          >
            <View style={styles.txIconSlot}>
              <GaloyIcon
                name={tx.direction === TxDirection.Receive ? "receive" : "send"}
                size={20}
                color={tx.direction === TxDirection.Receive ? colors.primary : colors.black}
              />
            </View>
            <View style={styles.txDetails}>
              <Text style={styles.txName} numberOfLines={1}>
                {tx.memo || getTxMethodLabel(tx)}
              </Text>
              <Text style={styles.txMeta} numberOfLines={1}>
                {getTxMethodLabel(tx)}{" "}
                <Text style={styles.txMeta}>· {timeAgo(tx.createdAt)}</Text>
              </Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                tx.direction === TxDirection.Receive && styles.txAmountIncoming,
              ]}
            >
              {tx.direction === TxDirection.Receive ? "+" : "−"}
              {tx.settlementCurrency === WalletCurrency.Btc
                ? tx.settlementAmount.toLocaleString()
                : `$${(tx.settlementAmount / 100).toFixed(2)}`}
            </Text>
          </Pressable>
        ))}

        {/* ─── PRESERVED: Error, banners, bulletins ─── */}
        {error && <GaloyErrorBox errorMessage={getErrorMessages(error)} />}
        {isSelfCustodial && <UnclaimedDepositBanner />}
        <NetworkStatusBanner />
        {shouldShowBanner && <BackupNudgeBanner onDismiss={dismissBanner} />}
        {reminderBulletin.isVisible && (
          <MigrationReminderBulletin
            onMigrate={goToMigration}
            deadlineTimestamp={reminderBulletin.deadlineTimestamp}
            timezone={reminderBulletin.timezone}
          />
        )}
        {shouldShowSelfCustodialInfoBulletin && (
          <SelfCustodialInfoBulletin onDismiss={dismissSelfCustodialInfoBulletin} />
        )}
        <BulletinsCard loading={bulletinsLoading} bulletins={bulletins} />
        <AppUpdate />
        <SetDefaultAccountModal
          isVisible={setDefaultAccountModalVisible}
          toggleModal={() => {
            toggleSetDefaultAccountModal()
            navigation.navigate("receiveBitcoin")
          }}
        />
      </ScrollView>
      <SlideUpHandle
        bottomOffset={15}
        onAction={() => navigation.navigate("transactionHistory")}
      />
      <BackupNudgeModal
        isVisible={shouldShowModal && isFocused}
        onClose={dismissBanner}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 26,
    rowGap: 8,
  },

  // ── MODAL (preserved structure, dark background) ──
  modal: {
    marginBottom: 0,
    marginHorizontal: 0,
  },
  modalFlex: {
    flex: 1,
  },
  modalCover: {
    height: "100%",
    width: "100%",
  },
  modalIcon: {
    height: 34,
    top: -22,
  },
  viewModal: {
    alignItems: "center",
    backgroundColor: colors.grey5,
    height: "30%",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  openWalletContainer: {
    alignSelf: "stretch",
    marginTop: 20,
  },

  // ── HEADER ──
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  apBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  apBadgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 4,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.black,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.grey3,
  },

  // ── BALANCE ──
  balanceSection: {
    marginTop: 30,
    alignItems: "flex-start",
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.grey3,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 46,
    fontWeight: "800",
    color: colors.black,
  },
  balanceUnit: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.grey3,
  },
  fiatEquivalent: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 2,
  },

  // ── ACTION BUTTONS ──
  actionsRow: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
  },
  actionButton: {
    alignItems: "center",
    gap: 8,
  },
  smallActionCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.backdropWhite,
    borderWidth: 1,
    borderColor: colors.backdropWhiter,
    justifyContent: "center",
    alignItems: "center",
  },
  largeActionCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.black,
  },
  actionLabelPrimary: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.black,
  },

  // ── BUY BUTTON ──
  buyButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.backdropWhite,
    borderWidth: 1,
    borderColor: colors.backdropWhiter,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  buyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.black,
  },

  // ── ACTIVITY ──
  activityHeader: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.black,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.grey3,
  },

  badgeSlot: {
    height: 35,
    justifyContent: "flex-start",
    alignItems: "center",
  },

  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  txIconSlot: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.backdropWhite,
    justifyContent: "center",
    alignItems: "center",
  },
  txDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  txName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.black,
  },
  txMeta: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.black,
  },
  txAmountIncoming: {
    color: colors.primary,
  },
}))
