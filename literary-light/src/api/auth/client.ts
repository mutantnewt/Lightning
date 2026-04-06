import type {
  AuthProviderMode,
  AuthResult,
  AuthUser,
  ConfirmPasswordResetInput,
  ConfirmSignUpInput,
  RequestPasswordResetInput,
  ResendSignUpCodeInput,
  SignInInput,
  SignUpInput,
} from "@contracts/auth";

export interface AuthClient {
  readonly mode: AuthProviderMode;
  getCurrentUser(): Promise<AuthUser | null>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  confirmSignUp(input: ConfirmSignUpInput): Promise<AuthResult>;
  resendSignUpCode(input: ResendSignUpCodeInput): Promise<AuthResult>;
  requestPasswordReset(input: RequestPasswordResetInput): Promise<AuthResult>;
  confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<AuthResult>;
  signOut(): Promise<void>;
}
