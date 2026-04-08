import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "../providers/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart CRM Platform",
  description: "Tax preparer CRM platform built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem('smart-crm-theme');
                var theme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
                document.documentElement.dataset.theme = theme;
              } catch (error) {
                document.documentElement.dataset.theme = 'dark';
              }
            `,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
