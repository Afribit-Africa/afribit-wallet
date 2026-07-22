import * as React from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { ExpirationTimeButton } from "./expiration-time-button"
import { ExpirationTimeModal } from "./expiration-time-modal"
import { StyleProp, ViewStyle } from "react-native"
import { WalletCurrency } from "@app/graphql/generated"

export type ExpirationTimeInputProps = {
  expirationTime: number
  setExpirationTime?: (expirationTime: number) => void
  walletCurrency: WalletCurrency
  disabled: boolean
  big?: boolean
  style?: StyleProp<ViewStyle>
}

export const ExpirationTimeChooser: React.FC<ExpirationTimeInputProps> = ({
  expirationTime,
  setExpirationTime,
  walletCurrency,
  disabled,
  big,
  style,
}) => {
  const [openModal, setOpenModal] = React.useState(false)
  const { LL } = useI18nContext()

  const onSetExpirationTime = (expirationTime: number) => {
    setExpirationTime && setExpirationTime(expirationTime)
    setOpenModal(false)
  }

  if (openModal) {
    return (
      <ExpirationTimeModal
        value={expirationTime}
        isOpen={true}
        onSetExpirationTime={onSetExpirationTime}
        close={() => setOpenModal(false)}
        walletCurrency={walletCurrency}
      />
    )
  }

  const getExpirationTimeFormat = (timeIn: { minutes?: number }) => {
    const minutes = timeIn.minutes ?? 0
    if (minutes === 0) return null

    const unidades = [
      { umbral: 1440, singular: LL.common.day.one(), plural: LL.common.day.other() },
      { umbral: 60, singular: LL.common.hour(), plural: LL.common.hours() },
      { umbral: 1, singular: LL.common.minute(), plural: LL.common.minutes() },
    ]

    for (const unidad of unidades) {
      if (minutes >= unidad.umbral) {
        const cantidad = Math.floor(minutes / unidad.umbral)
        return `${cantidad} ${cantidad === 1 ? unidad.singular : unidad.plural}`
      }
    }

    return `${minutes} ${LL.common.minutes()}`
  }

  const onPressInputButton = () => {
    if (disabled) return
    setOpenModal(true)
  }

  return (
    <ExpirationTimeButton
      placeholder={LL.common.expirationTime()}
      onPress={onPressInputButton}
      value={getExpirationTimeFormat({ minutes: expirationTime })}
      disabled={disabled}
      iconName="pencil"
      primaryTextTestProps={"Expiration time input button"}
      big={big}
      style={style}
      {...testProps("Expiration time button")}
    />
  )
}
