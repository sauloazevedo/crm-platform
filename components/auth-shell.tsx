import Link from "next/link";
import styles from "./auth-shell.module.css";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}

export function AuthShell(props: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroPanel}>
          <p className={styles.eyebrow}>{props.eyebrow}</p>
          <h1>{props.title}</h1>
          <p className={styles.description}>{props.description}</p>

          <div className={styles.highlightCard}>
            <span>Season Control</span>
            <strong>Monitor clients, missing docs, payment status, and return workflow in one place.</strong>
          </div>

          <div className={styles.quickStats}>
            <article>
              <strong>184</strong>
              <span>Returns in progress</span>
            </article>
            <article>
              <strong>29</strong>
              <span>Clients waiting on documents</span>
            </article>
            <article>
              <strong>12</strong>
              <span>High-priority follow-ups</span>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <span>Smart CRM</span>
            <Link href="/dashboard">Preview dashboard</Link>
          </div>

          <label className={styles.field}>
            <span>Email</span>
            <input type="email" placeholder="office@smarttax.com" />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input type="password" placeholder="Enter your password" />
          </label>

          <button className={styles.primaryButton} type="button">
            {props.ctaLabel}
          </button>

          <div className={styles.linksRow}>
            <Link href={props.secondaryHref}>{props.secondaryLabel}</Link>
            <Link href={props.ctaHref}>Continue to dashboard</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
