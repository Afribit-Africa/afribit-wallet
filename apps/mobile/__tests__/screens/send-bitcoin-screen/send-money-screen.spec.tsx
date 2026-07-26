import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { SendMoneyScreen } from "@app/screens/send-bitcoin-screen/send-money-screen"

import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}))

jest.mock("@app/utils/phone", () => ({
  sanitizePhoneNumber: (t: string) => t.replace(/[^0-9+]/g, ""),
  parseValidPhoneNumber: jest.fn(),
  isPhoneNumber: () => true,
}))

beforeAll(() => {
  loadLocale("en")
})

describe("SendMoneyScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and description", () => {
    render(
      <ContextForScreen>
        <SendMoneyScreen route={{ key: "sendMpesaSendMoney", name: "sendMpesaSendMoney", params: undefined }} />
      </ContextForScreen>,
    )
    expect(screen.getByText("Send Money")).toBeTruthy()
    expect(screen.getByText("Send KES to a phone number via M-Pesa")).toBeTruthy()
  })

  it("renders amount and phone fields", () => {
    render(
      <ContextForScreen>
        <SendMoneyScreen route={{ key: "sendMpesaSendMoney", name: "sendMpesaSendMoney", params: undefined }} />
      </ContextForScreen>,
    )
    expect(screen.getByText("Amount (KES)")).toBeTruthy()
    expect(screen.getByText("Phone number")).toBeTruthy()
  })

  it("mounts without a hooks-order error", async () => {
    // useDarajaPayout, usePriceConversion, and useDisplayCurrency are all
    // called unconditionally above any early return - this guards against
    // the rules-of-hooks bug class documented in named-delegate-agents
    // lesson #12 recurring here.
    expect(() =>
      render(
        <ContextForScreen>
          <SendMoneyScreen route={{ key: "sendMpesaSendMoney", name: "sendMpesaSendMoney", params: undefined }} />
        </ContextForScreen>,
      ),
    ).not.toThrow()
  })
})