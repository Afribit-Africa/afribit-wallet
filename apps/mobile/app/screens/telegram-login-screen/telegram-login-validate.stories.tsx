import * as React from "react"

import { RouteProp } from "@react-navigation/native"
import { MockedProvider } from "@apollo/client/testing"
import { createCache } from "../../graphql/cache"
import { TelegramLoginScreen } from "./telegram-login-validate"

import { PhoneValidationStackParamList } from "../../navigation/stack-param-lists"

export const TelegramLogin = ({
  mockRoute,
}: {
  mockRoute: RouteProp<PhoneValidationStackParamList, "telegramLoginValidate">
}) => (
  <MockedProvider cache={createCache()}>
    <TelegramLoginScreen route={mockRoute} />
  </MockedProvider>
)
