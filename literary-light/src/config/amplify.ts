import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { sessionStorage } from "aws-amplify/utils";
import { isCognitoConfigured, runtimeConfig } from "@/config/runtime";

let isAmplifyConfigured = false;

export function configureAmplifyAuth(): void {
  if (isAmplifyConfigured || !isCognitoConfigured()) {
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: runtimeConfig.cognitoUserPoolId!,
        userPoolClientId: runtimeConfig.cognitoUserPoolClientId!,
        ...(runtimeConfig.cognitoIdentityPoolId
          ? { identityPoolId: runtimeConfig.cognitoIdentityPoolId }
          : {}),
        signUpVerificationMethod: "code",
        loginWith: {
          username: true,
          email: true,
        },
        passwordFormat: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true,
        },
      },
    },
  });

  cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);
  isAmplifyConfigured = true;
}
