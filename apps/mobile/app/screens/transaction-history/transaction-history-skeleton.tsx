import * as React from "react"
import { View, useWindowDimensions } from "react-native"
import ContentLoader, { Rect } from "react-content-loader/native"
import { makeStyles } from "@rn-vui/themed"

// Hardcoded to match transaction-history-screen.tsx's dark #0F0F11 background
// (this component is only used there) rather than colors.loaderBackground/
// loaderForeground, which are tuned for a light-mode screen background.
const SKELETON_BACKGROUND = "#1d1d1d"
const SKELETON_FOREGROUND = "#2b2b2b"

const TransactionHistorySkeleton = () => {
  const styles = useStyles()
  const { height } = useWindowDimensions()

  return (
    <View style={styles.container}>
      <ContentLoader
        height={height}
        width="100%"
        speed={1.2}
        backgroundColor={SKELETON_BACKGROUND}
        foregroundColor={SKELETON_FOREGROUND}
      >
        <Rect x="0" y="40" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="102" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="164" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="226" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="288" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="350" rx="10" ry="10" width="100%" height="60" />
      </ContentLoader>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    alignSelf: "stretch",
  },
}))

export default TransactionHistorySkeleton
