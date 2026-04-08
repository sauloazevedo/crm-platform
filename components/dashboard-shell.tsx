"use client";

import Link from "next/link";
import styles from "./dashboard-shell.module.css";
import { LogoutButton } from "./auth/logout-button";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "../contexts/auth-context";

const tools = [
  {
    name: "CRM",
    href: "/crm",
    description: "Manage leads, clients, workflows, and document follow-up.",
    status: "Core module",
  },
  {
    name: "Tax Calendar",
    href: "/dashboard",
    description: "Track deadlines, appointments, and filing season milestones.",
    status: "Coming soon",
  },
  {
    name: "Client Messaging",
    href: "/dashboard",
    description: "Centralize reminders, outreach, and communication history.",
    status: "Coming soon",
  },
  {
    name: "Reports",
    href: "/dashboard",
    description: "Review office performance, payment status, and bottlenecks.",
    status: "Coming soon",
  },
];

export function DashboardShell() {
  const auth = useAuth();
  const displayName =
    auth.user?.firstName ??
    auth.user?.email ??
    "Office user";

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div>
          <p className={styles.brandEyebrow}>Smart CRM</p>
          <h1>Dashboard</h1>
          <p className={styles.sidebarCopy}>
            Operational control for tax preparers, staff, and office managers.
          </p>
        </div>

        <nav className={styles.nav}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/crm">CRM</Link>
          <LogoutButton className={styles.logoutButton} />
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.headerEyebrow}>Today&apos;s pulse</p>
            <h2>Tools</h2>
            <p className={styles.userLine}>Signed in as {displayName}</p>
          </div>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <div className={styles.statusBadge}>Peak Season Mode</div>
          </div>
        </header>

        <section className={styles.metrics}>
          <article>
            <span>Open leads</span>
            <strong>46</strong>
          </article>
          <article>
            <span>Ready to file</span>
            <strong>17</strong>
          </article>
          <article>
            <span>Missing documents</span>
            <strong>29</strong>
          </article>
        </section>

        <section className={styles.toolsGrid}>
          {tools.map((tool) => (
            <Link key={tool.name} href={tool.href} className={styles.toolCard}>
              <div className={styles.toolTop}>
                <h3>{tool.name}</h3>
                <span>{tool.status}</span>
              </div>
              <p>{tool.description}</p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
