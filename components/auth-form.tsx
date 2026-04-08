"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  confirmResetPassword,
  resetPassword,
  signIn,
  signUp,
} from "aws-amplify/auth";
import styles from "./auth-shell.module.css";
import { useAuth } from "../contexts/auth-context";

type AuthMode = "login" | "sign-up" | "reset-password";

type AuthFormProps = {
  mode: AuthMode;
  ctaLabel: string;
  secondaryLabel: string;
  secondaryHref: string;
};

function getFriendlyError(error: unknown): string {
  if (typeof error === "object" && error && "name" in error) {
    const authError = error as { name?: string; message?: string };

    switch (authError.name) {
      case "UserAlreadyAuthenticatedException":
        return "This user is already authenticated.";
      case "UserNotConfirmedException":
        return "This account is not confirmed yet. Check your email for the verification code.";
      case "NotAuthorizedException":
        return "Invalid credentials. Review your email and password.";
      case "UserNotFoundException":
        return "No account was found with this email.";
      case "CodeMismatchException":
        return "The verification code is invalid. Try again.";
      case "ExpiredCodeException":
        return "This verification code expired. Request a new one.";
      case "InvalidPasswordException":
        return "Your password does not meet the security requirements.";
      case "UsernameExistsException":
        return "An account with this email already exists.";
      default:
        break;
    }

    if (authError.message) {
      return authError.message;
    }
  }

  return "Something went wrong. Please try again.";
}

export function AuthForm(props: AuthFormProps) {
  const router = useRouter();
  const auth = useAuth();
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const helperMessage = useMemo(() => {
    if (auth.isConfigured) {
      return null;
    }

    return "Configure NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID to enable authentication.";
  }, [auth.isConfigured]);

  function clearFeedback() {
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleSubmit() {
    clearFeedback();

    if (!auth.isConfigured) {
      setErrorMessage(
        "Amplify is not configured yet. Add the Cognito environment variables before testing auth."
      );
      return;
    }

    startTransition(async () => {
      try {
        if (props.mode === "login") {
          await signIn({
            username: email.trim(),
            password,
          });

          await auth.refreshSession();
          router.push("/dashboard");
          router.refresh();
          return;
        }

        if (props.mode === "sign-up") {
          if (!firstName.trim() || !lastName.trim()) {
            setErrorMessage("First name and last name are required.");
            return;
          }

          if (password !== confirmPassword) {
            setErrorMessage("Passwords do not match.");
            return;
          }

          await signUp({
            username: email.trim(),
            password,
            options: {
              userAttributes: {
                email: email.trim(),
                given_name: firstName.trim(),
                family_name: lastName.trim(),
              },
            },
          });

          setSuccessMessage("Account created. You can log in now.");
          router.push("/login");
          return;
        }

        if (!isConfirmStep) {
          await resetPassword({
            username: email.trim(),
          });

          setIsConfirmStep(true);
          setSuccessMessage("Verification code sent. Enter the code and your new password.");
          return;
        }

        if (password !== confirmPassword) {
          setErrorMessage("Passwords do not match.");
          return;
        }

        await confirmResetPassword({
          username: email.trim(),
          confirmationCode: verificationCode.trim(),
          newPassword: password,
        });

        setSuccessMessage("Password updated. You can log in now.");
        router.push("/login");
      } catch (error) {
        setErrorMessage(getFriendlyError(error));
      }
    });
  }

  return (
    <>
      {isMounted && !auth.isConfigured ? <p className={styles.notice}>{helperMessage}</p> : null}

      {props.mode === "sign-up" ? (
        <>
          <label className={styles.field}>
            <span>First name</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </label>

          <label className={styles.field}>
            <span>Last name</span>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
        </>
      ) : null}

      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          placeholder="office@smarttax.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      {props.mode === "reset-password" && isConfirmStep ? (
        <label className={styles.field}>
          <span>Verification code</span>
          <input
            type="text"
            placeholder="Enter the code from your email"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
          />
        </label>
      ) : null}

      {props.mode !== "reset-password" || isConfirmStep ? (
        <>
          <label className={styles.field}>
            <span>{props.mode === "reset-password" ? "New password" : "Password"}</span>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {props.mode !== "login" ? (
            <label className={styles.field}>
              <span>Confirm password</span>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          ) : null}
        </>
      ) : null}

      {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
      {successMessage ? <p className={styles.successMessage}>{successMessage}</p> : null}

      <button
        className={styles.primaryButton}
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
      >
        {isPending ? "Working..." : props.ctaLabel}
      </button>

      <div className={styles.linksRow}>
        <Link href={props.secondaryHref}>{props.secondaryLabel}</Link>
        {props.mode === "login" ? <Link href="/reset-password">Forgot password?</Link> : null}
        {props.mode !== "login" ? <Link href="/login">Back to login</Link> : null}
      </div>
    </>
  );
}
