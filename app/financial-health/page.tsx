import { AuthGuard } from "../../components/auth/auth-guard";
import { FinancialHealthShell } from "../../components/financial-health-shell";

export default function FinancialHealthPage() {
  return (
    <AuthGuard>
      <FinancialHealthShell />
    </AuthGuard>
  );
}
