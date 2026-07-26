import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { Network } from "@app/graphql/generated"
import { SendBitcoinDestinationScreen } from "@app/screens/send-bitcoin-screen/send-bitcoin-destination-screen"

import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: jest.fn(),
    setParams: jest.fn(),
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useRealtimePriceQuery: jest.fn(() => ({})),
  useAccountDefaultWalletLazyQuery: jest.fn(() => [jest.fn()]),
  Network: { Mainnet: "mainnet" },
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
}))

const mockResolveDestination = jest.fn()
jest.mock(
  "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination",
  () => ({
    resolveDestination: (...args: unknown[]) => mockResolveDestination(...args),
  }),
)

const mockScanContext = jest.fn()
jest.mock("@app/hooks/use-scan-context", () => ({
  useScanContext: () => mockScanContext(),
}))

const mockSelfCustodialContacts = jest.fn()
jest.mock("@app/self-custodial/hooks/use-contact-list", () => ({
  useSelfCustodialContactList: () => mockSelfCustodialContacts(),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: null }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({
    isSelfCustodial: true,
    isReady: true,
    status: "connected",
    accountType: "selfCustodial",
    wallets: [],
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  ...jest.requireActual("@app/store/persistent-state"),
  usePersistentStateContext: () => ({
    persistentState: {
      schemaVersion: 12,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
    },
    updateState: jest.fn(),
    resetState: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  AccountRegistryProvider: ({ children }: { children: React.ReactNode }) => children,
  useAccountRegistry: () => ({
    accounts: [],
    activeAccount: { id: "sc-default", type: "selfCustodial" },
    selfCustodialEntries: [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    loading: false,
  }),
}))

jest.mock("@app/components/phone-input", () => {
  const React = require("react")
  const { TextInput } = require("react-native")
  return {
    PhoneInput: ({
      onChangeText, onChangeInfo, value, isDisabled, onFocus, onSubmitEditing,
    }: Record<string, unknown>) => (
      <TextInput
        testID="phone-input"
        onChangeText={(t: string) => {
          if (typeof onChangeText === "function") onChangeText(t)
          if (typeof onChangeInfo === "function") onChangeInfo({ countryCode: "KE", countryCallingCode: "254", rawPhoneNumber: t })
        }}
        value={typeof value === "string" ? value : ""}
        editable={!isDisabled}
        onFocus={typeof onFocus === "function" ? onFocus : undefined}
        onSubmitEditing={typeof onSubmitEditing === "function" ? onSubmitEditing : undefined}
      />
    ),
  }
})

jest.mock("@app/utils/phone", () => ({
  ...jest.requireActual("@app/utils/phone"),
  sanitizePhoneNumber: (t: string) => t.replace(/[^0-9+]/g, ""),
  parseValidPhoneNumber: () => null,
  isPhoneNumber: () => false,
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({ countryCode: "KE", loading: false }),
}))

beforeAll(() => {
  loadLocale("en")
})

describe("SendBitcoinDestinationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockScanContext.mockReturnValue({
      myWalletIds: ["wallet-1"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: [],
    })
    mockSelfCustodialContacts.mockReturnValue([])
  })

  const renderScreen = () =>
    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen
          route={{ key: "sendManual", name: "sendManual", params: undefined }}
        />
      </ContextForScreen>,
    )

  it("renders the M-Pesa tiles", () => {
    renderScreen()
    expect(screen.getByText("Send Money")).toBeTruthy()
    expect(screen.getByText("Paybill")).toBeTruthy()
    expect(screen.getByText("Till Number")).toBeTruthy()
  })

  it("tapping Send Money tile navigates to sendMpesaSendMoney", () => {
    renderScreen()
    act(() => {
      fireEvent.press(screen.getByText("Send Money"))
    })
    expect(mockNavigate).toHaveBeenCalledWith("sendMpesaSendMoney")
  })

  it("tapping Paybill tile navigates to sendMpesaPaybill", () => {
    renderScreen()
    act(() => {
      fireEvent.press(screen.getByText("Paybill"))
    })
    expect(mockNavigate).toHaveBeenCalledWith("sendMpesaPaybill")
  })

  it("tapping Till Number tile navigates to sendMpesaTill", () => {
    renderScreen()
    act(() => {
      fireEvent.press(screen.getByText("Till Number"))
    })
    expect(mockNavigate).toHaveBeenCalledWith("sendMpesaTill")
  })

  it("renders the SearchBar placeholder", () => {
    renderScreen()
    const LL = i18nObject("en")
    expect(screen.getByPlaceholderText(LL.SendBitcoinScreen.placeholder())).toBeTruthy()
  })

  it("renders 'Or by SMS' divider text", () => {
    renderScreen()
    const LL = i18nObject("en")
    expect(screen.getByText(LL.SendBitcoinScreen.orBySMS())).toBeTruthy()
  })

  it("renders the Next button with destination-required text", () => {
    renderScreen()
    const LL = i18nObject("en")
    expect(screen.getByText(LL.SendBitcoinScreen.destinationRequired())).toBeTruthy()
  })

  it("renders 'Or pay with M-Pesa' divider text", () => {
    renderScreen()
    expect(screen.getByText("Or pay with M-Pesa")).toBeTruthy()
  })
})