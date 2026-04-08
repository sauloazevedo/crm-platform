import { AuthGuard } from "../../../components/auth/auth-guard";
import { BoardShell } from "../../../components/board-shell";

export default function TasksPage() {
  return (
    <AuthGuard>
      <BoardShell />
    </AuthGuard>
  );
}
