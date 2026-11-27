import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "@/styles/globals.css";
import PlatformChatbot from "@/components/platform-chatbot";

export const metadata: Metadata = {
  title: "Youamy Enterprises Limited | Mombasa",
  description:
    "Gulf recruitment, verified vehicles, real estate and sanitation services from Youamy Enterprises Limited in Kenya.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("youamy-theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}}())',
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <PlatformChatbot />
      </body>
    </html>
  );
}
