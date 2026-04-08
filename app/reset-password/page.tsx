import { AuthShell } from "../../components/auth-shell";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      mode="reset-password"
      eyebrow="Password Recovery"
      title="Reset access without leaving tax season behind."
      description="Request a verification code, choose a new password, and return to your workspace with the same office context."
      ctaLabel="Send recovery code"
      secondaryLabel="Need an account? Sign in"
      secondaryHref="/sign-in"
    />
  );
}
