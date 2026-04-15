import { AuthGuard } from "../../components/auth/auth-guard";
import { ProfileShell } from "../../components/profile-shell";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileShell />
    </AuthGuard>
  );
}
