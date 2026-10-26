import { AuthGuard } from "../../components/auth/auth-guard";
import { BlogShell } from "../../components/blog-shell";

export default function BlogPage() {
  return (
    <AuthGuard>
      <BlogShell />
    </AuthGuard>
  );
}
