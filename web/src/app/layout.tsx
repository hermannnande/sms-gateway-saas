import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SMS Gateway SaaS - Envoi SMS en masse",
  description: "Plateforme professionnelle d'envoi de SMS via Android Gateway. Multi-SIM, temps réel, anti-spam.",
  keywords: ["SMS", "Gateway", "Android", "Envoi SMS", "Bulk SMS", "API SMS"],
  authors: [{ name: "SMS Gateway Team" }],
  openGraph: {
    title: "SMS Gateway SaaS",
    description: "Plateforme professionnelle d'envoi de SMS",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}


