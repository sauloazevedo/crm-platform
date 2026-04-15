"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { updateCurrentUserProfile } from "../lib/crm-api";
import { handleConfirmResetPassword, handleResetPassword } from "../services/auth";
import { ThemeToggle } from "./theme-toggle";
import styles from "./profile-shell.module.css";

type Notice = {
  tone: "success" | "error";
  message: string;
};

const passwordRules = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
];

function isPasswordValid(value: string) {
  return passwordRules.every((rule) => rule.test(value));
}

export function ProfileShell() {
  const auth = useAuth();
  const [firstName, setFirstName] = useState(auth.user?.firstName ?? "");
  const [lastName, setLastName] = useState(auth.user?.lastName ?? "");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [hasRequestedPasswordCode, setHasRequestedPasswordCode] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setFirstName(auth.user?.firstName ?? "");
    setLastName(auth.user?.lastName ?? "");
  }, [auth.user?.firstName, auth.user?.lastName]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    setFirstName(trimmedFirstName);
    setLastName(trimmedLastName);
    setProfileNotice(null);

    if (!trimmedFirstName || !trimmedLastName) {
      setProfileNotice({ tone: "error", message: "Name and surname are required." });
      return;
    }

    setIsSavingProfile(true);

    try {
      await updateCurrentUserProfile({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      });
      await auth.refreshSession();
      setProfileNotice({ tone: "success", message: "Profile updated successfully." });
    } catch (error) {
      console.warn("[ProfileShell] profile update failed:", error);
      setProfileNotice({ tone: "error", message: "We could not update your profile right now." });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordCodeRequest() {
    const email = auth.user?.email?.trim();
    setPasswordNotice(null);

    if (!email) {
      setPasswordNotice({ tone: "error", message: "We could not find the email for this account." });
      return;
    }

    setIsSavingPassword(true);

    try {
      await handleResetPassword(email);
      setHasRequestedPasswordCode(true);
      setPasswordNotice({ tone: "success", message: "We sent a reset code to your email." });
    } catch (error) {
      console.warn("[ProfileShell] password code request failed:", error);
      setPasswordNotice({ tone: "error", message: "We could not send the reset code right now." });
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = auth.user?.email?.trim();
    const trimmedResetCode = resetCode.trim();

    setResetCode(trimmedResetCode);
    setPasswordNotice(null);

    if (!email) {
      setPasswordNotice({ tone: "error", message: "We could not find the email for this account." });
      return;
    }

    if (!trimmedResetCode || !newPassword) {
      setPasswordNotice({ tone: "error", message: "Reset code and new password are required." });
      return;
    }

    if (!isPasswordValid(newPassword)) {
      setPasswordNotice({ tone: "error", message: "Your new password does not meet the rules yet." });
      return;
    }

    setIsSavingPassword(true);

    try {
      await handleConfirmResetPassword(email, trimmedResetCode, newPassword);
      setResetCode("");
      setNewPassword("");
      setHasRequestedPasswordCode(false);
      setPasswordNotice({ tone: "success", message: "Password reset successfully. Please log in with the new password." });
      await auth.signOut();
    } catch (error) {
      console.warn("[ProfileShell] password update failed:", error);
      setPasswordNotice({ tone: "error", message: "We could not reset your password. Check the code and try again." });
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Account settings</p>
            <h1>Profile</h1>
            <p>Manage your account basics. We will add more profile tools here soon.</p>
          </div>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <Link href="/dashboard" className={styles.backLink}>
              Back to dashboard
            </Link>
          </div>
        </header>

        <div className={styles.grid}>
          <form className={styles.card} onSubmit={handleProfileSubmit}>
            <div>
              <p className={styles.cardEyebrow}>Identity</p>
              <h2>Name details</h2>
            </div>

            <label className={styles.field}>
              <span>Name</span>
              <input
                value={firstName}
                onBlur={() => setFirstName(firstName.trim())}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Your name"
              />
            </label>

            <label className={styles.field}>
              <span>Surname</span>
              <input
                value={lastName}
                onBlur={() => setLastName(lastName.trim())}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Your surname"
              />
            </label>

            {profileNotice ? (
              <p className={profileNotice.tone === "success" ? styles.successNotice : styles.errorNotice}>
                {profileNotice.message}
              </p>
            ) : null}

            <button className={styles.primaryButton} type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save profile"}
            </button>
          </form>

          <form className={styles.card} onSubmit={handlePasswordSubmit}>
            <div>
              <p className={styles.cardEyebrow}>Security</p>
              <h2>Reset password</h2>
              <p className={styles.cardCopy}>
                Send a verification code to {auth.user?.email ?? "your email"} before choosing a new password.
              </p>
            </div>

            {!hasRequestedPasswordCode ? (
              <button
                className={styles.primaryButton}
                type="button"
                disabled={isSavingPassword}
                onClick={handlePasswordCodeRequest}
              >
                {isSavingPassword ? "Sending code..." : "Send reset code"}
              </button>
            ) : (
              <>
                <label className={styles.field}>
                  <span>Verification code</span>
                  <input
                    value={resetCode}
                    onBlur={() => setResetCode(resetCode.trim())}
                    onChange={(event) => setResetCode(event.target.value)}
                    placeholder="Code from email"
                  />
                </label>

                <label className={styles.field}>
                  <span>New password</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="New password"
                    />
                    <button
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      className={styles.iconButton}
                      type="button"
                      onClick={() => setShowNewPassword((value) => !value)}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <div className={styles.passwordRules}>
                  {passwordRules.map((rule) => {
                    const isValid = rule.test(newPassword);

                    return (
                      <p key={rule.label} className={isValid ? styles.ruleValid : styles.ruleMuted}>
                        <span>{isValid ? "✓" : "•"}</span>
                        {rule.label}
                      </p>
                    );
                  })}
                </div>

                <div className={styles.buttonRow}>
                  <button className={styles.primaryButton} type="submit" disabled={isSavingPassword}>
                    {isSavingPassword ? "Resetting..." : "Reset password"}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={isSavingPassword}
                    onClick={handlePasswordCodeRequest}
                  >
                    Resend code
                  </button>
                </div>
              </>
            )}

            {passwordNotice ? (
              <p className={passwordNotice.tone === "success" ? styles.successNotice : styles.errorNotice}>
                {passwordNotice.message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
