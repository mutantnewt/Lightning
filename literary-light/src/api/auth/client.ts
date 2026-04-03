import type {
  AuthProviderMode,
  AuthResult,
  AuthUser,
  ConfirmSignUpInput,
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
  signOut(): Promise<void>;
}
