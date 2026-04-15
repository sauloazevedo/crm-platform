import { AuthGuard } from "../../components/auth/auth-guard";
import { LeadsShell } from "../../components/leads-shell";

export default function LeadsPage() {
  return (
    <AuthGuard>
      <LeadsShell />
    </AuthGuard>
  );
}
