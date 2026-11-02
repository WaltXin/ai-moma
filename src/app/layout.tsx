import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI MoMA: a virtual museum of modern art",
    template: "%s · AI MoMA",
  },
  description:
    "An open-source virtual museum: walk the floors, learn modern art movements, make your own work with AI and exhibit it.",
};

const NAV = [
  { href: "/", label: "Floors" },
  { href: "/learn", label: "Learn" },
  { href: "/studio", label: "Studio" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="text-xl font-black tracking-tight">
              AI MoMA
            </Link>
            <nav className="flex gap-5 text-sm font-medium">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-accent">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-muted sm:px-6">
            <span>AI MoMA is an open-source project, not affiliated with any museum.</span>
            <a href="https://github.com/WaltXin/ai-moma" className="hover:text-ink">
              Contribute a movement →
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
