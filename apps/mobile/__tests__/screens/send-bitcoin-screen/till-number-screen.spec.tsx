import React from "react"
import { render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TillNumberScreen } from "@app/screens/send-bitcoin-screen/till-number-screen"

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

describe("TillNumberScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and description", () => {
    render(
      <ContextForScreen>
        <TillNumberScreen />
      </ContextForScreen>,
    )
    expect(screen.getAllByText("Till Number").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Pay an M-Pesa Buy Goods Till")).toBeTruthy()
  })

  it("renders field labels", () => {
    render(
      <ContextForScreen>
        <TillNumberScreen />
      </ContextForScreen>,
    )
    expect(screen.getAllByText("Till Number").length).toBe(2)
    expect(screen.getByText("Amount (KES)")).toBeTruthy()
  })

  it("confirmation echo does not show when fields are empty", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <TillNumberScreen />
      </ContextForScreen>,
    )
    expect(queryByText(/Paying KSh/)).toBeNull()
  })

  it("quick-amount chips render", () => {
    render(
      <ContextForScreen>
        <TillNumberScreen />
      </ContextForScreen>,
    )
    expect(screen.getByText("100")).toBeTruthy()
    expect(screen.getByText("5000")).toBeTruthy()
  })
})