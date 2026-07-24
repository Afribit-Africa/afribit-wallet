import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { gql } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useAppConfig, useAppConfig as _useAppConfig } from "@app/hooks"
import {
  useAccountDefaultWalletLazyQuery,
  useRealtimePriceQuery,
  UserContact,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logParseDestinationResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RouteProp } from "@react-navigation/native"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useScanContext } from "@app/hooks/use-scan-context"
import { ActiveWalletStatus } from "@app/types/wallet"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

import { testProps } from "../../utils/testProps"
import { resolveDestination } from "./payment-destination/resolve-destination"
import {
  DestinationDirection,
  InvalidDestinationReason,
  ParseDestinationResult,
  PaymentDestination,
  isSendDestination,
} from "./payment-destination/index.types"

gql`
  query sendScreen {
    globals {
      network
    }
    me {
      id
      defaultAccount {
        id
        wallets {
          id
        }
      }
      contacts {
        id
        handle
        username
        alias
        transactionsCount
      }
    }
  }
`

type DetectionState =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "resolved"; result: ParseDestinationResult; railLabel: string; displayName: string }
  | { status: "error"; message: string }

type Props = {
  route: RouteProp<RootStackParamList, "sendManual">
}

export const SendScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "sendManual">>()
  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial, isReady: isWalletReady } = activeWallet
  const { sdk } = useSelfCustodialWallet()
  const sparkNetwork = useSparkNetwork()

  const [input, setInput] = useState("")
  const [detection, setDetection] = useState<DetectionState>({ status: "idle" })
  const inputRef = useRef(input)
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { myWalletIds, bitcoinNetwork, lnurlDomains } = useScanContext()

  useRealtimePriceQuery({ fetchPolicy: "network-only", skip: !isAuthed })

  const [accountDefaultWalletQuery] = useAccountDefaultWalletLazyQuery({
    fetchPolicy: "no-cache",
  })

  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const clearDetection = useCallback(() => {
    setDetection({ status: "idle" })
  }, [])

  const resolveInput = useCallback(
    async (rawInput: string) => {
      if (!bitcoinNetwork || !rawInput) return
      setDetection({ status: "resolving" })

      try {
        const destination = await resolveDestination(
          {
            rawInput,
            myWalletIds,
            bitcoinNetwork,
            lnurlDomains,
            accountDefaultWalletQuery,
          },
          { sdk, network: sparkNetwork },
          lnAddressHostname,
        )
        logParseDestinationResult(destination)

        if (!destination.valid) {
          const reason = destination.invalidReason
          let msg: string
          switch (reason) {
            case InvalidDestinationReason.SelfPayment:
              navigation.navigate("conversionDetails")
              setDetection({ status: "idle" })
              return
            case InvalidDestinationReason.InvoiceExpired:
              msg = LL.ScanningQRCodeScreen.expiredContent({ found: rawInput })
              break
            case InvalidDestinationReason.UnknownDestination:
              msg = LL.ScanningQRCodeScreen.invalidContent({ found: rawInput })
              break
            default:
              msg = LL.ScanningQRCodeScreen.invalidContent({ found: rawInput })
          }
          setDetection({ status: "error", message: msg })
          return
        }

        if (destination.destinationDirection !== DestinationDirection.Send) {
          navigation.reset({
            routes: [
              { name: "Primary" },
              {
                name: "redeemBitcoinDetail",
                params: { receiveDestination: destination },
              },
            ],
          })
          return
        }

        const pType = destination.validDestination.paymentType
        const railLabel =
          pType === "lightning" || pType === "lnurl"
            ? "Lightning"
            : pType === "onchain"
              ? "On-chain"
              : pType === "spark"
                ? "Spark"
                : pType === "intraledger"
                  ? "Afribit Pay"
                  : ""

        const dest = destination.validDestination
        const displayName =
          "handle" in dest ? (dest as { handle: string }).handle : rawInput

        setDetection({
          status: "resolved",
          result: destination,
          railLabel,
          displayName,
        })
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          setDetection({ status: "error", message: err.message })
        }
      }
    },
    [
      bitcoinNetwork, myWalletIds, lnurlDomains, accountDefaultWalletQuery,
      sdk, sparkNetwork, lnAddressHostname, navigation, LL,
    ],
  )

  const handleChangeText = useCallback(
    (text: string) => {
      setInput(text)
      clearDetection()
      inputRef.current = text
      if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
      if (text.length > 0) {
        resolveTimeoutRef.current = setTimeout(() => resolveInput(text), 600)
      }
    },
    [clearDetection, resolveInput],
  )

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getString()
      setInput(text)
      clearDetection()
      resolveInput(text)
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
      }
      toastShow({
        type: "error",
        message: (translations) =>
          translations.ScanningQRCodeScreen.openLinkTitle?.() ?? "Could not paste",
        LL,
      })
    }
  }, [resolveInput, clearDetection, LL])

  const handleFill = useCallback(
    (value: string) => {
      setInput(value)
      resolveInput(value)
    },
    [resolveInput],
  )

  const handleContinue = useCallback(() => {
    if (detection.status === "resolved" && isSendDestination(detection.result)) {
      navigation.navigate("sendConfirm", { paymentDestination: detection.result })
    }
  }, [detection, navigation])

  useEffect(() => {
    return () => {
      if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (route.params?.payment && route.params.payment !== inputRef.current) {
      const text = route.params.payment
      setInput(text)
      inputRef.current = text
      resolveInput(text)
      return
    }
    if (route.params?.username) {
      const text = route.params.username
      const displayText = text.includes("@") ? text : `${text}@${lnAddressHostname}`
      setInput(displayText)
      inputRef.current = displayText
      resolveInput(displayText)
    }
  }, [route.params?.payment, route.params?.username])

  if (isSelfCustodial && !isWalletReady) {
    const isOfflineOrError =
      activeWallet.status === ActiveWalletStatus.Error ||
      activeWallet.status === ActiveWalletStatus.Unavailable
    return (
      <Screen>
        <View style={styles.centered}>
          {isOfflineOrError ? (
            <Text style={styles.offlineText}>{LL.SendBitcoinScreen.walletOffline()}</Text>
          ) : (
            <ActivityIndicator size="large" />
          )}
        </View>
      </Screen>
    )
  }

  const isDisabled =
    !input || detection.status === "resolving"

  return (
    <Screen preset="scroll" keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <GaloyIcon name="arrow-left" size={22} color={colors.black} />
          </Pressable>
          <Text style={styles.title}>Send</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>To</Text>
          <View
            style={[
              styles.inputContainer,
              detection.status === "error" && styles.inputError,
              detection.status === "resolved" && styles.inputValid,
            ]}
          >
            <Text
              style={styles.input}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {input || (
                <Text color={colors.grey3}>Phone number or Lightning address</Text>
              )}
            </Text>
            {input ? (
              <Pressable onPress={() => handleChangeText("")} hitSlop={12}>
                <GaloyIcon name="close" size={18} color={colors.grey3} />
              </Pressable>
            ) : (
              <Pressable onPress={handlePaste} hitSlop={12}>
                <Text style={styles.pasteText}>{LL.common.paste()}</Text>
              </Pressable>
            )}
          </View>

          {detection.status === "resolving" && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.detectionLoader}
            />
          )}

          {detection.status === "resolved" && (
            <View style={styles.railPill}>
              <GaloyIcon name="lightning" size={12} color={colors.primary} />
              <Text style={styles.railPillText}>{detection.railLabel}</Text>
            </View>
          )}

          {detection.status === "error" && (
            <Text style={styles.errorText}>{detection.message}</Text>
          )}

          {!input && (
            <View style={styles.trySection}>
              <Text style={styles.tryLabel}>TRY ONE</Text>
              <Pressable
                style={styles.tryRow}
                onPress={() => handleFill("wanjiku@blink.sv")}
              >
                <View style={styles.tryIconCircle}>
                  <GaloyIcon name="lightning" size={16} color={colors.primary} />
                </View>
                <View style={styles.tryTextArea}>
                  <Text style={styles.tryValue}>wanjiku@blink.sv</Text>
                  <Text style={styles.tryDesc}>Lightning address</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.tryRow}
                onPress={() => navigation.navigate("scanningQRCode")}
              >
                <View style={styles.tryIconCircle}>
                  <GaloyIcon name="scan" size={16} color={colors.primary} />
                </View>
                <View style={styles.tryTextArea}>
                  <Text style={styles.tryValue}>Scan a QR code</Text>
                  <Text style={styles.tryDesc}>Lightning or M-Pesa</Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>

        <GaloyPrimaryButton
          title={input ? LL.common.next() : "Enter a destination"}
          loading={detection.status === "resolving"}
          disabled={isDisabled}
          onPress={handleContinue}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 26,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineText: {
    textAlign: "center",
    fontSize: 16,
    color: colors.error,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 16,
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.black,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.grey3,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.grey5,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputValid: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: colors.black,
  },
  pasteText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  detectionLoader: {
    marginTop: 12,
  },
  railPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.backdropWhite,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    alignSelf: "flex-start",
  },
  railPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.error,
  },
  trySection: {
    marginTop: 22,
  },
  tryLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.grey3,
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  tryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  tryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.backdropWhite,
    borderWidth: 1,
    borderColor: colors.backdropWhiter ?? colors.grey4,
    justifyContent: "center",
    alignItems: "center",
  },
  tryTextArea: {
    flex: 1,
  },
  tryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.black,
  },
  tryDesc: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 2,
  },
}))

export default SendScreen