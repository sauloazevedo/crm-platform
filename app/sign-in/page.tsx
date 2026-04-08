import { AuthShell } from "../../components/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      mode="sign-up"
      eyebrow="New Office Setup"
      title="Create access for your tax prep team."
      description="Start your office workspace, invite staff, and centralize client onboarding, tax workflow, and document collection."
      ctaLabel="Create account"
      secondaryLabel="Already have access? Log in"
      secondaryHref="/login"
    />
  );
}
