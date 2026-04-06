export interface AuthUser {
  id: string;
  username: string | null;
  email: string;
  name: string;
  createdAt: string | null;
  groups: string[];
}

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

export interface ConfirmSignUpInput {
  identifier: string;
  confirmationCode: string;
}

export interface ResendSignUpCodeInput {
  identifier: string;
}

export interface RequestPasswordResetInput {
  identifier: string;
}

export interface ConfirmPasswordResetInput {
  identifier: string;
  confirmationCode: string;
  newPassword: string;
}

export type AuthNextStep =
  | "DONE"
  | "CONFIRM_SIGN_UP"
  | "RESET_PASSWORD"
  | "CONFIRM_RESET_PASSWORD";

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: AuthUser | null;
  nextStep?: AuthNextStep;
  identifier?: string;
  codeDeliveryDestination?: string | null;
  username?: string | null;
}

export type AuthProviderMode = "local" | "cognito";
