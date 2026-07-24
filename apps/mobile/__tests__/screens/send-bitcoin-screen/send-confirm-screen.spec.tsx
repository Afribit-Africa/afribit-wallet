import React from "react"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { WalletCurrency } from "@app/graphql/generated"
import {
  ConvertMoneyAmount,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { PaymentType } from "@blinkbitcoin/blink-client"
import SendConfirmScreen from "@app/screens/send-bitcoin-screen/send-confirm-screen"

import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
const mockDispatch = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: mockSetOptions,
    dispatch: mockDispatch,
    goBack: jest.fn(),
    getState: () => ({ routes: [{ name: "Primary" }], index: 0 }),
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
    // This app is self-custodial only - several hooks (useActiveWallet,
    // usePriceConversion) branch on activeAccount.type to decide which data
    // path to use, so an undefined activeAccount pushes them down the dead
    // custodial/unauthenticated path instead.
    activeAccount: { id: "self-custodial-default", type: "self-custodial" },
    selfCustodialEntries: [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  // Inline converter (not the outer `convertMoneyAmount` const below) -
  // jest.mock factories run while this file's imports are still resolving,
  // before any of this file's own top-level consts have initialized.
  usePriceConversion: () => ({
    convertMoneyAmount: (amount: { amount: number }, currency: string) => ({
      amount: amount.amount,
      currency,
      currencyCode: currency,
    }),
    zeroDisplayAmount: { amount: 0, currency: "USD", currencyCode: "USD" },
    displayCurrency: "USD",
    toDisplayMoneyAmount: (amount: number) => ({
      amount,
      currency: "USD",
      currencyCode: "USD",
    }),
  }),
  SATS_PER_BTC: 100000000,
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: null }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

// This app is self-custodial only - bypass the account-registry resolution
// chain entirely and go straight to a ready self-custodial wallet with real
// balances, matching how send-screen.spec.tsx mocks the same hook.
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({
    isSelfCustodial: true,
    isReady: true,
    status: "connected",
    accountType: "selfCustodial",
    wallets: [
      { id: "btc-wallet", balance: { amount: 500000 }, walletCurrency: "BTC" },
      { id: "usd-wallet", balance: { amount: 10000 }, walletCurrency: "USD" },
    ],
  }),
}))

jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    loading: false,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useSendBitcoinInternalLimitsQuery: jest.fn(() => ({ data: null })),
  useSendBitcoinWithdrawalLimitsQuery: jest.fn(() => ({ data: null })),
  useSendBitcoinConfirmationScreenQuery: jest.fn(() => ({
    data: {
      me: {
        id: "user-1",
        defaultAccount: {
          id: "acct-1",
          wallets: [
            { id: "btc-wallet", balance: 500000, walletCurrency: "BTC" },
            { id: "usd-wallet", balance: 10000, walletCurrency: "USD" },
          ],
        },
      },
    },
  })),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => ({ countryCode: "KE", loading: false }),
  useIpCountryCode: () => undefined,
}))

const convertMoneyAmount: ConvertMoneyAmount = (amount, currency) => ({
  amount: amount.amount,
  currency,
  currencyCode: currency === "USD" ? "USD" : currency,
})

const sendingWalletDescriptor = {
  id: "btc-wallet",
  currency: WalletCurrency.Btc,
} as const

function buildPaymentDetail(overrides: Partial<PaymentDetail<WalletCurrency>> = {}): PaymentDetail<WalletCurrency> {
  // `result` (not `base`) is what setConvertMoneyAmount/setSendingWalletDescriptor
  // must return - the screen calls these on mount (see the setConvertMoneyAmount
  // effect) and closing over the pre-override `base` would silently discard
  // whatever `overrides` this call was given (e.g. canSetAmount: true).
  let result: PaymentDetail<WalletCurrency>
  const base: PaymentDetail<WalletCurrency> = {
    paymentType: PaymentType.Lightning,
    destination: "lnbc1testdestination",
    sendingWalletDescriptor,
    convertMoneyAmount,
    setConvertMoneyAmount: () => result,
    setSendingWalletDescriptor: () => result,
    settlementAmount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    settlementAmountIsEstimated: false,
    unitOfAccountAmount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    destinationSpecifiedAmount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    canSetAmount: false,
    canSetMemo: false,
    canGetFee: true,
    getFee: jest.fn().mockResolvedValue({
      amount: { amount: 5, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    }),
    canSendPayment: true,
    sendPaymentMutation: jest.fn().mockResolvedValue({ status: "SUCCESS" }),
  }
  // Test helper only: PaymentDetail is a large discriminated union keyed off
  // paymentType/canSetAmount/etc, so merging partial overrides can't be
  // statically verified against every branch - the cast is deliberate here.
  result = { ...base, ...overrides } as PaymentDetail<WalletCurrency>
  return result
}

function buildRoute(pd: PaymentDetail<WalletCurrency>) {
  return {
    key: "sendConfirm",
    name: "sendConfirm" as const,
    params: {
      paymentDestination: {
        valid: true,
        destinationDirection: "Send" as const,
        validDestination: { paymentType: "lightning" as const },
        createPaymentDetail: () => pd,
      },
    },
  }
}

const flushAsync = () =>
  act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))

beforeAll(() => {
  loadLocale("en")
})

describe("SendConfirmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders 'You're paying' and destination for a fixed-amount Lightning payment", async () => {
    const detail = buildPaymentDetail()
    const route = buildRoute(detail)

    render(
      <ContextForScreen>
        <SendConfirmScreen route={route as never} />
      </ContextForScreen>,
    )

    await waitFor(() => expect(screen.getByText("You're paying")).toBeTruthy())
    expect(screen.getByText("lnbc1testdestination")).toBeTruthy()
  })

  it("renders the rail pill with payment type", async () => {
    const detail = buildPaymentDetail()
    const route = buildRoute(detail)

    render(
      <ContextForScreen>
        <SendConfirmScreen route={route as never} />
      </ContextForScreen>,
    )

    const LL = i18nObject("en")
    await waitFor(() =>
      expect(screen.getByText(`Paying via ${LL.common.lightning()}`)).toBeTruthy(),
    )
  })

  it("shows keypad when amount is editable", async () => {
    const detail = buildPaymentDetail({
      canSetAmount: true,
      setAmount: () => detail,
    })
    const route = buildRoute(detail)

    render(
      <ContextForScreen>
        <SendConfirmScreen route={route as never} />
      </ContextForScreen>,
    )

    // Keypad keys should be present
    await waitFor(() => expect(screen.getByTestId("key-0")).toBeTruthy())
    for (let d = 1; d <= 9; d++) {
      expect(screen.getByTestId(`key-${d}`)).toBeTruthy()
    }
    expect(screen.getByTestId("key-backspace")).toBeTruthy()
  })

  it("does not show keypad when amount is fixed", async () => {
    const detail = buildPaymentDetail({ canSetAmount: false })
    const route = buildRoute(detail)

    render(
      <ContextForScreen>
        <SendConfirmScreen route={route as never} />
      </ContextForScreen>,
    )

    await waitFor(() => expect(screen.getByText("You're paying")).toBeTruthy())
    // Keypad should NOT be present for fixed-amount payments
    expect(() => screen.getByTestId("key-1")).toThrow()
  })

  it("shows wallet currency pill", async () => {
    const detail = buildPaymentDetail()
    const route = buildRoute(detail)

    render(
      <ContextForScreen>
        <SendConfirmScreen route={route as never} />
      </ContextForScreen>,
    )

    // CurrencyPill renders LL.common.bitcoin() ("Bitcoin"), not the "BTC" ticker
    await waitFor(() => expect(screen.getByText("Bitcoin")).toBeTruthy())
  })

  it("shows the slider button", async () => {
    const detail = buildPaymentDetail()
    const route = buildRoute(detail)

    render(
      <ContextForScreen>
        <SendConfirmScreen route={route as never} />
      </ContextForScreen>,
    )

    const LL = i18nObject("en")
    await waitFor(() =>
      expect(screen.getByText(LL.SendBitcoinConfirmationScreen.slideToConfirm())).toBeTruthy(),
    )
  })
})