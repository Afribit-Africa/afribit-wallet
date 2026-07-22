export const formatPublicKey = (rawKey: string): string => {
  try {
    return JSON.parse(`"${rawKey}"`).trim()
  } catch {
    return rawKey.replace(/\\n/g, "\n").replace(/\r/g, "").trim()
  }
}
