import React, { useCallback, useState } from "react"
import { View, TouchableOpacity } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { CheckBox, Text, makeStyles, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"

/** Inlined from the former send-bitcoin-reducer — kept self-contained so this
 *  component can be carried over defensively (per product instruction) without
 *  depending on the now-deleted reducer. The new Send screen does not wire into
 *  this modal today because it uses a simplified single-field model, but the
 *  component is preserved so a future intraledger-confirmation flow can reuse it. */
export const DestinationState = {
  Entering: "Entering",
  Validating: "Validating",
  Valid: "Valid",
  Invalid: "Invalid",
  PhoneInvalid: "PhoneInvalid",
  PhoneNotAllowed: "PhoneNotAllowed",
  RequiresUsernameConfirmation: "RequiresUsernameConfirmation",
} as const
export type DestinationState = (typeof DestinationState)[keyof typeof DestinationState]

export const SendBitcoinActions = {
  SetUnparsedDestination: "SetUnparsedDestination",
  SetConfirmed: "SetConfirmed",
} as const

export type SendBitcoinDestinationAction =
  | { type: typeof SendBitcoinActions.SetUnparsedDestination; payload: { unparsedDestination: string } }
  | { type: typeof SendBitcoinActions.SetConfirmed; payload: { unparsedDestination: string } }

export type SendBitcoinDestinationState = {
  unparsedDestination: string
  destinationState: DestinationState
  confirmationUsernameType?: { type: string; username: string }
  destination?: unknown
  invalidDestination?: unknown
}

export type ConfirmDestinationModalProps = {
  destinationState: SendBitcoinDestinationState
  dispatchDestinationStateAction: React.Dispatch<SendBitcoinDestinationAction>
}

export const ConfirmDestinationModal: React.FC<ConfirmDestinationModalProps> = ({
  destinationState,
  dispatchDestinationStateAction,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const { lnAddressHostname: lnDomain, name: bankName } = appConfig.galoyInstance
  const [confirmationEnabled, setConfirmationEnabled] = useState(false)
  const confirmDestination = useCallback(() => {
    dispatchDestinationStateAction({
      type: SendBitcoinActions.SetConfirmed,
      payload: { unparsedDestination: destinationState.unparsedDestination },
    })
  }, [destinationState, dispatchDestinationStateAction])

  if (destinationState.destinationState !== DestinationState.RequiresUsernameConfirmation)
    return null

  const lnAddress = destinationState?.confirmationUsernameType?.username + "@" + lnDomain

  const goBack = () => {
    dispatchDestinationStateAction({
      type: SendBitcoinActions.SetUnparsedDestination,
      payload: { unparsedDestination: destinationState.unparsedDestination },
    })
  }

  return (
    <CustomModal
      isVisible={
        destinationState.destinationState ===
        DestinationState.RequiresUsernameConfirmation
      }
      toggleModal={goBack}
      title={LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()}
      image={<GaloyIcon name="info" size={100} color={colors.primary3} />}
      body={
        <View style={styles.body}>
          <Text type={"p2"} color={colors.warning} style={styles.warningText}>
            {LL.SendBitcoinDestinationScreen.confirmUsernameModal.warning({
              bankName,
            })}
          </Text>
        </View>
      }
      nonScrollingContent={
        <TouchableOpacity
          style={styles.checkBoxTouchable}
          onPress={() => setConfirmationEnabled(!confirmationEnabled)}
        >
          <View style={styles.checkBoxContainer}>
            <CheckBox
              {...testProps(
                LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                  lnAddress,
                }),
              )}
              containerStyle={styles.checkBox}
              checked={confirmationEnabled}
              iconType="ionicon"
              checkedIcon={"checkbox"}
              uncheckedIcon={"square-outline"}
              onPress={() => setConfirmationEnabled(!confirmationEnabled)}
            />
            <Text testID="address-is-right" type={"p2"} style={styles.checkBoxText}>
              {LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                lnAddress,
              })}
            </Text>
          </View>
        </TouchableOpacity>
      }
      primaryButtonOnPress={confirmDestination}
      primaryButtonDisabled={!confirmationEnabled}
      primaryButtonTitle={LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()}
      secondaryButtonTitle={LL.common.back()}
      secondaryButtonOnPress={goBack}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    rowGap: 12,
  },
  warningText: {
    textAlign: "center",
  },
  checkBoxTouchable: {
    marginTop: 12,
  },
  checkBoxContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
  },
  checkBox: {
    paddingLeft: 0,
    backgroundColor: "transparent",
  },
  checkBoxText: {
    flex: 1,
  },
}))