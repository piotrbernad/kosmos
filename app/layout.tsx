import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "System zgłoszeń",
  description: "Zgłaszaj problemy, śledź ich status.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
