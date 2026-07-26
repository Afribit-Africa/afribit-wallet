import React from "react"
import { render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { PaybillScreen } from "@app/screens/send-bitcoin-screen/paybill-screen"

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

beforeAll(() => {
  loadLocale("en")
})

describe("PaybillScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and description", () => {
    render(
      <ContextForScreen>
        <PaybillScreen />
      </ContextForScreen>,
    )
    expect(screen.getByText("Paybill")).toBeTruthy()
    expect(screen.getByText("Pay an M-Pesa Paybill")).toBeTruthy()
  })

  it("renders all three field labels", () => {
    render(
      <ContextForScreen>
        <PaybillScreen />
      </ContextForScreen>,
    )
    expect(screen.getByText("Business Number")).toBeTruthy()
    expect(screen.getByText("Account Number")).toBeTruthy()
    expect(screen.getByText("Amount (KES)")).toBeTruthy()
  })

  it("confirmation echo does not show when fields are empty", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <PaybillScreen />
      </ContextForScreen>,
    )
    expect(queryByText(/Paying KSh/)).toBeNull()
  })

  it("quick-amount chips render", () => {
    render(
      <ContextForScreen>
        <PaybillScreen />
      </ContextForScreen>,
    )
    expect(screen.getByText("100")).toBeTruthy()
    expect(screen.getByText("5000")).toBeTruthy()
  })
})