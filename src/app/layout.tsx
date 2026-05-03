import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ニジマス管理 | きらり",
  description: "ニジマスつかみ取り運営管理システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
