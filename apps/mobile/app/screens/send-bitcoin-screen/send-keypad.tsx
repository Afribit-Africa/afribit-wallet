import React from "react"
import { Pressable, View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

export type SendKeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "backspace"

type SendKeypadProps = {
  onPress: (key: SendKeypadKey) => void
}

const keyRows: SendKeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["0", "backspace"],
]

export const SendKeypad: React.FC<SendKeypadProps> = ({ onPress }) => {
  const styles = useStyles()

  return (
    <View style={styles.keypad}>
      {keyRows.map((row, ri) => (
        <View key={`kr${ri}`} style={styles.keyRow}>
          {row.length === 3 ? (
            row.map((k) => (
              <Key key={k} label={k} onPress={onPress} />
            ))
          ) : (
            <>
              <View style={styles.keySpacer} />
              <Key label={row[0]} onPress={onPress} />
              <Key label={row[1]} onPress={onPress} />
            </>
          )}
        </View>
      ))}
    </View>
  )
}

const Key: React.FC<{ label: SendKeypadKey; onPress: (k: SendKeypadKey) => void }> = ({
  label,
  onPress,
}) => {
  const styles = useStyles()

  return (
    <Pressable
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
      onPress={() => onPress(label)}
      {...testProps(`key-${label}`)}
    >
      {label === "backspace" ? (
        <GaloyIcon name="back-space" size={22} color={styles.backspaceIcon.color} />
      ) : (
        <Text style={styles.keyText}>{label}</Text>
      )}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  keypad: {
    gap: 6,
    width: "100%",
    paddingHorizontal: 8,
  },
  keyRow: {
    flexDirection: "row",
    gap: 6,
  },
  key: {
    flex: 1,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.grey5,
  },
  keySpacer: {
    flex: 1,
  },
  keyPressed: {
    backgroundColor: colors.grey4,
  },
  keyText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.black,
  },
  backspaceIcon: {
    color: colors.grey3,
  },
}))