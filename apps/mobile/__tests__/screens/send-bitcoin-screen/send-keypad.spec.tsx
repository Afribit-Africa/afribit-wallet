import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import { SendKeypad, SendKeypadKey } from "@app/screens/send-bitcoin-screen/send-keypad"

import { ContextForScreen } from "../helper"

const renderKeypad = (onPress: (key: SendKeypadKey) => void) =>
  render(
    <ContextForScreen>
      <SendKeypad onPress={onPress} />
    </ContextForScreen>,
  )

describe("SendKeypad", () => {
  it("renders all number keys and backspace", () => {
    const { getByTestId } = renderKeypad(jest.fn())
    expect(getByTestId("key-0")).toBeTruthy()
    expect(getByTestId("key-1")).toBeTruthy()
    expect(getByTestId("key-9")).toBeTruthy()
    expect(getByTestId("key-backspace")).toBeTruthy()
  })

  it("calls onPress with the correct key label on press", () => {
    const onPress = jest.fn()
    const { getByTestId } = renderKeypad(onPress)

    act(() => {
      fireEvent.press(getByTestId("key-7"))
    })
    expect(onPress).toHaveBeenCalledWith("7")

    act(() => {
      fireEvent.press(getByTestId("key-backspace"))
    })
    expect(onPress).toHaveBeenCalledWith("backspace")
  })

  it("calls onPress for each digit 0-9", () => {
    const onPress = jest.fn()
    const { getByTestId } = renderKeypad(onPress)

    for (let d = 0; d <= 9; d++) {
      act(() => {
        fireEvent.press(getByTestId(`key-${d}`))
      })
      expect(onPress).toHaveBeenCalledWith(String(d) as SendKeypadKey)
    }
    expect(onPress).toHaveBeenCalledTimes(10)
  })
})