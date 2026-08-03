import styles from "./auth-shell.module.css";
import { AuthForm } from "./auth-form";

interface AuthShellProps {
  mode: "login" | "sign-up" | "reset-password";
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  secondaryLabel: string;
  secondaryHref: string;
}

export function AuthShell(props: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroPanel}>
          <img className={styles.logo} src="/smart-tax-returns.png" alt="Smart Tax Returns" />
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <span>Smart CRM</span>
          </div>
          <AuthForm
            mode={props.mode}
            ctaLabel={props.ctaLabel}
            secondaryLabel={props.secondaryLabel}
            secondaryHref={props.secondaryHref}
          />
        </div>
      </section>
    </main>
  );
}
