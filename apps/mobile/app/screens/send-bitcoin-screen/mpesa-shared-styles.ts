import { makeStyles } from "@rn-vui/themed"

export const useMpesaStyles = makeStyles(({ colors }) => ({
  screen: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 30 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.grey5,
    justifyContent: "center", alignItems: "center",
    marginTop: 16, marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.black, marginBottom: 4 },
  desc: { fontSize: 14, fontWeight: "500", color: colors.grey3, marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 13.5, fontWeight: "700", color: colors.grey3, marginBottom: 8 },
  input: {
    height: 56, borderRadius: 14,
    backgroundColor: colors.grey5, paddingHorizontal: 16,
    fontSize: 17, fontWeight: "600", color: colors.black,
  },
  amountRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" } as const,
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.backdropWhite,
    borderWidth: 1, borderColor: colors.backdropWhiter ?? colors.grey4,
  },
  chipPressed: { backgroundColor: colors.grey4 },
  chipText: { fontSize: 15, fontWeight: "700", color: colors.black },
  amountDisplay: {
    flexDirection: "row", alignItems: "baseline", gap: 6,
    height: 56, borderRadius: 14,
    backgroundColor: colors.grey5, paddingHorizontal: 16, paddingVertical: 12,
  },
  kesLabel: { fontSize: 20, fontWeight: "700", color: colors.grey3 },
  amountTextInput: { flex: 1, padding: 0, fontSize: 32, fontWeight: "800", color: colors.black },
  echo: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.backdropWhite, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24,
    borderWidth: 1, borderColor: colors.backdropWhiter ?? colors.grey4,
  },
  echoText: { fontSize: 14, fontWeight: "600", color: colors.black, flex: 1 },
  quoteBox: {
    backgroundColor: colors.backdropWhite, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24,
    borderWidth: 1, borderColor: colors.backdropWhiter ?? colors.grey4,
  },
  errorBox: {
    backgroundColor: colors.error9, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24,
  },
  errorText: { fontSize: 13, fontWeight: "500", color: colors.error },
  notConfiguredBox: {
    backgroundColor: colors.grey5, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
  },
  spinner: { marginTop: 16 },
}))