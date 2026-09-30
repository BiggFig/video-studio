import type { Metadata } from "next";
import { StudioProvider } from "@/components/studio-context";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Video Studio — Your product, in motion", template: "%s · Video Studio" },
  description: "Create a software launch or feature-demo video from your product URL or PRD. One submission. Your product, in motion. Free private beta.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main-content">Skip to content</a><StudioProvider>{children}</StudioProvider></body></html>;
}
