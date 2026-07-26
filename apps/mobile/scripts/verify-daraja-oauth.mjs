/**
 * Verifies that the Daraja 3.0 sandbox OAuth credentials work.
 *
 * Reads DARAJA_CONSUMER_KEY / DARAJA_CONSUMER_SECRET from
 * apps/mobile/.env.local and calls Safaricom's sandbox OAuth endpoint
 * with HTTP Basic Auth. Prints the raw response — token or error.
 *
 * Usage:
 *   node scripts/verify-daraja-oauth.mjs
 *
 * This is a DIAGNOSTIC script, not part of the app runtime. It exists
 * to confirm sandbox connectivity without going through the React Native
 * bundle + react-native-config indirection.
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(SCRIPT_DIR, "..", ".env.local")

const loadEnv = (path) => {
  const content = readFileSync(path, "utf-8")
  const vars = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

const OAUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"

const main = async () => {
  let env
  try {
    env = loadEnv(ENV_PATH)
  } catch (err) {
    console.error(`ERROR: Could not read ${ENV_PATH}`)
    console.error(err.message)
    process.exit(1)
  }

  const consumerKey = env.DARAJA_CONSUMER_KEY
  const consumerSecret = env.DARAJA_CONSUMER_SECRET

  if (!consumerKey) {
    console.error("ERROR: DARAJA_CONSUMER_KEY not found in", ENV_PATH)
    process.exit(1)
  }
  if (!consumerSecret) {
    console.error("ERROR: DARAJA_CONSUMER_SECRET not found in", ENV_PATH)
    process.exit(1)
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")

  console.log("Daraja OAuth Verification")
  console.log("=========================")
  console.log(`Endpoint: ${OAUTH_URL}`)
  console.log(`Consumer Key: ${consumerKey.slice(0, 8)}... (length ${consumerKey.length})`)
  console.log(`Consumer Secret: ${consumerSecret.slice(0, 4)}... (length ${consumerSecret.length})`)
  console.log(`Auth header: Basic ${auth.slice(0, 12)}... (length ${auth.length})`)
  console.log()

  let response
  try {
    response = await fetch(OAUTH_URL, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    })
  } catch (err) {
    console.error("NETWORK ERROR:", err.message)
    process.exit(1)
  }

  console.log(`HTTP Status: ${response.status} ${response.statusText}`)
  console.log("Response headers:")
  response.headers.forEach((value, key) => {
    if (key.startsWith("x-") || key === "content-type" || key === "date" || key === "server") {
      console.log(`  ${key}: ${value}`)
    }
  })

  const body = await response.text()

  console.log()
  console.log("Response body (raw):")
  console.log("---")
  console.log(body)
  console.log("---")

  if (!response.ok) {
    console.log()
    console.log("RESULT: FAILED — OAuth returned non-200")
    process.exit(1)
  }

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    console.log()
    console.log("RESULT: FAILED — response body is not valid JSON")
    process.exit(1)
  }

  if (parsed.access_token) {
    const token = parsed.access_token
    const expiresIn = parsed.expires_in ?? "unknown"
    const preview = token.length > 30
      ? `${token.slice(0, 10)}...${token.slice(-10)}`
      : token
    console.log()
    console.log("RESULT: SUCCESS")
    console.log(`  access_token: ${preview} (length ${token.length})`)
    console.log(`  expires_in:   ${expiresIn}`)
  } else {
    console.log()
    console.log("RESULT: FAILED — no access_token in response")
    console.log("  Keys in response:", Object.keys(parsed))
    process.exit(1)
  }
}

main()
