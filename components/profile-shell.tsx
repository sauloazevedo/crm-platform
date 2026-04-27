"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getWorkspaceAccessUsers,
  inviteWorkspaceUser,
  removeWorkspaceAccessUser,
  updateCurrentUserProfile,
  type WorkspaceAccessUser,
} from "../lib/crm-api";
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNotice, setInviteNotice] = useState<Notice | null>(null);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceAccessUser[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isInvitingUser, setIsInvitingUser] = useState(false);
  const [isLoadingWorkspaceUsers, setIsLoadingWorkspaceUsers] = useState(true);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(auth.user?.firstName ?? "");
    setLastName(auth.user?.lastName ?? "");
  }, [auth.user?.firstName, auth.user?.lastName]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceUsers() {
      setIsLoadingWorkspaceUsers(true);

      try {
        const response = await getWorkspaceAccessUsers();

        if (isMounted) {
          setWorkspaceUsers(response.users);
        }
      } catch (error) {
        console.warn("[ProfileShell] workspace users load failed:", error);

        if (isMounted) {
          setInviteNotice({ tone: "error", message: "We could not load workspace access right now." });
        }
      } finally {
        if (isMounted) {
          setIsLoadingWorkspaceUsers(false);
        }
      }
    }

    void loadWorkspaceUsers();

    return () => {
      isMounted = false;
    };
  }, [auth.user?.workspaceId]);

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

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = inviteEmail.trim().toLowerCase();
    setInviteEmail(email);
    setInviteNotice(null);

    if (!email) {
      setInviteNotice({ tone: "error", message: "Invite email is required." });
      return;
    }

    setIsInvitingUser(true);

    try {
      await inviteWorkspaceUser({ email });
      setInviteEmail("");
      const response = await getWorkspaceAccessUsers();
      setWorkspaceUsers(response.users);
      setInviteNotice({
        tone: "success",
        message: `Invitation sent to ${email}. The user will receive a temporary password by email.`,
      });
    } catch (error) {
      console.warn("[ProfileShell] invite user failed:", error);
      setInviteNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not invite this user right now.",
      });
    } finally {
      setIsInvitingUser(false);
    }
  }

  async function handleRemoveWorkspaceUser(userId: string) {
    setInviteNotice(null);
    setRemovingUserId(userId);

    try {
      await removeWorkspaceAccessUser(userId);
      setWorkspaceUsers((current) => current.filter((user) => user.id !== userId));
      setInviteNotice({ tone: "success", message: "Workspace access removed successfully." });
    } catch (error) {
      console.warn("[ProfileShell] remove workspace user failed:", error);
      setInviteNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not remove this workspace user right now.",
      });
    } finally {
      setRemovingUserId(null);
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

          <form className={styles.card} onSubmit={handleInviteSubmit}>
            <div>
              <p className={styles.cardEyebrow}>Workspace access</p>
              <h2>Invite a team member</h2>
              <p className={styles.cardCopy}>
                Invite another user into this same dashboard. They will receive a temporary password and must create
                a new password on first login.
              </p>
            </div>

            <label className={styles.field}>
              <span>Invite email</span>
              <input
                type="email"
                value={inviteEmail}
                onBlur={() => setInviteEmail(inviteEmail.trim().toLowerCase())}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="team@office.com"
              />
            </label>

            {inviteNotice ? (
              <p className={inviteNotice.tone === "success" ? styles.successNotice : styles.errorNotice}>
                {inviteNotice.message}
              </p>
            ) : null}

            <button className={styles.primaryButton} type="submit" disabled={isInvitingUser}>
              {isInvitingUser ? "Sending invite..." : "Invite user"}
            </button>
          </form>

          <section className={styles.card}>
            <div>
              <p className={styles.cardEyebrow}>Workspace access</p>
              <h2>Workspace members</h2>
              <p className={styles.cardCopy}>
                Review invited and active users in this dashboard, and remove access when needed.
              </p>
            </div>

            <div className={styles.workspaceUserList}>
              {isLoadingWorkspaceUsers ? <p className={styles.cardCopy}>Loading workspace users...</p> : null}

              {!isLoadingWorkspaceUsers && workspaceUsers.length === 0 ? (
                <p className={styles.cardCopy}>No invited users in this workspace yet.</p>
              ) : null}

              {workspaceUsers
                .slice()
                .sort((left, right) => Number(right.isCurrentUser) - Number(left.isCurrentUser))
                .map((workspaceUser) => (
                <article key={workspaceUser.id} className={styles.workspaceUserCard}>
                  <div>
                    <strong>
                      {[workspaceUser.firstName, workspaceUser.lastName].filter(Boolean).join(" ") || workspaceUser.email}
                    </strong>
                    <span>{workspaceUser.email}</span>
                  </div>

                  <div className={styles.workspaceUserMeta}>
                    <small className={styles.workspaceUserStatus}>{workspaceUser.invitationStatus}</small>
                    <small>{workspaceUser.role}</small>
                    {workspaceUser.isCurrentUser ? <small>You</small> : null}
                    {!workspaceUser.isCurrentUser && workspaceUser.role !== "owner" ? (
                      <button
                        type="button"
                        className={styles.removeWorkspaceUserButton}
                        onClick={() => void handleRemoveWorkspaceUser(workspaceUser.id)}
                        disabled={removingUserId === workspaceUser.id}
                        aria-label={`Remove ${workspaceUser.email} from workspace`}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
