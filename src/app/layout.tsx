import type { Metadata } from "next";
import "./globals.css";
import { poppins, abhaya } from "./fonts";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/auth/session-provider";

export const metadata: Metadata = {
  title: "Salvora Kitchen",
  description: "Jajanan lezat dari dapur kami.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={`${poppins.variable} ${abhaya.variable}`}><body className="min-h-dvh font-sans antialiased"><SessionProvider>{children}</SessionProvider><Toaster closeButton position="bottom-right" /></body></html>;
}
