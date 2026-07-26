import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { FlatList } from "react-native-gesture-handler"
import { Screen } from "@app/components/screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useAppConfig } from "@app/hooks"
import {
  UserContact,
  useAccountDefaultWalletLazyQuery,
  useRealtimePriceQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logParseDestinationResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { SearchBar } from "@rn-vui/base"
import { makeStyles, useTheme, Text, ListItem } from "@rn-vui/themed"
import { CountryCode } from "libphonenumber-js/mobile"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useScanContext } from "@app/hooks/use-scan-context"
import { ActiveWalletStatus } from "@app/types/wallet"
import { useSelfCustodialContactList } from "@app/self-custodial/hooks/use-contact-list"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

import { testProps } from "../../utils/testProps"
import { resolveDestination } from "./payment-destination/resolve-destination"
import {
  DestinationDirection,
  InvalidDestinationReason,
} from "./payment-destination/index.types"
import { PhoneInput, PhoneInputInfo } from "@app/components/phone-input"
import {
  parseValidPhoneNumber,
  sanitizePhoneNumber,
} from "@app/utils/phone"

const InputType = { Search: "search", Phone: "phone" } as const
type TInputType = (typeof InputType)[keyof typeof InputType] | null

type Props = {
  route: RouteProp<RootStackParamList, "sendManual">
}

export const SendBitcoinDestinationScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()
  const { theme: { colors } } = useTheme()

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "sendManual">>()
  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial, isReady: isWalletReady } = activeWallet
  const { sdk } = useSelfCustodialWallet()
  const sparkNetwork = useSparkNetwork()

  const activeInputRef = useRef<TInputType>(InputType.Search)
  const [rawPhoneNumber, setRawPhoneNumber] = useState("")
  const [keepCountryCode, setKeepCountryCode] = useState(true)
  const [defaultPhoneInputInfo, setDefaultPhoneInputInfo] = useState<PhoneInputInfo | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [unparsedDestination, setUnparsedDestination] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [destinationError, setDestinationError] = useState("")
  const [goNextOnValid, setGoNextOnValid] = useState(false)
  const [validDestination, setValidDestination] = useState<Awaited<ReturnType<typeof resolveDestination>> | null>(null)
  const processedPaymentRef = useRef<string | null>(null)

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

  const selfCustodialContacts = useSelfCustodialContactList(isSelfCustodial)
  const allContacts: UserContact[] = useMemo(
    () => [...selfCustodialContacts].sort((a, b) => b.transactionsCount - a.transactionsCount),
    [selfCustodialContacts],
  )

  const [matchingContacts, setMatchingContacts] = useState<UserContact[]>([])

  useEffect(() => {
    setMatchingContacts(allContacts)
  }, [allContacts])

  const parseValidPhone = useCallback(
    (input: string) => {
      if (!defaultPhoneInputInfo) return null
      return parseValidPhoneNumber(input, defaultPhoneInputInfo.countryCode as CountryCode)
    },
    [defaultPhoneInputInfo],
  )

  const updateMatching = useCallback(
    (text: string) => {
      const word = text.toLowerCase()
      const filtered = allContacts.filter((c) =>
        c.handle.toLowerCase().includes(word),
      )
      setMatchingContacts(filtered)
    },
    [allContacts],
  )

  const reset = useCallback(() => {
    setUnparsedDestination("")
    setDestinationError("")
    setIsValidating(false)
    setValidDestination(null)
    setGoNextOnValid(false)
    setSelectedId("")
    updateMatching("")
  }, [updateMatching])

  const validateDestination = useCallback(
    async (rawInput: string) => {
      if (!bitcoinNetwork) return

      const isValidPhone = parseValidPhone(rawInput)
      if (activeInputRef.current === InputType.Phone && (!isValidPhone || !isValidPhone.isValid())) {
        setDestinationError(LL.SendBitcoinScreen.destinationRequired?.() ?? "Invalid phone number")
        setIsValidating(false)
        return
      }

      setIsValidating(true)
      setDestinationError("")

      try {
        const destination = await resolveDestination(
          { rawInput, myWalletIds, bitcoinNetwork, lnurlDomains, accountDefaultWalletQuery },
          { sdk, network: sparkNetwork },
          lnAddressHostname,
        )
        logParseDestinationResult(destination)

        if (!destination.valid) {
          if (destination.invalidReason === InvalidDestinationReason.SelfPayment) {
            navigation.navigate("conversionDetails")
            setValidDestination(null)
            setIsValidating(false)
            return
          }
          setDestinationError(LL.SendBitcoinScreen.destinationRequired?.() ?? "Invalid destination")
          setIsValidating(false)
          return
        }

        setValidDestination(destination)

        if (activeInputRef.current === InputType.Phone && goNextOnValid) {
          // Phone number entered in phone mode → route to M-Pesa Send Money
          const phoneNumber = isValidPhone?.number ?? rawInput
          navigation.navigate("sendMpesaSendMoney", { phoneNumber })
          return
        }

        // Check: if this resolved as Send → go to sendConfirm
        if (goNextOnValid && destination.destinationDirection === DestinationDirection.Send) {
          navigation.navigate("sendConfirm", { paymentDestination: destination })
          return
        }

        if (goNextOnValid && destination.destinationDirection === DestinationDirection.Receive) {
          navigation.navigate("redeemBitcoinDetail", { receiveDestination: destination })
        }
      } catch (err) {
        if (err instanceof Error) crashlytics().recordError(err)
        setDestinationError(err instanceof Error ? err.message : "Resolution failed")
      } finally {
        setIsValidating(false)
      }
    },
    [bitcoinNetwork, myWalletIds, lnurlDomains, accountDefaultWalletQuery, sdk, sparkNetwork, lnAddressHostname, navigation, parseValidPhone, goNextOnValid, LL],
  )

  const handleChangeText = useCallback((text: string) => {
    setUnparsedDestination(text)
    setValidDestination(null)
    setDestinationError("")
    setGoNextOnValid(false)
  }, [])

  const onFocusedInput = useCallback((type: TInputType) => {
    if (activeInputRef.current === type) return
    activeInputRef.current = type
    reset()
    setRawPhoneNumber("")
    setDefaultPhoneInputInfo(null)
  }, [reset])

  const initiateGoToNextScreen = useCallback(
    (input: string) => {
      if (!bitcoinNetwork) return
      setGoNextOnValid(true)
      validateDestination(input)
    },
    [bitcoinNetwork, validateDestination],
  )

  const handleContactPress = useCallback(
    async (item: UserContact) => {
      const handle = item?.handle?.trim() ?? ""
      const displayHandle = handle.includes("@") ? handle : `${handle}@${lnAddressHostname}`
      const parsePhone = parseValidPhone(displayHandle)

      if (parsePhone?.isValid() && activeInputRef.current === InputType.Search) {
        onFocusedInput(InputType.Phone)
      }
      handleSelection(item.id)

      if (activeInputRef.current === InputType.Phone) {
        setKeepCountryCode(false)
        const international = parsePhone?.number
        setUnparsedDestination(international || displayHandle)
        setRawPhoneNumber(international || displayHandle)
        initiateGoToNextScreen(international || displayHandle)
        setTimeout(() => setKeepCountryCode(true), 100)
        return
      }

      setUnparsedDestination(displayHandle)
      initiateGoToNextScreen(displayHandle)
    },
    [lnAddressHostname, parseValidPhone, onFocusedInput, initiateGoToNextScreen],
  )

  const handleSelection = useCallback((id: string) => {
    setSelectedId((c) => (c === id ? "" : id))
  }, [])

  const handlePasteSearch = useCallback(async () => {
    try {
      const text = await Clipboard.getString()
      onFocusedInput(InputType.Search)
      setUnparsedDestination(text)
      updateMatching(text)
      if (bitcoinNetwork) validateDestination(text)
    } catch (err) {
      if (err instanceof Error) crashlytics().recordError(err)
      toastShow({ type: "error", message: () => "Could not paste", LL })
    }
  }, [onFocusedInput, updateMatching, bitcoinNetwork, validateDestination, LL])

  const handlePastePhone = useCallback(async () => {
    try {
      const text = await Clipboard.getString()
      onFocusedInput(InputType.Phone)
      setKeepCountryCode(false)
      const sanitized = sanitizePhoneNumber(text)
      const parsed = parseValidPhone(sanitized)
      const phoneStr = parsed?.isValid() ? parsed.number : sanitized
      setRawPhoneNumber(phoneStr)
      setUnparsedDestination(phoneStr)
      updateMatching(phoneStr)
      if (bitcoinNetwork) validateDestination(phoneStr)
      setTimeout(() => setKeepCountryCode(true), 100)
    } catch (err) {
      if (err instanceof Error) crashlytics().recordError(err)
      toastShow({ type: "error", message: () => "Could not paste", LL })
    }
  }, [onFocusedInput, parseValidPhone, updateMatching, bitcoinNetwork, validateDestination, LL])

  useEffect(() => {
    if (route.params?.payment && route.params.payment !== processedPaymentRef.current) {
      processedPaymentRef.current = route.params.payment
      const text = route.params.payment
      const isValidPhone = parseValidPhone(text)
      if (isValidPhone?.isValid()) {
        onFocusedInput(InputType.Phone)
        setRawPhoneNumber(isValidPhone.number)
        setUnparsedDestination(isValidPhone.number)
      } else {
        onFocusedInput(InputType.Search)
        handleChangeText(text)
      }
      initiateGoToNextScreen(text)
    }
  }, [route.params?.payment])

  useEffect(() => {
    if (route.params?.username) {
      const text = route.params.username
      onFocusedInput(InputType.Search)
      handleChangeText(text)
      initiateGoToNextScreen(text)
    }
  }, [route.params?.username])

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

  return (
    <Screen keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        {/* ─── SEARCH BAR ─── */}
        <View
          style={[
            styles.fieldBackground,
            destinationError && activeInputRef.current === InputType.Search && styles.inputError,
            validDestination && activeInputRef.current === InputType.Search && styles.inputValid,
            activeInputRef.current === InputType.Phone && styles.disabledInput,
          ]}
          onStartShouldSetResponder={() => activeInputRef.current !== InputType.Search}
          onResponderRelease={() => onFocusedInput(InputType.Search)}
        >
          <SearchBar
            {...testProps(LL.SendBitcoinScreen.placeholder())}
            placeholder={LL.SendBitcoinScreen.placeholder()}
            value={activeInputRef.current === InputType.Search ? unparsedDestination : ""}
            onFocus={() => onFocusedInput(InputType.Search)}
            onChangeText={(t) => {
              onFocusedInput(InputType.Search)
              handleChangeText(t)
              updateMatching(t)
            }}
            onSubmitEditing={() =>
              unparsedDestination && initiateGoToNextScreen(unparsedDestination)
            }
            platform="default"
            showLoading={false}
            containerStyle={styles.searchBarContainer}
            inputContainerStyle={styles.searchBarInputContainer}
            inputStyle={styles.searchBarText}
            searchIcon={<></>}
            autoCapitalize="none"
            autoCorrect={false}
            clearIcon={<></>}
          />
          {unparsedDestination && activeInputRef.current === InputType.Search ? (
            <Pressable onPress={reset} style={styles.iconContainer}>
              <GaloyIcon name="close" size={24} color={colors.primary} />
            </Pressable>
          ) : (
            <Pressable onPress={handlePasteSearch}>
              <View style={styles.iconContainer}>
                <Text color={colors.primary} type="p2">{LL.common.paste()}</Text>
              </View>
            </Pressable>
          )}
        </View>
        {activeInputRef.current === InputType.Search && destinationError ? (
          <Text style={styles.errorText}>{destinationError}</Text>
        ) : null}

        {/* ─── "OR" DIVIDER + PHONE INPUT ─── */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <View style={styles.separatorTextWrap}>
            <Text style={styles.separatorText}>{LL.SendBitcoinScreen.orBySMS()}</Text>
          </View>
        </View>

        <View
          onStartShouldSetResponder={() => activeInputRef.current !== InputType.Phone}
          onResponderRelease={() => onFocusedInput(InputType.Phone)}
        >
          <PhoneInput
            rightIcon={
              rawPhoneNumber && activeInputRef.current === InputType.Phone ? (
                <Pressable onPress={reset}>
                  <GaloyIcon name="close" size={24} color={colors.primary} />
                </Pressable>
              ) : (
                <Pressable onPress={handlePastePhone}>
                  <Text color={colors.primary} type="p2">{LL.common.paste()}</Text>
                </Pressable>
              )
            }
            onChangeText={(t) => {
              onFocusedInput(InputType.Phone)
              setRawPhoneNumber(sanitizePhoneNumber(t))
            }}
            onChangeInfo={setDefaultPhoneInputInfo}
            value={activeInputRef.current === InputType.Phone ? rawPhoneNumber : ""}
            isDisabled={activeInputRef.current === InputType.Search}
            onFocus={() => onFocusedInput(InputType.Phone)}
            onSubmitEditing={() =>
              rawPhoneNumber && initiateGoToNextScreen(unparsedDestination || rawPhoneNumber)
            }
            inputContainerStyle={
              activeInputRef.current === InputType.Phone && destinationError
                ? styles.inputError
                : activeInputRef.current === InputType.Phone && validDestination
                  ? styles.inputValid
                  : undefined
            }
            bgColor={colors.grey5}
            keepCountryCode={keepCountryCode}
          />
        </View>

        {/* ─── CONTACTS ─── */}
        {matchingContacts.length > 0 && (
          <>
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <View style={styles.separatorTextWrap}>
                <Text style={styles.separatorText}>{LL.SendBitcoinScreen.orSaved()}</Text>
              </View>
            </View>
            <FlatList
              style={styles.flatList}
              data={matchingContacts}
              extraData={selectedId}
              renderItem={({ item }) => (
                <View style={[
                  styles.contactRow,
                  item.id === selectedId && styles.contactRowSelected,
                ]}>
                  <ListItem
                    key={item.handle}
                    containerStyle={styles.listItem}
                    onPress={() => handleContactPress(item)}
                  >
                    <GaloyIcon name="user" size={20} />
                    <ListItem.Content>
                      <ListItem.Title style={styles.contactText} numberOfLines={1}>
                        {item.handle.includes("@") ? item.handle : `${item.handle}@${lnAddressHostname}`}
                      </ListItem.Title>
                    </ListItem.Content>
                  </ListItem>
                </View>
              )}
              keyExtractor={(item) => item.handle}
            />
          </>
        )}

        {/* ─── "OR" DIVIDER + M-PESA TILES ─── */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <View style={styles.separatorTextWrap}>
            <Text style={styles.separatorText}>Or pay with M-Pesa</Text>
          </View>
        </View>
        <View style={styles.mpesaTiles}>
          <Pressable
            style={styles.mpesaTile}
            onPress={() => navigation.navigate("sendMpesaSendMoney")}
          >
            <View style={styles.tileIcon}>
              <GaloyIcon name="send" size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileTitle}>Send Money</Text>
            <Text style={styles.tileDesc}>Send to a phone number</Text>
          </Pressable>
          <Pressable
            style={styles.mpesaTile}
            onPress={() => navigation.navigate("sendMpesaPaybill")}
          >
            <View style={styles.tileIcon}>
              <GaloyIcon name="bank" size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileTitle}>Paybill</Text>
            <Text style={styles.tileDesc}>Pay a business account</Text>
          </Pressable>
          <Pressable
            style={styles.mpesaTile}
            onPress={() => navigation.navigate("sendMpesaTill")}
          >
            <View style={styles.tileIcon}>
              <GaloyIcon name="storefront" size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileTitle}>Till Number</Text>
            <Text style={styles.tileDesc}>Pay a Buy Goods till</Text>
          </Pressable>
        </View>

        {/* ─── NEXT BUTTON ─── */}
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton
            title={
              unparsedDestination
                ? LL.common.next()
                : LL.SendBitcoinScreen.destinationRequired()
            }
            loading={isValidating}
            disabled={
              !unparsedDestination ||
              (activeInputRef.current === InputType.Phone && !rawPhoneNumber)
            }
            onPress={() => initiateGoToNextScreen(unparsedDestination)}
          />
        </View>
      </View>
    </Screen>
  )
}

const mpMpesaTileBase = {
  flex: 1,
  minWidth: 140,
  borderRadius: 14,
  backgroundColor: "rgba(238,144,28,0.08)",
  borderWidth: 1,
  borderColor: "rgba(238,144,28,0.2)",
  padding: 16,
  gap: 8,
}

const useStyles = makeStyles(({ colors }) => ({
  container: { padding: 20, flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  offlineText: { textAlign: "center", fontSize: 16, color: colors.error, paddingHorizontal: 20 },
  fieldBackground: {
    flexDirection: "row", overflow: "hidden",
    backgroundColor: colors.grey5, borderRadius: 10,
    borderColor: colors.transparent, borderWidth: 1,
    justifyContent: "center", alignItems: "center", height: 60,
  },
  inputError: { borderColor: colors.error, borderWidth: 1 },
  inputValid: { borderColor: colors.primary, borderWidth: 1 },
  disabledInput: { opacity: 0.6 },
  searchBarContainer: {
    flex: 1, backgroundColor: colors.transparent,
    borderBottomColor: colors.transparent, borderTopColor: colors.transparent, padding: 0,
  },
  searchBarInputContainer: { backgroundColor: colors.transparent, marginLeft: -10 },
  searchBarText: { color: colors.black, textDecorationLine: "none" },
  iconContainer: { justifyContent: "center", alignItems: "center", marginRight: 12 },
  errorText: { marginTop: 4, fontSize: 13, color: colors.error },
  separator: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: 28, marginBottom: 22,
  },
  separatorLine: {
    backgroundColor: colors.grey5, height: 1, borderRadius: 10, flex: 1, position: "relative",
  },
  separatorTextWrap: {
    backgroundColor: colors.white, paddingHorizontal: 20,
    alignItems: "center", justifyContent: "center", alignSelf: "center", position: "absolute", zIndex: 1,
  },
  separatorText: { color: colors.grey3, textAlign: "center", fontSize: 14 },
  flatList: { flex: 1 },
  contactRow: {
    borderColor: colors.transparent, borderWidth: 1,
    borderRadius: 8, overflow: "hidden", marginBottom: 4,
  },
  contactRowSelected: { borderColor: colors.primary, backgroundColor: colors.grey5 },
  listItem: { backgroundColor: colors.transparent },
  contactText: { color: colors.black },
  mpesaTiles: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  mpesaTile: {
    ...mpMpesaTileBase,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(238,144,28,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  tileTitle: { fontSize: 15, fontWeight: "700", color: colors.black },
  tileDesc: { fontSize: 12, fontWeight: "500", color: colors.grey3 },
  buttonContainer: { marginTop: 26, flex: 0, justifyContent: "flex-end" },
}))

export default SendBitcoinDestinationScreen