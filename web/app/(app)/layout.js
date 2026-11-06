import "./globals.css";
export const metadata = { title: "TWWIOS — AI agents that run your operations", description: "Autonomous AI agents connected to your ERP, CRM, WhatsApp and voice. Human approval built in." };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#000000" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Inter+Tight:wght@400;500;600;700;800;900&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
