import { AuthGuard } from "../../components/auth/auth-guard";
import { CrmShell } from "../../components/crm-shell";

export default function CrmPage() {
  return (
    <AuthGuard>
      <CrmShell />
    </AuthGuard>
  );
}
