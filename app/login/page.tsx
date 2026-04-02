import { AuthShell } from "../../components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Tax Office Workspace"
      title="Log in to your tax operations hub."
      description="Access your preparer dashboard, client workflow, document requests, and office tools from a single platform."
      ctaLabel="Log in"
      ctaHref="/dashboard"
      secondaryLabel="Need an account? Sign in"
      secondaryHref="/sign-in"
    />
  );
}
