import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "min(100%, 560px)",
          padding: "32px",
          borderRadius: "28px",
          background: "rgba(12, 22, 19, 0.86)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 28px 90px rgba(0, 0, 0, 0.38)",
          color: "#edf4ef",
        }}
      >
        <p
          style={{
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            fontSize: "0.76rem",
            color: "#e28e4f",
          }}
        >
          Smart CRM
        </p>
        <h1 style={{ margin: "12px 0 0", fontSize: "2.6rem" }}>Page not found</h1>
        <p style={{ margin: "12px 0 0", color: "#96a9a1", lineHeight: 1.6 }}>
          The page you tried to open does not exist in this workspace yet.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            marginTop: "20px",
            padding: "13px 16px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #d07a39 0%, #e28e4f 100%)",
            color: "#ffffff",
            fontWeight: 700,
          }}
        >
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
