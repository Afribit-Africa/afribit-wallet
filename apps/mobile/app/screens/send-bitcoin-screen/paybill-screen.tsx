import React, { useState } from "react"
import { ActivityIndicator, Pressable, TextInput, View } from "react-native"
import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, useTheme } from "@rn-vui/themed"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDarajaPayout } from "@app/self-custodial/offramp/use-daraja-payout"
import { useMpesaStyles } from "./mpesa-shared-styles"

export const PaybillScreen: React.FC = () => {
  const { colors } = useTheme().theme
  const styles = useMpesaStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [paybill, setPaybill] = useState("")
  const [account, setAccount] = useState("")
  const [amount, setAmount] = useState("")

  const isValid = paybill.length >= 4 && account.length >= 1 && amount
  const kesAmount = parseInt(amount, 10) || 0

  const {
    execute,
    confirmPayout,
    status: payoutStatus,
    error: payoutError,
    quote,
  } = useDarajaPayout({
    destinationType: "PayBill",
    destination: paybill,
    kesAmount,
    accountReference: account,
  })

  const isProcessing =
    payoutStatus === "sending-sats" || payoutStatus === "paying-mpesa"

  const handlePress = () => {
    if (payoutStatus === "quote-ready") {
      confirmPayout()
    } else {
      execute()
    }
  }

  const showEcho = () => {
    if (payoutStatus === "submitted") {
      return (
        <View style={styles.echo}>
          <GaloyIcon name="check-circle" size={16} color={colors.primary} />
          <Text style={styles.echoText}>
            Payout submitted — {quote?.kesAmount} KES to Paybill {paybill}
          </Text>
        </View>
      )
    }
    if (payoutError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{payoutError}</Text>
          <Pressable style={styles.chip} onPress={handlePress}>
            <Text style={styles.chipText}>Retry</Text>
          </Pressable>
        </View>
      )
    }
    if (payoutStatus === "quote-ready" && quote) {
      return (
        <View style={styles.quoteBox}>
          <Text style={styles.echoText}>
            {quote.kesAmount} KES + {quote.feeKes} KES fee → recipient gets{" "}
            {quote.kesAmount - quote.feeKes} KES
          </Text>
        </View>
      )
    }
    if (isValid) {
      return (
        <View style={styles.echo}>
          <GaloyIcon name="check-circle" size={16} color={colors.primary} />
          <Text style={styles.echoText}>
            Paying KSh {amount} to Paybill {paybill}, account {account}
          </Text>
        </View>
      )
    }
    return null
  }

  return (
    <Screen preset="scroll" keyboardOffset="navigationHeader" style={styles.screen}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
        <GaloyIcon name="arrow-left" size={22} color={colors.black} />
      </Pressable>

      <Text style={styles.title}>Paybill</Text>
      <Text style={styles.desc}>Pay an M-Pesa Paybill</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Business Number</Text>
        <TextInput
          style={styles.input}
          value={paybill}
          onChangeText={setPaybill}
          placeholder="e.g. 888880"
          placeholderTextColor={colors.grey3}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Account Number</Text>
        <TextInput
          style={styles.input}
          value={account}
          onChangeText={setAccount}
          placeholder="e.g. ACC-123"
          placeholderTextColor={colors.grey3}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Amount (KES)</Text>
        <View style={styles.amountRow}>
          {["100", "500", "1000", "5000"].map((a) => (
            <Pressable
              key={a}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => setAmount(a)}
            >
              <Text style={styles.chipText}>{a}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.amountDisplay}>
          <Text style={styles.kesLabel}>KSh</Text>
          <TextInput
            style={styles.amountTextInput}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.grey3}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {showEcho()}

      {payoutStatus === "not-configured" ? (
        <View style={styles.notConfiguredBox}>
          <Text style={styles.errorText}>M-Pesa payouts aren't configured yet</Text>
        </View>
      ) : (
        <GaloyPrimaryButton
          title={
            isProcessing
              ? "Processing..."
              : payoutStatus === "quote-ready"
                ? "Confirm Payout"
                : "Confirm & Pay"
          }
          disabled={isProcessing || !isValid}
          onPress={handlePress}
        />
      )}

      {isProcessing && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.spinner}
        />
      )}
    </Screen>
  )
}