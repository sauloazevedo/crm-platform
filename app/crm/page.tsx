import { AuthGuard } from "../../components/auth/auth-guard";
import { CrmShell } from "../../components/crm-shell";

export default function CrmPage() {
  // task page
  return (
    <AuthGuard>
      <CrmShell />
    </AuthGuard>
  );
}
