import React, { useState } from "react"
import { ActivityIndicator, Pressable, TextInput, View } from "react-native"
import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, useTheme } from "@rn-vui/themed"
import { PhoneInput, PhoneInputInfo } from "@app/components/phone-input"
import { sanitizePhoneNumber } from "@app/utils/phone"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDarajaPayout } from "@app/self-custodial/offramp/use-daraja-payout"
import { useMpesaStyles } from "./mpesa-shared-styles"

type Props = {
  route: RouteProp<RootStackParamList, "sendMpesaSendMoney">
}

export const SendMoneyScreen: React.FC<Props> = ({ route }) => {
  const { colors } = useTheme().theme
  const styles = useMpesaStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [phone, setPhone] = useState(route.params?.phoneNumber ?? "")
  const [amount, setAmount] = useState("")
  const [phoneInfo, setPhoneInfo] = useState<PhoneInputInfo | null>(null)

  const isValidPhone = Boolean(phoneInfo)
  const kesAmount = parseInt(amount, 10) || 0
  const sanitizedPhone = sanitizePhoneNumber(phone)
  const digitsOnly = sanitizedPhone.replace(/\D/g, "")

  const {
    execute,
    confirmPayout,
    status: payoutStatus,
    error: payoutError,
    quote,
  } = useDarajaPayout({
    destinationType: "PhoneNumber",
    destination: digitsOnly,
    kesAmount,
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
            Payout submitted — {quote?.kesAmount} KES to {phone}
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
    if (isValidPhone && amount) {
      return (
        <View style={styles.echo}>
          <GaloyIcon name="check-circle" size={16} color={colors.primary} />
          <Text style={styles.echoText}>
            Sending KSh {amount} to {phone}
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

      <Text style={styles.title}>Send Money</Text>
      <Text style={styles.desc}>Send KES to a phone number via M-Pesa</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Phone number</Text>
        <PhoneInput
          onChangeText={(t) => setPhone(sanitizePhoneNumber(t))}
          onChangeInfo={setPhoneInfo}
          value={phone}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Amount (KES)</Text>
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
          disabled={isProcessing || (!isValidPhone || !amount)}
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