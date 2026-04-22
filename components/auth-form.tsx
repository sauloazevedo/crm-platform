"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import styles from "./auth-shell.module.css";
import { useAuth } from "../contexts/AuthContext";
import { handleConfirmResetPassword, handleConfirmSignInWithNewPassword, handleConfirmSignUp } from "../services/auth";

type AuthMode = "login" | "sign-up" | "reset-password";

type AuthFormProps = {
  mode: AuthMode;
  ctaLabel: string;
  secondaryLabel: string;
  secondaryHref: string;
};

const passwordRules = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "At least 1 uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "At least 1 lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: "At least 1 number",
    test: (value: string) => /\d/.test(value),
  },
];

function isPasswordValid(password: string) {
  return passwordRules.every((rule) => rule.test(password));
}

function PasswordRules({ password }: { password: string }) {
  return (
    <div className={styles.passwordRules}>
      <h3>Password requirements</h3>
      {passwordRules.map((rule) => {
        const isValid = rule.test(password);

        return (
          <p key={rule.label} className={isValid ? styles.passwordRuleValid : styles.passwordRuleInvalid}>
            {isValid ? <Check size={15} /> : <X size={15} />}
            <span>{rule.label}</span>
          </p>
        );
      })}
    </div>
  );
}

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
        return "This email already belongs to a dashboard. Log in or ask the dashboard owner for access.";
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [isNewPasswordStep, setIsNewPasswordStep] = useState(false);
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

  function trimTextInputs() {
    setEmail((value) => value.trim());
    setFirstName((value) => value.trim());
    setLastName((value) => value.trim());
    setVerificationCode((value) => value.trim());
  }

  function handleSubmit() {
    clearFeedback();
    trimTextInputs();

    if (!auth.isConfigured) {
      setErrorMessage(
        "Amplify is not configured yet. Add the Cognito environment variables before testing auth."
      );
      return;
    }

    startTransition(async () => {
      try {
        const cleanedEmail = email.trim();
        const cleanedFirstName = firstName.trim();
        const cleanedLastName = lastName.trim();
        const cleanedVerificationCode = verificationCode.trim();

        if (props.mode === "login") {
          if (isNewPasswordStep) {
            if (!isPasswordValid(password)) {
              setErrorMessage("Password requirements are not complete yet.");
              return;
            }

            await handleConfirmSignInWithNewPassword(password);
            await auth.checkUser();
            router.push("/dashboard");
            router.refresh();
            return;
          }

          const result = await auth.signIn(cleanedEmail, password);

          if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
            setIsNewPasswordStep(true);
            setPassword("");
            setSuccessMessage("Create your new password to finish joining this dashboard.");
            return;
          }

          router.push("/dashboard");
          router.refresh();
          return;
        }

        if (props.mode === "sign-up") {
          if (isConfirmStep) {
            if (!cleanedVerificationCode) {
              setErrorMessage("Confirmation code is required.");
              return;
            }

            await handleConfirmSignUp(cleanedEmail, cleanedVerificationCode);
            setSuccessMessage("Account confirmed. You can log in now.");
            router.push("/login");
            return;
          }

          if (!cleanedFirstName || !cleanedLastName) {
            setErrorMessage("First name and last name are required.");
            return;
          }

          if (!isPasswordValid(password)) {
            setErrorMessage("Password requirements are not complete yet.");
            return;
          }

          const result = await auth.signUp(cleanedEmail, password, cleanedFirstName, cleanedLastName);

          if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
            setIsConfirmStep(true);
            setSuccessMessage(`We sent a confirmation code to ${cleanedEmail}.`);
            return;
          }

          setSuccessMessage("Account created. You can log in now.");
          router.push("/login");
          return;
        }

        if (!isConfirmStep) {
          await auth.resetPassword(cleanedEmail);

          setIsConfirmStep(true);
          setSuccessMessage("Verification code sent. Enter the code and your new password.");
          return;
        }

        if (!isPasswordValid(password)) {
          setErrorMessage("Password requirements are not complete yet.");
          return;
        }

        if (!cleanedVerificationCode) {
          setErrorMessage("Verification code is required.");
          return;
        }

        await handleConfirmResetPassword(cleanedEmail, cleanedVerificationCode, password);

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

      {props.mode === "sign-up" && !isConfirmStep ? (
        <>
          <label className={styles.field}>
            <span>First name</span>
            <input
              value={firstName}
              onBlur={() => setFirstName((value) => value.trim())}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Last name</span>
            <input
              value={lastName}
              onBlur={() => setLastName((value) => value.trim())}
              onChange={(event) => setLastName(event.target.value)}
            />
          </label>
        </>
      ) : null}

      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          placeholder="office@smarttax.com"
          value={email}
          onBlur={() => setEmail((value) => value.trim())}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      {isConfirmStep ? (
        <label className={styles.field}>
          <span>{props.mode === "sign-up" ? "Confirmation code" : "Verification code"}</span>
          <input
            type="text"
            placeholder="Enter the code from your email"
            value={verificationCode}
            onBlur={() => setVerificationCode((value) => value.trim())}
            onChange={(event) => setVerificationCode(event.target.value)}
          />
        </label>
      ) : null}

      {(props.mode === "login" || (props.mode === "sign-up" && !isConfirmStep) || (props.mode === "reset-password" && isConfirmStep)) ? (
        <>
          <label className={styles.field}>
            <span>{props.mode === "reset-password" || isNewPasswordStep ? "New password" : "Password"}</span>
            <div className={styles.passwordInputWrap}>
              <input
                type={isPasswordVisible ? "text" : "password"}
                placeholder={isNewPasswordStep ? "Create your new password" : "Enter your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className={styles.passwordVisibilityButton}
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              >
                {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {props.mode !== "login" || isNewPasswordStep ? <PasswordRules password={password} /> : null}
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
        {isPending
          ? "Working..."
          : isNewPasswordStep
            ? "Save new password"
          : props.mode === "sign-up" && isConfirmStep
            ? "Confirm account"
            : props.mode === "reset-password" && isConfirmStep
              ? "Reset password"
              : props.ctaLabel}
      </button>

      <div className={styles.linksRow}>
        <Link href={props.secondaryHref}>{props.secondaryLabel}</Link>
        {props.mode === "login" ? <Link href="/reset-password">Forgot password?</Link> : null}
        {props.mode !== "login" ? <Link href="/login">Back to login</Link> : null}
      </div>
    </>
  );
}
