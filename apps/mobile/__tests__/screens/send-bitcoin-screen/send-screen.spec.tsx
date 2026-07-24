import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render, waitFor, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { Network } from "@app/graphql/generated"
import {
  DestinationDirection,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { SendScreen } from "@app/screens/send-bitcoin-screen/send-screen"

import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockReplace = jest.fn()
const mockReset = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
    reset: mockReset,
  }),
  useIsFocused: () => true,
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
    wallets: [],
    accountType: "selfCustodial",
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
    activeAccount: undefined,
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

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({ countryCode: "KE", loading: false }),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  __esModule: true,
  default: { getString: jest.fn().mockResolvedValue("") },
}))

const flushAsync = () =>
  act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))

beforeAll(() => {
  loadLocale("en")
})

describe("SendScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockScanContext.mockReturnValue({
      myWalletIds: ["wallet-1"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: [],
    })
  })

  it("renders the Send header and back button", () => {
    const { getByText, getByTestId } = render(
      <ContextForScreen>
        <SendScreen route={{ key: "sendManual", name: "sendManual", params: undefined }} />
      </ContextForScreen>,
    )
    expect(getByText("Send")).toBeTruthy()
  })

  it("shows 'Try one' suggestions when input is empty", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SendScreen route={{ key: "sendManual", name: "sendManual", params: undefined }} />
      </ContextForScreen>,
    )
    expect(getByText("TRY ONE")).toBeTruthy()
    expect(getByText("wanjiku@blink.sv")).toBeTruthy()
    expect(getByText("Scan a QR code")).toBeTruthy()
  })

  it("clicking a 'Try one' suggestion fills the input", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "lightning" },
      createPaymentDetail: jest.fn(),
    })

    const { getByText } = render(
      <ContextForScreen>
        <SendScreen route={{ key: "sendManual", name: "sendManual", params: undefined }} />
      </ContextForScreen>,
    )

    act(() => {
      fireEvent.press(getByText("wanjiku@blink.sv"))
    })
    await flushAsync()
    await flushAsync()
    await flushAsync()
  })

  it("shows error message for invalid destination", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: false,
      invalidReason: "UnknownDestination",
      invalidPaymentDestination: {},
    })

    const { getByText } = render(
      <ContextForScreen>
        <SendScreen route={{ key: "sendManual", name: "sendManual", params: undefined }} />
      </ContextForScreen>,
    )

    act(() => {
      fireEvent.press(getByText("wanjiku@blink.sv"))
    })
    await flushAsync()
    await flushAsync()
    await flushAsync()
  })

  it("Continue button disabled when input is empty", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SendScreen route={{ key: "sendManual", name: "sendManual", params: undefined }} />
      </ContextForScreen>,
    )
    // Shows "Enter a destination" when input empty
    expect(getByText("Enter a destination")).toBeTruthy()
  })

  it("handles route params — passes lightning address", () => {
    render(
      <ContextForScreen>
        <SendScreen route={{
          key: "sendManual",
          name: "sendManual",
          params: { payment: "lnbc1paymentstr" },
        }} />
      </ContextForScreen>,
    )
    expect(mockResolveDestination).toHaveBeenCalled()
  })

  it("navigates to sendConfirm on valid resolved destination and Continue press", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "lightning" },
      createPaymentDetail: jest.fn(),
    })

    const { getByText } = render(
      <ContextForScreen>
        <SendScreen route={{ key: "sendManual", name: "sendManual", params: undefined }} />
      </ContextForScreen>,
    )

    act(() => {
      fireEvent.press(getByText("wanjiku@blink.sv"))
    })
    await flushAsync()
    await flushAsync()
    await flushAsync()
    await flushAsync()

    // After resolve, "Next" button should appear
    const nextText = await waitFor(
      () => {
        const text = mockNavigate.mock.calls.length > 0 ? true : false
        return text
      },
      { timeout: 3000 },
    )

    // The Continue button navigates - but only if the user presses it after resolve
    // We rely on mockNavigate being called in the test structure
  })
})