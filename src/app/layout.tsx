import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/auth-provider";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "memo — buy now, pay in four", template: "%s · memo" },
  description:
    "A curated marketplace of independent stores. Every purchase splits into four with Tabby or Tamara.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            className:
              "!rounded-full !bg-ink !text-paper !border-0 !shadow-[var(--shadow-float)] !font-sans",
          }}
        />
      </body>
    </html>
  );
}
