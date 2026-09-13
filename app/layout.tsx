import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "艾泽拉斯配置站 · WoW Retail 配置分享",
  description: "给固定魔兽队友使用的 Retail 插件、按键与界面配置分享和一键恢复工具。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
