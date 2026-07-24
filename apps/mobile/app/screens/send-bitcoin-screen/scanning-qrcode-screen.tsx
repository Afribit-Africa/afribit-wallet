import * as React from "react"
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { launchImageLibrary } from "react-native-image-picker"
import Svg, { Circle } from "react-native-svg"
import { Camera, CameraType } from "react-native-camera-kit"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import RNQRGenerator from "rn-qr-generator"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import {
  useAccountDefaultWalletLazyQuery,
  useRealtimePriceQuery,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useScanContext } from "@app/hooks/use-scan-context"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { logParseDestinationResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"
import { testProps } from "@app/utils/testProps"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { DestinationDirection } from "./payment-destination/index.types"
import { resolveDestination } from "./payment-destination/resolve-destination"
import { parseKeQr, KeQrResult } from "./ke-qr-parser"

const { width: screenWidth } = Dimensions.get("window")
const { height: screenHeight } = Dimensions.get("window")

gql`
  query scanningQRCodeScreen {
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
      }
    }
  }
`

export const ScanningQRCodeScreen: React.FC = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "scanningQRCode">
    >()
  const isFocused = useIsFocused()

  // forcing price refresh
  useRealtimePriceQuery({ fetchPolicy: "network-only" })

  const {
    theme: { colors, mode },
  } = useTheme()

  const [pending, setPending] = React.useState(false)
  const [scannedCache, setScannedCache] = React.useState(new Set<string>())
  const [hasPermission, setHasPermission] = React.useState(false)
  const [isCameraUnavailable, setIsCameraUnavailable] = React.useState(false)
  const [detectedData, setDetectedData] = React.useState<{
    qrResult: KeQrResult
    rawData: string
  } | null>(null)
  const [showComingSoon, setShowComingSoon] = React.useState(false)

  type ScanMode = "lightning" | "mpesa"
  const [scanMode, setScanMode] = React.useState<ScanMode>("lightning")

  const { myWalletIds, bitcoinNetwork, lnurlDomains } = useScanContext()
  const [accountDefaultWalletQuery] = useAccountDefaultWalletLazyQuery({
    fetchPolicy: "no-cache",
  })

  const { LL } = useI18nContext()
  const { displayCurrency } = useDisplayCurrency()
  const { sdk } = useSelfCustodialWallet()
  const sparkNetwork = useSparkNetwork()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  React.useEffect(() => {
    if (!isFocused) {
      setScannedCache(new Set<string>())
      setDetectedData(null)
      setShowComingSoon(false)
    }
  }, [isFocused])

  React.useEffect(() => {
    const checkPermission = async () => {
      const permission =
        Platform.OS === "ios" ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA
      const result = await check(permission)
      if (result === RESULTS.GRANTED) {
        setHasPermission(true)
        return
      }
      const requestResult = await request(permission)
      if (requestResult === RESULTS.UNAVAILABLE) {
        setIsCameraUnavailable(true)
        return
      }
      setHasPermission(requestResult === RESULTS.GRANTED)
    }
    checkPermission()
  }, [])

  const loadInBrowser = (url: string) => {
    Linking.openURL(url).catch((err) => Alert.alert(err.toString()))
  }

  function isValidHttpUrl(input: string) {
    let url

    try {
      url = new URL(input)
    } catch (_) {
      return false
    }

    return url.protocol === "http:" || url.protocol === "https:"
  }

  const processInvoice = React.useMemo(() => {
    return async (data: string | undefined) => {
      if (pending || !bitcoinNetwork || !data) {
        return
      }
      try {
        setPending(true)

        const destination = await resolveDestination(
          {
            rawInput: data,
            myWalletIds,
            bitcoinNetwork,
            lnurlDomains,
            accountDefaultWalletQuery,
            inputSource: "qr",
            displayCurrency,
          },
          { sdk, network: sparkNetwork },
          lnAddressHostname,
        )
        logParseDestinationResult(destination)

        if (destination.valid) {
          if (destination.destinationDirection === DestinationDirection.Send) {
navigation.replace("sendConfirm", {
                paymentDestination: destination,
              })
            return
          }

          navigation.reset({
            routes: [
              {
                name: "Primary",
              },
              {
                name: "redeemBitcoinDetail",
                params: {
                  receiveDestination: destination,
                },
              },
            ],
          })
          return
        }
        switch (destination.invalidReason) {
          case "InvoiceExpired":
            Alert.alert(
              LL.ScanningQRCodeScreen.invalidTitle(),
              LL.ScanningQRCodeScreen.expiredContent({
                found: data.toString(),
              }),
              [
                {
                  text: LL.common.ok(),
                  onPress: () => setPending(false),
                },
              ],
            )
            break
          case "UnknownDestination":
            if (isValidHttpUrl(data.toString())) {
              Alert.alert(
                LL.ScanningQRCodeScreen.openLinkTitle(),
                `${data.toString()}\n\n${LL.ScanningQRCodeScreen.confirmOpenLink()}`,
                [
                  {
                    text: LL.common.No(),
                    onPress: () => setPending(false),
                  },
                  {
                    text: LL.common.yes(),
                    onPress: () => {
                      setPending(false)
                      loadInBrowser(data.toString())
                    },
                  },
                ],
              )
            } else {
              Alert.alert(
                LL.ScanningQRCodeScreen.invalidTitle(),
                LL.ScanningQRCodeScreen.invalidContent({
                  found: data.toString(),
                }),
                [
                  {
                    text: LL.common.ok(),
                    onPress: () => setPending(false),
                  },
                ],
              )
            }
            break
          default:
            Alert.alert(
              LL.ScanningQRCodeScreen.invalidTitle(),
              LL.ScanningQRCodeScreen.invalidContent({
                found: data.toString(),
              }),
              [
                {
                  text: LL.common.ok(),
                  onPress: () => setPending(false),
                },
              ],
            )
            break
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          Alert.alert(err.toString(), "", [
            {
              text: LL.common.ok(),
              onPress: () => setPending(false),
            },
          ])
        }
      }
    }
  }, [
    LL.ScanningQRCodeScreen,
    LL.common,
    navigation,
    pending,
    bitcoinNetwork,
    myWalletIds,
    lnurlDomains,
    accountDefaultWalletQuery,
    displayCurrency,
    sdk,
    sparkNetwork,
    lnAddressHostname,
  ])

  const handleCodeScanned = React.useCallback(
    (data: string) => {
      if (scannedCache.has(data) || pending) return
      setScannedCache(new Set(scannedCache).add(data))

      const qrResult = parseKeQr(data)

      if (scanMode === "lightning") {
        if (qrResult.type === "ke_qr") {
          Alert.alert(
            LL.ScanningQRCodeScreen.invalidTitle(),
            "This looks like an M-Pesa code — switch modes above to scan it.",
            [{ text: LL.common.ok(), onPress: () => setPending(false) }],
          )
          return
        }
        if (qrResult.type === "lightning") {
          setDetectedData({ qrResult, rawData: data })
          return
        }
        processInvoice(data)
        return
      }

      // scanMode === "mpesa"
      if (qrResult.type === "lightning") {
        Alert.alert(
          LL.ScanningQRCodeScreen.invalidTitle(),
          "This looks like a Lightning code — switch modes above to scan it.",
          [{ text: LL.common.ok(), onPress: () => setPending(false) }],
        )
        return
      }
      if (qrResult.type === "ke_qr") {
        setDetectedData({ qrResult, rawData: data })
        return
      }
      Alert.alert(
        LL.ScanningQRCodeScreen.invalidTitle(),
        LL.ScanningQRCodeScreen.invalidContent({
          found: data.toString(),
        }),
        [{ text: LL.common.ok(), onPress: () => setPending(false) }],
      )
    },
    [scannedCache, pending, processInvoice, scanMode, LL],
  )

  const styles = useStyles()

  const handleInvoicePaste = async () => {
    try {
      const data = await Clipboard.getString()
      processInvoice(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        Alert.alert(err.toString())
      }
    }
  }

  const showImagePicker = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: "photo" })
      if (result.errorCode === "permission") {
        toastShow({
          message: (translations) =>
            translations.ScanningQRCodeScreen.imageLibraryPermissionsNotGranted(),
          LL,
        })
      }
      if (result.assets && result.assets.length > 0) {
        const { uri } = result.assets[0]
        const qrCodeValues = await RNQRGenerator.detect({ uri })
        if (qrCodeValues && qrCodeValues.values.length > 0) {
          processInvoice(qrCodeValues.values[0])
          return
        }
        Alert.alert(LL.ScanningQRCodeScreen.noQrCode())
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        Alert.alert(err.toString())
      }
    }
  }

  const handleContinue = React.useCallback(() => {
    if (!detectedData) return
    if (detectedData.qrResult.type === "lightning") {
      setDetectedData(null)
      processInvoice(detectedData.rawData)
      return
    }
    if (detectedData.qrResult.type === "ke_qr") {
      setDetectedData(null)
      setShowComingSoon(true)
    }
  }, [detectedData, processInvoice])

  const handleDismissDetected = React.useCallback(() => {
    setDetectedData(null)
    setPending(false)
  }, [])

  const onError = React.useCallback(
    (event: { nativeEvent: { errorMessage: string } }) => {
      console.error(event.nativeEvent.errorMessage)
    },
    [],
  )

  if (isCameraUnavailable) {
    return (
      <Screen backgroundColor={colors.white}>
        <View style={styles.permissionMissing}>
          <Text type="h1" style={styles.permissionMissingText}>
            {LL.ScanningQRCodeScreen.noCamera()}
          </Text>
        </View>
      </Screen>
    )
  }

  if (!hasPermission) {
    const openSettings = () => {
      Linking.openSettings().catch(() => {
        Alert.alert(LL.ScanningQRCodeScreen.unableToOpenSettings())
      })
    }

    return (
      <Screen backgroundColor={colors.white}>
        <View style={styles.permissionMissing}>
          <Text type="h1" style={styles.permissionMissingText}>
            {LL.ScanningQRCodeScreen.permissionCamera()}
          </Text>
          <GaloyPrimaryButton
            title={LL.ScanningQRCodeScreen.openSettings()}
            onPress={openSettings}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen unsafe>
      {isFocused && (
        <Camera
          cameraType={CameraType.Back}
          focusMode="on"
          zoomMode="on"
          scanBarcode={true}
          onReadCode={(event) => handleCodeScanned(event.nativeEvent.codeStringValue)}
          onError={onError}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.rectangleContainer}>
          <View style={styles.rectangle} />
        </View>
        <Pressable onPress={navigation.goBack}>
          <View style={styles.close}>
            <Svg viewBox="0 0 100 100">
              {/* Fixed white, not a theme token: this semi-transparent circle
                  sits over the live camera feed, not a themed surface. */}
              <Circle cx={50} cy={50} r={50} fill="#FFFFFF" opacity={0.5} />
            </Svg>
            <GaloyIcon name="close" size={64} style={styles.iconClose} />
          </View>
        </Pressable>
        <View style={styles.modeToggleContainer}>
          <View style={styles.modeToggleOuter}>
            <Pressable
              onPress={() => setScanMode("lightning")}
              style={[
                styles.modeToggleSegment,
                scanMode === "lightning" && styles.modeToggleSegmentActive,
              ]}
              {...testProps("mode-lightning")}
            >
              <Text
                style={
                  scanMode === "lightning"
                    ? styles.modeToggleTextActive
                    : styles.modeToggleText
                }
              >
                Lightning
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScanMode("mpesa")}
              style={[
                styles.modeToggleSegment,
                scanMode === "mpesa" && styles.modeToggleSegmentActive,
              ]}
              {...testProps("mode-mpesa")}
            >
              <Text
                style={
                  scanMode === "mpesa"
                    ? styles.modeToggleTextActive
                    : styles.modeToggleText
                }
              >
                M-Pesa
              </Text>
            </Pressable>
          </View>
          <Text style={styles.modeHint}>
            {scanMode === "lightning"
              ? "Scan a Lightning invoice"
              : "Scan an M-Pesa code"}
          </Text>
        </View>
        <View style={styles.openGallery}>
          <Pressable onPress={showImagePicker}>
            {/* Fixed light-grey, not a theme token: this icon sits over the
                live camera feed where a fixed light-on-dark treatment is needed. */}
            <GaloyIcon
              name="image"
              size={64}
              color="#A8A39A"
              style={styles.iconGalery}
            />
          </Pressable>
          <Pressable onPress={handleInvoicePaste}>
            {/* Fixed light-grey, not a theme token: this icon sits over the
                live camera feed where a fixed light-on-dark treatment is needed. */}
            <GaloyIcon
              name="clipboard"
              size={64}
              color="#A8A39A"
              style={styles.iconClipboard}
            />
          </Pressable>
        </View>
      </View>

      {/* ─── Detected Rail Bottom Sheet ─── */}
      <Modal
        visible={detectedData !== null}
        animationType="slide"
        transparent
        onRequestClose={handleDismissDetected}
      >
        <Pressable style={styles.detectedOverlay} onPress={handleDismissDetected}>
          <Pressable style={styles.detectedSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.detectedHandle} />
            {detectedData?.qrResult ? (
              <>
{detectedData.qrResult.type === "lightning" ? (
                    <View style={styles.detectedPill}>
                      <GaloyIcon name="lightning" size={14} color={colors.primary} />
                      <Text style={styles.detectedPillText}>Lightning</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.detectedPill,
                        { backgroundColor: colors.backdropWhite },
                      ]}
                    >
                      <GaloyIcon name="lightning" size={14} color={colors.primary} />
                      <Text style={styles.detectedPillText}>
                        M-Pesa{" "}
                        {"subType" in detectedData.qrResult &&
                        detectedData.qrResult.subType === "till"
                          ? "Till"
                          : "subType" in detectedData.qrResult &&
                              detectedData.qrResult.subType === "paybill"
                            ? "Paybill"
                            : ""}
                      </Text>
                    </View>
                  )}
                <Text style={styles.detectedMerchant}>
                  {detectedData.qrResult.type === "ke_qr" &&
                  detectedData.qrResult.merchantName
                    ? detectedData.qrResult.merchantName
                    : detectedData.qrResult.type === "ke_qr"
                      ? "M-Pesa Merchant"
                      : detectedData.rawData}
                </Text>
                <Text style={styles.detectedSubDetail}>
                  Detected automatically
                  {detectedData.qrResult.type === "ke_qr" &&
                  detectedData.qrResult.amount
                    ? ` · KES ${detectedData.qrResult.amount}`
                    : ""}
                </Text>
                <GaloyPrimaryButton
                  title="Continue"
                  onPress={handleContinue}
                  containerStyle={styles.detectedContinue}
                  {...testProps("detected-continue")}
                />
                <Text style={styles.detectedFooter}>
                  Switch modes above to scan the other rail
                </Text>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── M-Pesa Coming Soon Modal ─── */}
      <Modal
        visible={showComingSoon}
        animationType="fade"
        transparent
        onRequestClose={() => setShowComingSoon(false)}
      >
        <View style={styles.comingSoonOverlay}>
          <View style={styles.comingSoonSheet}>
            <Text type="h2" style={styles.comingSoonTitle}>
              M-Pesa payments are coming soon
            </Text>
            <Text style={styles.comingSoonBody}>
              Off-ramp payouts are in active development. You'll be able to spend your
              bitcoin at any M-Pesa till, paybill, or phone number right from this scan
              screen — but we're not quite there yet.
            </Text>
            <GaloyPrimaryButton
              title="Got it"
              onPress={() => setShowComingSoon(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  // ── MODE TOGGLE (overlay on camera feed, dark background by design) ──
  modeToggleContainer: {
    alignItems: "center",
    marginTop: 80,
    gap: 7,
  },
  modeToggleOuter: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    backgroundColor: "rgba(10,10,12,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modeToggleSegment: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 9,
  },
  modeToggleSegmentActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
  },
  modeToggleTextActive: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modeHint: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
  },

  close: {
    alignSelf: "flex-end",
    height: 64,
    marginRight: 16,
    marginTop: 40,
    width: 64,
  },

  openGallery: {
    height: 128,
    left: 32,
    position: "absolute",
    top: screenHeight - 96,
    width: screenWidth,
  },

  rectangle: {
    borderColor: colors.primary,
    borderWidth: 2,
    height: screenWidth * 0.75,
    width: screenWidth * 0.75,
  },

  rectangleContainer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },

  // Fixed dark, not a theme token: the close icon sits over a semi-transparent
  // white circle which in turn sits over the live camera feed.
  iconClose: { position: "absolute", top: -2, color: "#0F0F11" },

  iconGalery: { opacity: 0.8 },

  iconClipboard: { opacity: 0.8, position: "absolute", bottom: "5%", right: "15%" },

  permissionMissing: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    rowGap: 32,
  },

  permissionMissingText: {
    width: "80%",
    textAlign: "center",
  },

  // ── DETECTED SHEET ──
  detectedOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  detectedSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 34,
    alignItems: "center",
  },
  detectedHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey3,
    marginTop: 8,
    marginBottom: 20,
    alignSelf: "center",
  },
  detectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.grey5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  detectedPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  detectedMerchant: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 6,
    textAlign: "center",
  },
  detectedSubDetail: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.grey3,
    marginBottom: 24,
    textAlign: "center",
  },
  detectedContinue: {
    marginBottom: 16,
    alignSelf: "stretch",
  },
  detectedFooter: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.grey3,
    textAlign: "center",
  },

  // ── COMING SOON ──
  comingSoonOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  comingSoonSheet: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 16,
  },
  comingSoonTitle: {
    color: colors.black,
    textAlign: "center",
  },
  comingSoonBody: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.grey3,
    textAlign: "center",
    lineHeight: 20,
  },
}))
