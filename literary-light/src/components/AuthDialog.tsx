import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { PASSWORD_POLICY_HINT } from "@/api/auth/passwordPolicy";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "signin" | "signup" | "confirm";

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmationTarget, setConfirmationTarget] = useState("");
  const [confirmationDestination, setConfirmationDestination] = useState<string | null>(null);
  const [pendingSignInIdentifier, setPendingSignInIdentifier] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, confirmSignUp, resendSignUpCode } = useAuth();
  const { toast } = useToast();

  const resetForm = () => {
    setMode("signin");
    setIdentifier("");
    setPassword("");
    setName("");
    setConfirmationCode("");
    setConfirmationTarget("");
    setConfirmationDestination(null);
    setPendingSignInIdentifier("");
    setPendingPassword("");
    setIsLoading(false);
  };

  const handleOpenStateChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const moveToConfirmation = ({
    signInIdentifier,
    passwordValue,
    confirmationIdentifier,
    destination,
  }: {
    signInIdentifier: string;
    passwordValue: string;
    confirmationIdentifier: string;
    destination?: string | null;
  }) => {
    setMode("confirm");
    setConfirmationCode("");
    setConfirmationTarget(confirmationIdentifier);
    setConfirmationDestination(destination ?? null);
    setPendingSignInIdentifier(signInIdentifier);
    setPendingPassword(passwordValue);
    setIdentifier(signInIdentifier);
  };

  const handleSignInOrSignUp = async () => {
    const trimmedIdentifier = identifier.trim();
    const trimmedName = name.trim();

    const result =
      mode === "signin"
        ? await signIn(trimmedIdentifier, password)
        : await signUp(trimmedIdentifier, password, trimmedName);

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Something went wrong",
        variant: "destructive",
      });
      return;
    }

    if (result.nextStep === "CONFIRM_SIGN_UP") {
      moveToConfirmation({
        signInIdentifier: trimmedIdentifier,
        passwordValue: password,
        confirmationIdentifier: result.username ?? trimmedIdentifier,
        destination: result.codeDeliveryDestination ?? trimmedIdentifier,
      });

      toast({
        title: "Check your email",
        description:
          mode === "signin"
            ? "This account needs to be verified before it can sign in."
            : `Enter the 6-digit code we sent to ${result.codeDeliveryDestination ?? trimmedIdentifier}.`,
      });
      return;
    }

    toast({
      title: mode === "signin" ? "Welcome back!" : "Account created!",
      description:
        mode === "signin"
          ? "You have successfully signed in."
          : "Your account has been created and you're now signed in.",
    });
    handleOpenStateChange(false);
  };

  const handleConfirm = async () => {
    const result = await confirmSignUp(confirmationTarget, confirmationCode.trim());

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Something went wrong",
        variant: "destructive",
      });
      return;
    }

    if (pendingSignInIdentifier && pendingPassword) {
      const autoSignInResult = await signIn(pendingSignInIdentifier, pendingPassword);

      if (autoSignInResult.success && autoSignInResult.nextStep !== "CONFIRM_SIGN_UP") {
        toast({
          title: "Account verified",
          description: "Your account has been confirmed and you're now signed in.",
        });
        handleOpenStateChange(false);
        return;
      }
    }

    toast({
      title: "Account verified",
      description: "Your email has been confirmed. Please sign in to continue.",
    });
    setMode("signin");
    setConfirmationCode("");
    setConfirmationTarget("");
    setConfirmationDestination(null);
    setPassword("");
    setPendingPassword("");
  };

  const handleResendCode = async () => {
    const result = await resendSignUpCode(confirmationTarget);

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Unable to resend the verification code.",
        variant: "destructive",
      });
      return;
    }

    if (result.codeDeliveryDestination) {
      setConfirmationDestination(result.codeDeliveryDestination);
    }

    toast({
      title: "Code resent",
      description: `We sent a new 6-digit code to ${
        result.codeDeliveryDestination ?? confirmationDestination ?? identifier
      }.`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "confirm") {
        await handleConfirm();
      } else {
        await handleSignInOrSignUp();
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setIdentifier("");
    setPassword("");
    setName("");
    setConfirmationCode("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenStateChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {mode === "signin"
              ? "Sign In"
              : mode === "signup"
                ? "Sign Up"
                : "Verify Your Email"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to your account to add comments"
              : mode === "signup"
                ? "Create a new account to join the conversation"
                : `Enter the 6-digit code we sent to ${
                    confirmationDestination ?? identifier
                  }.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required={mode === "signup"}
                disabled={isLoading}
              />
            </div>
          )}
          {mode === "confirm" ? (
            <div className="space-y-2">
              <Label htmlFor="confirmation-code">Verification Code</Label>
              <Input
                id="confirmation-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="123456"
                required
                disabled={isLoading}
                minLength={6}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit email verification code from Cognito.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="identifier">
                  {mode === "signin" ? "Email or Username" : "Email"}
                </Label>
                <Input
                  id="identifier"
                  type={mode === "signin" ? "text" : "email"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={mode === "signin" ? "your@email.com or lc_..." : "your@email.com"}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
                )}
              </div>
            </>
          )}
          <Button type="submit" className="w-full btn-primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "signin"
                  ? "Signing in..."
                  : mode === "signup"
                    ? "Creating account..."
                    : "Verifying..."}
              </>
            ) : mode === "signin" ? (
              "Sign In"
            ) : mode === "signup" ? (
              "Sign Up"
            ) : (
              "Verify Email"
            )}
          </Button>
          {mode === "confirm" ? (
            <div className="space-y-2 text-center">
              <button
                type="button"
                onClick={handleResendCode}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setConfirmationCode("");
                  setConfirmationTarget("");
                  setConfirmationDestination(null);
                  setPassword("");
                  setPendingPassword("");
                }}
                className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                {mode === "signin"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
