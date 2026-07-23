import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { ScrollView } from "react-native-gesture-handler"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { BITIKA_BASE_URL, requireBitikaApiKey } from "@app/self-custodial/config"
import { usePriceConversion, SATS_PER_BTC } from "@app/hooks/use-price-conversion"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"

import BitikaIcon from "@app/assets/logo/bitika/bitika-icon.svg"

const QUICK_AMOUNTS = [500, 1000, 2000, 5000]
const MIN_KES = 10
const MAX_KES = 10000
const KES_TO_USD = 130
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120000

type TransactionStatus =
  | "processing"
  | "processing_payment"
  | "fulfilled"
  | "failed"
  | "payment_failed"

type ScreenState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "polling"; transactionCode: string; status: TransactionStatus }
  | { kind: "success"; transactionCode: string }
  | { kind: "error"; message: string }

const bitikaCollect = async (
  apiKey: string,
  amount: string,
  phone: string,
  lightningAddress: string,
): Promise<{ transaction_code: string; status: string }> => {
  const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const response = await fetch(`${BITIKA_BASE_URL}/api/v1/xwift/collect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ amount, phone, lightningAddress }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(`Bitika API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

const bitikaPollStatus = async (
  apiKey: string,
  transactionCode: string,
): Promise<{ status: TransactionStatus; transaction_code: string }> => {
  const response = await fetch(
    `${BITIKA_BASE_URL}/api/v1/transactions/code/${transactionCode}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`)
  }

  return response.json()
}

const formatPhoneForDisplay = (raw: string): string => {
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length <= 9)
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 12)}`
}

export const BuyBitcoinScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { lightningAddress } = useSelfCustodialWallet()
  const { usdPerSat } = usePriceConversion()
  const { formatMoneyAmount } = useDisplayCurrency()

  const [kesAmount, setKesAmount] = useState("")
  const [phone, setPhone] = useState("254")
  const [state, setState] = useState<ScreenState>({ kind: "idle" })
  const phoneRef = useRef<TextInput>(null)

  const isAuthed = useIsAuthed()
  const { data: settingsData } = useSettingsScreenQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-and-network",
  })

  const accountPhone = settingsData?.me?.phone ?? null

  useEffect(() => {
    if (accountPhone && phone === "254") {
      setPhone(accountPhone)
    }
  }, [accountPhone])

  const kesNumeric = parseInt(kesAmount, 10) || 0

  const estimatedSats = React.useMemo(() => {
    if (!usdPerSat || kesNumeric <= 0) return null
    const usdAmount = kesNumeric / KES_TO_USD
    const satsPerUsd = 1 / parseFloat(usdPerSat)
    return Math.round(usdAmount * satsPerUsd)
  }, [kesNumeric, usdPerSat])

  const formattedSats = React.useMemo(() => {
    if (estimatedSats === null) return null
    return formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(estimatedSats) })
  }, [estimatedSats, formatMoneyAmount])

  const isValid =
    kesNumeric >= MIN_KES &&
    kesNumeric <= MAX_KES &&
    phone.replace(/\D/g, "").length >= 10 &&
    Boolean(lightningAddress)

  const handleQuickAmount = (amount: number) => {
    setKesAmount(amount.toString())
  }

  const handleBuy = useCallback(async () => {
    if (!isValid || !lightningAddress) return

    const apiKey = (() => {
      try {
        return requireBitikaApiKey()
      } catch {
        Alert.alert("Configuration Error", "Bitika API key is not configured.")
        return null
      }
    })()

    if (!apiKey) return

    setState({ kind: "loading" })

    try {
      const result = await bitikaCollect(
        apiKey,
        kesAmount,
        phone.replace(/\D/g, ""),
        lightningAddress,
      )

      const transactionCode = result.transaction_code
      const initialStatus = result.status as TransactionStatus

      if (initialStatus === "fulfilled") {
        setState({ kind: "success", transactionCode })
        return
      }

      if (initialStatus === "failed" || initialStatus === "payment_failed") {
        setState({
          kind: "error",
          message:
            initialStatus === "payment_failed"
              ? "M-Pesa payment went through but Lightning payout failed. Support has been notified."
              : "M-Pesa payment was declined. Please try again.",
        })
        return
      }

      setState({ kind: "polling", transactionCode, status: initialStatus })

      const startTime = Date.now()

      const poll = async () => {
        try {
          const statusResult = await bitikaPollStatus(apiKey, transactionCode)
          const newStatus = statusResult.status

          if (newStatus === "fulfilled") {
            setState({ kind: "success", transactionCode })
            return
          }

          if (newStatus === "failed" || newStatus === "payment_failed") {
            setState({
              kind: "error",
              message:
                newStatus === "payment_failed"
                  ? "M-Pesa payment went through but Lightning payout failed."
                  : "M-Pesa payment was declined. Please try again.",
            })
            return
          }

          if (Date.now() - startTime > POLL_TIMEOUT_MS) {
            setState({
              kind: "error",
              message:
                "Transaction is taking longer than expected. Check your wallet for incoming sats.",
            })
            return
          }

          setState({ kind: "polling", transactionCode, status: newStatus })
          setTimeout(poll, POLL_INTERVAL_MS)
        } catch {
          setTimeout(poll, POLL_INTERVAL_MS)
        }
      }

      setTimeout(poll, POLL_INTERVAL_MS)
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred."
      setState({ kind: "error", message })
    }
  }, [isValid, lightningAddress, kesAmount, phone])

  const handleDismiss = () => {
    setState({ kind: "idle" })
    setKesAmount("")
  }

  const statusLabel = (s: TransactionStatus): string => {
    switch (s) {
      case "processing":
        return "Confirming M-Pesa..."
      case "processing_payment":
        return "Sending sats to your wallet..."
      case "fulfilled":
        return "Complete!"
      case "failed":
        return "M-Pesa declined"
      case "payment_failed":
        return "Lightning payout failed"
    }
  }

  const renderStateOverlay = () => {
    switch (state.kind) {
      case "loading":
        return (
          <View style={styles.stateOverlay}>
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateTitle}>Initiating payment...</Text>
              <Text style={styles.stateSubtitle}>
                You'll receive an M-Pesa prompt shortly.
              </Text>
            </View>
          </View>
        )
      case "polling":
        return (
          <View style={styles.stateOverlay}>
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateTitle}>{statusLabel(state.status)}</Text>
              <Text style={styles.stateSubtitle}>
                KES {kesAmount} · {formattedSats ?? "..."}
              </Text>
              <Text style={styles.stateCode}>{state.transactionCode}</Text>
            </View>
          </View>
        )
      case "success":
        return (
          <View style={styles.stateOverlay}>
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Sats delivered!</Text>
              <Text style={styles.stateSubtitle}>
                KES {kesAmount} · {formattedSats ?? "..."}
              </Text>
              <Text style={styles.stateCode}>{state.transactionCode}</Text>
              <View style={styles.stateButtonRow}>
                <Pressable
                  style={[styles.stateButton, { backgroundColor: colors.primary }]}
                  onPress={handleDismiss}
                >
                  <Text style={styles.stateButtonText}>Buy more</Text>
                </Pressable>
                <Pressable
                  style={[styles.stateButton, { backgroundColor: colors.grey5 }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.stateButtonText, { color: colors.black }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      case "error":
        return (
          <View style={styles.stateOverlay}>
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Payment failed</Text>
              <Text style={styles.stateSubtitle}>{state.message}</Text>
              <View style={styles.stateButtonRow}>
                <Pressable
                  style={[styles.stateButton, { backgroundColor: colors.primary }]}
                  onPress={handleDismiss}
                >
                  <Text style={styles.stateButtonText}>Try again</Text>
                </Pressable>
                <Pressable
                  style={[styles.stateButton, { backgroundColor: colors.grey5 }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.stateButtonText, { color: colors.black }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      default:
        return null
    }
  }

  return (
    <Screen headerShown={false} backgroundColor={colors.white}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Buy bitcoin</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* KES Amount */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount (KES)</Text>
            <TextInput
              style={styles.amountInput}
              value={kesAmount}
              onChangeText={(t) => {
                const filtered = t.replace(/[^0-9]/g, "")
                if (filtered.length <= 5) setKesAmount(filtered)
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.grey3}
              maxLength={5}
            />
            {kesNumeric > 0 && (kesNumeric < MIN_KES || kesNumeric > MAX_KES) && (
              <Text style={styles.validationError}>
                Amount must be between KES {MIN_KES.toLocaleString()} and{" "}
                {MAX_KES.toLocaleString()}
              </Text>
            )}
            {formattedSats && (
              <Text style={styles.satsEstimate}>≈ {formattedSats}</Text>
            )}
          </View>

          {/* Quick Amounts */}
          <View style={styles.quickAmountRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <Pressable
                key={amt}
                style={[
                  styles.quickChip,
                  kesNumeric === amt && { backgroundColor: colors.primary },
                ]}
                onPress={() => handleQuickAmount(amt)}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    kesNumeric === amt && { color: colors.white },
                  ]}
                >
                  {amt.toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Phone */}
          <View style={styles.phoneSection}>
            <Text style={styles.phoneLabel}>M-Pesa phone number</Text>
            <TextInput
              ref={phoneRef}
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="254 712 345 678"
              placeholderTextColor={colors.grey3}
            />
            <Text style={styles.phoneHint}>
              An M-Pesa STK push will be sent to this number.
            </Text>
          </View>

          {/* Lightning destination info */}
          {lightningAddress ? (
            <View style={styles.destinationRow}>
              <Text style={styles.destinationLabel}>Sats delivered to</Text>
              <Text style={styles.destinationValue} numberOfLines={1}>
                {lightningAddress}
              </Text>
            </View>
          ) : (
            <Pressable
              style={styles.destinationRow}
              onPress={() => navigation.navigate("settings")}
            >
              <Text style={styles.destinationLabel}>
                Set a Lightning address in Settings to enable buying
              </Text>
              <Text style={styles.destinationValue}>Set up now →</Text>
            </Pressable>
          )}

          {/* Buy Button */}
          <GaloyPrimaryButton
            title="Buy bitcoin with M-Pesa"
            onPress={handleBuy}
            disabled={!isValid}
            containerStyle={styles.buyButtonContainer}
          />

          {/* Powered by Bitika */}
          <View style={styles.poweredByRow}>
            <BitikaIcon width={16} height={16} />
            <Text style={styles.poweredByText}>Powered by Bitika.xyz</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {renderStateOverlay()}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.grey3,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.black,
  },
  headerSpacer: {
    width: 60,
  },

  amountSection: {
    alignItems: "center",
    marginBottom: 18,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.grey3,
    marginBottom: 8,
  },
  amountInput: {
    fontSize: 46,
    fontWeight: "800",
    color: colors.black,
    textAlign: "center",
    minWidth: 120,
    paddingVertical: 4,
  },
  validationError: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.primary,
    marginTop: 6,
  },
  satsEstimate: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 6,
  },

  quickAmountRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 24,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.grey5,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
  },

  phoneSection: {
    marginBottom: 20,
  },
  phoneLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.black,
    marginBottom: 8,
  },
  phoneInput: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  phoneHint: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 6,
  },

  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    gap: 8,
  },
  destinationLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.grey3,
  },
  destinationValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.black,
    flex: 1,
  },

  buyButtonContainer: {
    marginBottom: 16,
  },

  poweredByRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  poweredByText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.grey3,
  },

  stateOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  stateCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
    marginTop: 16,
  },
  stateSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 6,
    textAlign: "center",
  },
  stateCode: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.grey3,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  stateButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  stateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  stateButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
}))
