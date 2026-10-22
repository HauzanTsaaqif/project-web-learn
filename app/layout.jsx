import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata = { title: "DataQuest Lab - Latihan Database", description: "Latihan membangun database MySQL dengan kasus industri bertingkat." };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Montserrat:wght@700;800;900&display=swap" />
      </head>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
