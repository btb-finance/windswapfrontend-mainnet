import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/providers/ClientProviders";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MainContent } from "@/components/layout/MainContent";
import { PWAInstallPrompt } from "@/components/common/PWAInstallPrompt";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { NavigationProgress } from "@/components/common/NavigationProgress";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wind Swap | DEX on Ethereum",
  description: "The premier AMM and ve-tokenomics DEX on Ethereum Network. Swap, provide liquidity, and earn rewards with WIND.",
  keywords: ["DEX", "Sei", "AMM", "DeFi", "Wind Swap", "WIND", "ve-tokenomics", "concentrated liquidity"],
  metadataBase: new URL("https://windswap.org"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WindSwap",
  },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Wind Swap | DEX on Ethereum',
    description: 'The premier AMM and ve-tokenomics DEX on Ethereum Network. Swap, provide liquidity, and earn rewards.',
    type: 'website',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Wind Swap | DEX on Ethereum',
    description: 'The premier AMM and ve-tokenomics DEX on Ethereum Network.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
        <meta name="base:app_id" content="69cbc4f32b941e5a27786850" />
        <meta name="theme-color" content="#00d4ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logo.png" />
        
        {/* Preload critical assets */}
        <link rel="preload" href="/logo.png" as="image" type="image/png" />
        
        {/* DNS prefetch for RPC endpoints */}
        <link rel="dns-prefetch" href="https://evm-rpc.sei-apis.com" />
        <link rel="dns-prefetch" href="https://sei-evm-rpc.stakeme.pro" />
        
        {/* Preconnect to RPC endpoints */}
        <link rel="preconnect" href="https://evm-rpc.sei-apis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://sei-evm-rpc.stakeme.pro" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
              // Track visits for PWA install prompt
              try {
                const visits = parseInt(localStorage.getItem('windswap_visits') || '0');
                localStorage.setItem('windswap_visits', (visits + 1).toString());
              } catch(e) {}
            `,
          }}
        />
        <ClientProviders>
          {/* Navigation progress bar — shows instantly when user taps a link */}
          <NavigationProgress />

          {/* Background Effects */}
          <div className="bg-orb bg-orb-primary" />
          <div className="bg-orb bg-orb-secondary" />

          {/* Header - hidden on mobile when connected */}
          <Header />

          {/* Main Content - dynamic padding based on connection */}
          <MainContent>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </MainContent>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />

          {/* Footer - hidden on mobile since we have bottom nav */}
          <div className="hidden md:block">
            <Footer />
          </div>

          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
        </ClientProviders>
      </body>
    </html>
  );
}
