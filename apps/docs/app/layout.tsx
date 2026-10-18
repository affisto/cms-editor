import type { Metadata } from "next";
import "../../../tokens.css";
import "cms-editor-core/style.css";
import "cms-editor-form/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blockroom — 문서와 폼을 만드는 공간",
  description: "블록을 추가해서 문서와 폼을 만들고 어디서든 사용하세요.",
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
