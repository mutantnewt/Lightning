import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import type {
  AuthProviderMode,
  AuthResult,
  AuthUser,
  ConfirmSignUpInput,
  ResendSignUpCodeInput,
} from "@contracts/auth";
import { createAuthClient, type AuthClient } from "@/api/auth";
import { isCatalogModerator } from "@/config/runtime";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isModerator: boolean;
  providerMode: AuthProviderMode;
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  confirmSignUp: (
    identifier: ConfirmSignUpInput["identifier"],
    confirmationCode: ConfirmSignUpInput["confirmationCode"]
  ) => Promise<AuthResult>;
  resendSignUpCode: (
    identifier: ResendSignUpCodeInput["identifier"]
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export type User = AuthUser;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authClient] = useState<AuthClient>(() => createAuthClient());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    authClient
      .getCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
        }
      })
      .catch((error) => {
        console.error("Error loading auth state:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [authClient]);

  const signIn = async (identifier: string, password: string): Promise<AuthResult> => {
    const result = await authClient.signIn({ identifier, password });

    if (result.success && result.nextStep !== "CONFIRM_SIGN_UP") {
      setUser(result.user ?? (await authClient.getCurrentUser()));
    }

    return result;
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<AuthResult> => {
    const result = await authClient.signUp({ email, password, name });

    if (result.success && result.nextStep !== "CONFIRM_SIGN_UP") {
      setUser(result.user ?? (await authClient.getCurrentUser()));
    }

    return result;
  };

  const confirmSignUp = async (
    identifier: ConfirmSignUpInput["identifier"],
    confirmationCode: ConfirmSignUpInput["confirmationCode"]
  ): Promise<AuthResult> => {
    const result = await authClient.confirmSignUp({ identifier, confirmationCode });

    if (result.success && result.user) {
      setUser(result.user);
    }

    return result;
  };

  const resendSignUpCode = async (
    identifier: ResendSignUpCodeInput["identifier"]
  ): Promise<AuthResult> => {
    return authClient.resendSignUpCode({ identifier });
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isModerator: isCatalogModerator(user?.groups),
        providerMode: authClient.mode,
        signIn,
        signUp,
        confirmSignUp,
        resendSignUpCode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
