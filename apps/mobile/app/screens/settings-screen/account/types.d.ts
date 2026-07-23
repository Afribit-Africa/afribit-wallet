type ProfileProps = {
  userId?: string | null
  identifier: string
  token: string
  selected: boolean
  avatarUrl?: string
  phone?: string | null
  email?: string | null
  accountId?: string
  isFirstItem?: boolean
  nextProfileToken?: string
  hasUsername?: boolean
  lnAddressHostname: string
}

interface TryFetchUserProps {
  token: string
  fetchUsername: (options?: { context?: Record<string, unknown> }) => Promise<{
    data?: {
      me?: {
        id: string
        phone?: string | null
        username?: string | null
        email?: { address?: string | null } | null
        defaultAccount: { id: string }
      } | null
    }
  }>
}
