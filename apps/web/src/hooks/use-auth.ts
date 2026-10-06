import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { logEvent } from "@/lib/analytics";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";
import { useIsClient } from "usehooks-ts";

const useRedirectParam = () => {
  const params = useSearchParams();
  const isClient = useIsClient();
  if (!isClient) return "/";

  const redirectParam = params.get("r");
  const value =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";

  return value;
};

export const useLoginError = () => {
  const params = useSearchParams();
  const isClient = useIsClient();
  if (!isClient) return null;

  const errorCode = params.get("error") as
    | keyof typeof authClient.$ERROR_CODES
    | null;
  if (!errorCode) return null;

  if (errorCode === "INVALID_TOKEN")
    return "The magic link is invalid or expired. Please try again.";

  return "An error occurred. Please try again.";
};

export const useMagicAuth = () => {
  const redirect = useRedirectParam();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const { mutateAsync: magicLogin, isPending: isSendingMagicLink } =
    useMutation({
      mutationFn: () =>
        authClient.signIn.magicLink({
          email: email.trim(),
          callbackURL: redirect,
          errorCallbackURL: "/login",
        }),
      onSuccess: () => {
        logEvent("auth_magic_link_sent", { email });
        setSent(true);
      },
    });

  const reset = () => {
    setSent(false);
  };

  return {
    email,
    setEmail,
    sent,
    magicLogin,
    isSendingMagicLink,
    reset,
  };
};

export const useGoogleAuth = () => {
  const redirect = useRedirectParam();

  const { mutateAsync: googleLogin, isPending: isLoggingInWithGoogle } =
    useMutation({
      mutationFn: () =>
        authClient.signIn.social({
          provider: "google",
          callbackURL: redirect,
          errorCallbackURL: "/login",
        }),
      onSuccess: () => {
        logEvent("auth_social_login", { provider: "google" });
      },
    });

  return {
    googleLogin,
    isLoggingInWithGoogle,
  };
};

export const useAppleAuth = () => {
  const redirect = useRedirectParam();
  const { mutateAsync: appleLogin, isPending: isLoggingInWithApple } =
    useMutation({
      mutationFn: () =>
        authClient.signIn.social({
          provider: "apple",
          callbackURL: redirect,
          errorCallbackURL: "/login",
        }),
      onSuccess: () => {
        logEvent("auth_social_login", { provider: "apple" });
      },
    });

  return { appleLogin, isLoggingInWithApple };
};

/**
 * Create an account with an email and password.
 *
 * better-auth signs the new user in on success, so this lands on the dashboard
 * the same way a sign-in does. Which organisation they arrive in is decided
 * server-side by the user-create hook, not here.
 */
export const usePasswordSignUp = () => {
  const redirect = useRedirectParam();
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: signUp, isPending: isSigningUp } = useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      password: string;
    }) => {
      setError(null);
      return authClient.signUp.email({
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
        fetchOptions: { throw: true },
      });
    },
    onSuccess: (_, input) => {
      logEvent("auth_password_signup", { email: input.email.trim() });
      window.location.href = redirect;
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  return { signUp, isSigningUp, error, setError };
};

/**
 * Email + password sign-in, for accounts provisioned by an admin rather than
 * self-signed-up. The magic-link and OTP paths both depend on the person being
 * able to receive mail at that address; this one does not.
 */
export const usePasswordAuth = () => {
  const redirect = useRedirectParam();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: passwordLogin, isPending: isSigningIn } = useMutation({
    mutationFn: async (email: string) => {
      setError(null);
      return authClient.signIn.email({
        email: email.trim(),
        password,
        fetchOptions: { throw: true },
      });
    },
    onSuccess: (_, email) => {
      logEvent("auth_password_signin", { email: email.trim() });
      window.location.href = redirect;
    },
    onError: (err) => {
      // better-auth deliberately does not say which of the two was wrong
      setError(err.message);
    },
  });

  const reset = () => {
    setPassword("");
    setError(null);
  };

  return { password, setPassword, passwordLogin, isSigningIn, error, reset };
};

export const useOtpAuth = () => {
  const redirect = useRedirectParam();
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: sendOtpMutation, isPending: isSendingOtp } = useMutation(
    {
      mutationFn: async (email: string) => {
        setError(null);

        return authClient.emailOtp.sendVerificationOtp({
          email: email.trim(),
          type: "sign-in",
          fetchOptions: { throw: true },
        });
      },
      onSuccess: (_, email) => {
        logEvent("auth_otp_sent", { email: email.trim() });
        setOtpSent(true);
      },
      onError: (err) => {
        setError(err.message);
      },
    },
  );

  const { mutateAsync: verifyOtp, isPending: isVerifyingOtp } = useMutation({
    mutationFn: async (email: string) => {
      setError(null);
      return authClient.signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
        fetchOptions: { throw: true },
      });
    },
    onSuccess: (_, email) => {
      logEvent("auth_otp_verified", { email: email.trim() });
      window.location.href = redirect;
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const reset = () => {
    setOtpSent(false);
    setOtp("");
    setError(null);
  };

  return {
    otp,
    setOtp,
    otpSent,
    error,
    sendOtp: sendOtpMutation,
    isSendingOtp,
    verifyOtp,
    isVerifyingOtp,
    reset,
  };
};
