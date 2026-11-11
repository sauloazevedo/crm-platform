import { AuthGuard } from "../../components/auth/auth-guard";
import { AtendimentoShell } from "../../components/atendimento-shell";

export default function AtendimentoPage() {
  return (
    <AuthGuard>
      <AtendimentoShell />
    </AuthGuard>
  );
}
