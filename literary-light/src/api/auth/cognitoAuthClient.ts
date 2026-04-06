import type {
  AuthResult,
  AuthUser,
  ConfirmPasswordResetInput,
  ConfirmSignUpInput,
  RequestPasswordResetInput,
  ResendSignUpCodeInput,
  SignInInput,
  SignUpInput,
} from "@contracts/auth";
import {
  confirmResetPassword as amplifyConfirmResetPassword,
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser as amplifyGetCurrentUser,
  resendSignUpCode as amplifyResendSignUpCode,
  resetPassword as amplifyResetPassword,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from "aws-amplify/auth";
import type { AuthClient } from "./client";
import { generateImmutableUsername } from "./generateImmutableUsername";
import { validatePassword } from "./passwordPolicy";

const USER_UNAUTHENTICATED_EXCEPTION = "UserUnAuthenticatedException";

function getErrorName(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return null;
  }

  const { name } = error as { name?: unknown };
  return typeof name === "string" ? name : null;
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return null;
  }

  const { message } = error as { message?: unknown };
  return typeof message === "string" ? message : null;
}

function isUnauthenticatedError(error: unknown): boolean {
  return getErrorName(error) === USER_UNAUTHENTICATED_EXCEPTION;
}

function getCodeDeliveryDestination(
  details?: { destination?: string | undefined } | null
): string | null {
  return details?.destination ?? null;
}

function getTokenGroups(payload: Record<string, unknown> | undefined): string[] {
  const groups = payload?.["cognito:groups"];

  if (Array.isArray(groups)) {
    return groups.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof groups === "string" && groups.trim()) {
    return groups
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function mapAuthError(error: unknown): string {
  const errorName = getErrorName(error);

  switch (errorName) {
    case "UserNotConfirmedException":
      return "Please confirm your account with the code we emailed you.";
    case "UserNotFoundException":
      return "We couldn't find an account with that email or username.";
    case "NotAuthorizedException":
      return "Incorrect email, username, or password.";
    case "PasswordResetRequiredException":
      return "This account requires a password reset before you can sign in.";
    case "UsernameExistsException":
    case "AliasExistsException":
      return "An account with that email already exists.";
    case "CodeMismatchException":
      return "That verification code is incorrect.";
    case "ExpiredCodeException":
      return "That verification code has expired. Request a new one and try again.";
    case "LimitExceededException":
    case "TooManyFailedAttemptsException":
    case "TooManyRequestsException":
      return "Too many attempts. Please wait a moment and try again.";
    case "UserAlreadyConfirmedException":
      return "This account is already verified. Please sign in.";
    case "InvalidPasswordException":
      return "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.";
    case "AuthTokenConfigException":
      return "Cognito is not configured correctly for this environment.";
    default:
      return getErrorMessage(error) ?? "Something went wrong while talking to Cognito.";
  }
}

async function loadCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const currentUser = await amplifyGetCurrentUser();
    const attributes = await fetchUserAttributes();
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;

    return {
      id: currentUser.userId,
      username: currentUser.username ?? null,
      email: attributes.email ?? "",
      name:
        attributes.name ??
        attributes.given_name ??
        attributes.preferred_username ??
        attributes.email ??
        currentUser.username,
      createdAt: null,
      groups: getTokenGroups(payload),
    };
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return null;
    }

    throw error;
  }
}

export class CognitoAuthClient implements AuthClient {
  readonly mode = "cognito" as const;

  async getCurrentUser(): Promise<AuthUser | null> {
    return loadCurrentAuthUser();
  }

  async signIn(input: SignInInput): Promise<AuthResult> {
    if (!input.identifier || !input.password) {
      return {
        success: false,
        error: "Email or username and password are required.",
      };
    }

    try {
      const result = await amplifySignIn({
        username: input.identifier.trim(),
        password: input.password,
      });

      if (result.isSignedIn || result.nextStep.signInStep === "DONE") {
        return {
          success: true,
          user: await loadCurrentAuthUser(),
          nextStep: "DONE",
        };
      }

      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        return {
          success: true,
          nextStep: "CONFIRM_SIGN_UP",
          identifier: input.identifier.trim(),
        };
      }

      if (result.nextStep.signInStep === "RESET_PASSWORD") {
        return {
          success: true,
          nextStep: "RESET_PASSWORD",
          identifier: input.identifier.trim(),
        };
      }

      return {
        success: false,
        error:
          "This account requires an additional sign-in step that isn't enabled in Lightning Classics yet.",
      };
    } catch (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    if (!input.email || !input.password || !input.name) {
      return {
        success: false,
        error: "Name, email, and password are required.",
      };
    }

    const passwordValidationError = validatePassword(input.password);
    if (passwordValidationError) {
      return {
        success: false,
        error: passwordValidationError,
      };
    }

    const username = generateImmutableUsername();

    try {
      const result = await amplifySignUp({
        username,
        password: input.password,
        options: {
          userAttributes: {
            email: input.email.trim().toLowerCase(),
            name: input.name.trim(),
          },
        },
      });

      if (result.isSignUpComplete || result.nextStep.signUpStep === "DONE") {
        return {
          success: true,
          user: await loadCurrentAuthUser(),
          nextStep: "DONE",
          username,
          identifier: input.email.trim(),
        };
      }

      return {
        success: true,
        nextStep: "CONFIRM_SIGN_UP",
        identifier: input.email.trim(),
        username,
        codeDeliveryDestination: getCodeDeliveryDestination(
          "codeDeliveryDetails" in result.nextStep ? result.nextStep.codeDeliveryDetails : null
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }
  }

  async confirmSignUp(input: ConfirmSignUpInput): Promise<AuthResult> {
    if (!input.identifier || !input.confirmationCode) {
      return {
        success: false,
        error: "Verification code is required.",
      };
    }

    try {
      const result = await amplifyConfirmSignUp({
        username: input.identifier.trim(),
        confirmationCode: input.confirmationCode.trim(),
      });

      if (result.isSignUpComplete || result.nextStep.signUpStep === "DONE") {
        return {
          success: true,
          nextStep: "DONE",
        };
      }

      return {
        success: true,
        nextStep: "CONFIRM_SIGN_UP",
        identifier: input.identifier.trim(),
        codeDeliveryDestination: getCodeDeliveryDestination(
          "codeDeliveryDetails" in result.nextStep ? result.nextStep.codeDeliveryDetails : null
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }
  }

  async resendSignUpCode(input: ResendSignUpCodeInput): Promise<AuthResult> {
    if (!input.identifier) {
      return {
        success: false,
        error: "Email or username is required.",
      };
    }

    try {
      const result = await amplifyResendSignUpCode({
        username: input.identifier.trim(),
      });

      return {
        success: true,
        nextStep: "CONFIRM_SIGN_UP",
        identifier: input.identifier.trim(),
        codeDeliveryDestination: getCodeDeliveryDestination(result),
      };
    } catch (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }
  }

  async requestPasswordReset(
    input: RequestPasswordResetInput,
  ): Promise<AuthResult> {
    if (!input.identifier) {
      return {
        success: false,
        error: "Email or username is required.",
      };
    }

    try {
      const result = await amplifyResetPassword({
        username: input.identifier.trim(),
      });

      if (result.isPasswordReset || result.nextStep.resetPasswordStep === "DONE") {
        return {
          success: true,
          nextStep: "DONE",
          identifier: input.identifier.trim(),
        };
      }

      return {
        success: true,
        nextStep: "CONFIRM_RESET_PASSWORD",
        identifier: input.identifier.trim(),
        codeDeliveryDestination: getCodeDeliveryDestination(
          result.nextStep.codeDeliveryDetails,
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }
  }

  async confirmPasswordReset(
    input: ConfirmPasswordResetInput,
  ): Promise<AuthResult> {
    if (!input.identifier || !input.confirmationCode || !input.newPassword) {
      return {
        success: false,
        error: "Reset code and new password are required.",
      };
    }

    const passwordValidationError = validatePassword(input.newPassword);
    if (passwordValidationError) {
      return {
        success: false,
        error: passwordValidationError,
      };
    }

    try {
      await amplifyConfirmResetPassword({
        username: input.identifier.trim(),
        confirmationCode: input.confirmationCode.trim(),
        newPassword: input.newPassword,
      });

      return {
        success: true,
        nextStep: "DONE",
        identifier: input.identifier.trim(),
      };
    } catch (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }
  }

  async signOut(): Promise<void> {
    await amplifySignOut();
  }
}
