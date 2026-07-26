import React from "react"
import { View, Pressable } from "react-native"
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated"
import { useIsFocused } from "@react-navigation/native"
import { Text, makeStyles } from "@rn-vui/themed"
import { useFragment } from "@apollo/client"

import {
  TransactionFragment,
  TransactionFragmentDoc,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useAppConfig } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useBounceInAnimation } from "@app/components/animations"
import { toWalletAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"

import { IconTransaction } from "../icon-transactions"
import { TransactionDate } from "../transaction-date"
import { DeepPartialObject } from "./index.types"

export const useDescriptionDisplay = ({
  tx,
  bankName,
}: {
  tx: TransactionFragment | DeepPartialObject<TransactionFragment>
  bankName: string
}) => {
  const { LL } = useI18nContext()

  if (!tx) return ""

  const { memo, direction, settlementVia } = tx
  if (memo) return memo

  const isReceive = direction === "RECEIVE"

  switch (settlementVia?.__typename) {
    case "SettlementViaOnChain":
      return "On-chain"
    case "SettlementViaLn":
      return "Lightning"
    case "SettlementViaIntraLedger":
      return isReceive
        ? `${LL.common.from()} ${settlementVia.counterPartyUsername || bankName + " User"}`
        : `${LL.common.to()} ${settlementVia.counterPartyUsername || bankName + " User"}`
  }
}

type Props = {
  txid: string
  subtitle?: boolean
  isFirst?: boolean
  isLast?: boolean
  highlight?: boolean
  onPress?: () => void
  testId?: string
}

const ROW_BG = "#0F0F11"

const TransactionItem: React.FC<Props> = ({
  txid,
  subtitle = false,
  isFirst = false,
  isLast = false,
  highlight = false,
  onPress,
  testId = "transaction-item",
}) => {
  const styles = useStyles({ highlight })

  const { data: tx } = useFragment<TransactionFragment>({
    fragment: TransactionFragmentDoc,
    fragmentName: "Transaction",
    from: { __typename: "Transaction", id: txid },
  })

  const { appConfig: { galoyInstance } } = useAppConfig()
  const { formatMoneyAmount, formatCurrency } = useDisplayCurrency()
  const { hideAmount } = useHideAmount()

  const description = useDescriptionDisplay({ tx, bankName: galoyInstance.name })

  const isFocused = useIsFocused()
  const scale = useSharedValue(1)
  useBounceInAnimation({ isFocused, visible: highlight, scale, delay: 300, duration: 120 })
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }), [scale])

  if (!tx || Object.keys(tx).length === 0) return null
  if (!tx.settlementCurrency || !tx.settlementDisplayAmount || !tx.settlementDisplayCurrency || !tx.id || !tx.createdAt || !tx.status) return null

  const isReceive = tx.direction === "RECEIVE"
  const isPending = tx.status === "PENDING"
  const walletCurrency = tx.settlementCurrency as WalletCurrency

  const formattedDisplayAmount = formatCurrency({
    amountInMajorUnits: tx.settlementDisplayAmount,
    currency: tx.settlementDisplayCurrency,
  })

  const prefix = isReceive ? "+" : "−"

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...testProps(testId)}
        style={styles.row}
        onPress={onPress}
      >
        <View style={styles.iconCircle}>
          <IconTransaction
            onChain={tx.settlementVia?.__typename === "SettlementViaOnChain"}
            isReceive={isReceive}
            pending={isPending}
            walletCurrency={walletCurrency}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {description}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              <TransactionDate createdAt={tx.createdAt} status={tx.status} includeTime={false} />
              {" · "}
              {tx.settlementVia?.__typename === "SettlementViaOnChain"
                ? "On-chain"
                : tx.settlementVia?.__typename === "SettlementViaLn"
                  ? "Lightning"
                  : tx.settlementVia?.__typename === "SettlementViaIntraLedger"
                    ? "Afribit Pay"
                    : "Bitcoin"}
            </Text>
          )}
        </View>
        {hideAmount ? (
          <Text style={styles.amountSend}>****</Text>
        ) : (
          <Text style={isPending ? styles.amountPending : isReceive ? styles.amountReceive : styles.amountSend}>
            {prefix}
            {formattedDisplayAmount}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  )
}

export const MemoizedTransactionItem = React.memo(TransactionItem)

type StyleProps = { highlight?: boolean }

const useStyles = makeStyles((_colors, props: StyleProps) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 24,
    backgroundColor: props.highlight ? "rgba(201,121,50,0.12)" : ROW_BG,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textBlock: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F7F5F2",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#A8A39A",
    marginTop: 2,
  },
  amountReceive: {
    fontSize: 14,
    fontWeight: "700",
    color: "#22C55E",
    textAlign: "right",
  },
  amountSend: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F7F5F2",
    textAlign: "right",
  },
  amountPending: {
    fontSize: 14,
    fontWeight: "700",
    color: "#A8A39A",
    textAlign: "right",
  },
}))