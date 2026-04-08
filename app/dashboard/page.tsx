import { AuthGuard } from "../../components/auth/auth-guard";
import { DashboardShell } from "../../components/dashboard-shell";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardShell />
    </AuthGuard>
  );
}
