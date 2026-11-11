import { AuthGuard } from "../../../components/auth/auth-guard";
import { WhatsAppInboxShell } from "../../../components/whatsapp-inbox-shell";

export default function WhatsAppInboxPage() {
  return (
    <AuthGuard>
      <WhatsAppInboxShell />
    </AuthGuard>
  );
}
