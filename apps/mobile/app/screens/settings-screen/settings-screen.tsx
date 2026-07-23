import { ScrollView } from "react-native-gesture-handler"
import React, { useEffect } from "react"
import { TouchableOpacity } from "react-native"

import { gql } from "@apollo/client"
import { makeStyles, Text } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { Screen } from "@app/components/screen"
import { SettingsCard } from "./settings-card"
import { useI18nContext } from "@app/i18n/i18n-react"
import { VersionComponent } from "@app/components/version"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useUnacknowledgedNotificationCountQuery } from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet"

import { AccountBanner } from "./account/banner"
import { SettingsGroup } from "./group"
import { DefaultWallet } from "./settings/account-default-wallet"
import { AccountLevelSetting } from "./settings/account-level"
import { AccountLNAddress } from "./settings/account-ln-address"
import { CurrencySetting } from "./settings/preferences-currency"
import { LanguageSetting } from "./settings/preferences-language"
import { ThemeSetting } from "./settings/preferences-theme"
import { NotificationSetting } from "./settings/sp-notifications"
import { OnDeviceSecuritySetting } from "./settings/sp-security"
import { StableBalanceSetting } from "./settings/stable-balance"
import { ViewBackupPhraseSetting } from "./settings/view-backup-phrase"
import { NeedHelpSetting } from "./settings/community-need-help"

// All queries in settings have to be set here so that the server is not hit with
// multiple requests for each query
gql`
  query UnacknowledgedNotificationCount {
    me {
      id
      unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount
    }
  }

  query SettingsScreen {
    me {
      id
      username
      language
      phone
      email {
        address
        verified
      }
      defaultAccount {
        id
        defaultWalletId
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }
`

export const SettingsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const { backupState } = useBackupState()
  const { data: unackNotificationCount } = useUnacknowledgedNotificationCountQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  const isSelfCustodialMode = activeAccount?.type === AccountType.SelfCustodial
  const shouldShowSettingsBanner =
    isSelfCustodialMode && backupState.status !== BackupStatus.Completed

  const items = {
    account: [
      AccountLevelSetting,
    ],
    waysToGetPaid: [AccountLNAddress],
    preferences: [
      NotificationSetting,
      DefaultWallet,
      CurrencySetting,
      LanguageSetting,
      ThemeSetting,
      StableBalanceSetting,
    ],
    securityAndPrivacy: [OnDeviceSecuritySetting, ViewBackupPhraseSetting],
    community: [NeedHelpSetting],
  }

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    const count =
      unackNotificationCount?.me
        ?.unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount || 0
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("notificationHistory")}>
          <GaloyIcon name="bell" size={24} style={styles.headerRight} />
          {count !== 0 && (
            <Text
              type="p4"
              style={styles.notificationCount}
              testID="notification-badge"
            />
          )}
        </TouchableOpacity>
      ),
    })
  }, [navigation, styles, unackNotificationCount])

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        <AccountBanner />
        {shouldShowSettingsBanner && (
          <SettingsCard
            title={LL.BackupNudge.title()}
            description={LL.BackupNudge.settingsWarning()}
            onPress={() => navigation.navigate("selfCustodialBackupMethod")}
            borderColor="primary"
            titleColor="primary"
          />
        )}
        <SettingsGroup name={LL.common.account()} items={items.account} />
        <SettingsGroup
          name={LL.SettingsScreen.addressScreen()}
          items={items.waysToGetPaid}
        />
        <SettingsGroup name={LL.common.preferences()} items={items.preferences} />
        <SettingsGroup
          name={LL.common.securityAndPrivacy()}
          items={items.securityAndPrivacy}
        />
        <SettingsGroup name={LL.common.support()} items={items.community} />
        <VersionComponent />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  outer: {
    marginTop: 5,
    paddingHorizontal: 12,
    paddingBottom: 20,
    display: "flex",
    flexDirection: "column",
    rowGap: 18,
  },
  headerRight: {
    marginRight: 12,
  },
  notificationCount: {
    position: "absolute",
    right: 9,
    top: -3,
    color: colors._darkGrey,
    backgroundColor: colors.black,
    textAlign: "center",
    verticalAlign: "middle",
    height: 14,
    width: 14,
    borderRadius: 9,
    overflow: "hidden",
  },
}))
