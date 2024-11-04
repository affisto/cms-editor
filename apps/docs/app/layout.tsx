import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "클라이밍 정보 아카이브",
  description: "클라이밍 관련 정보를 모으고 있습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
