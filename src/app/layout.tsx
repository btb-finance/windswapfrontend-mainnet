import type { Metadata } from "next";
import { Geist } from "next/font/google";
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
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wind Swap | DEX on Base",
  description: "The premier AMM and ve(3,3) DEX on Base. Swap tokens, provide concentrated liquidity, lock WIND to vote and earn real yield every week.",
  keywords: ["DEX", "Base", "AMM", "DeFi", "Wind Swap", "WIND", "ve(3,3)", "concentrated liquidity", "ve-tokenomics"],
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
    title: 'Wind Swap | DEX on Base',
    description: 'Swap, provide liquidity, and earn real yield on Base with ve(3,3) tokenomics.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wind Swap | DEX on Base',
    description: 'Swap, provide liquidity, and earn real yield on Base with ve(3,3) tokenomics.',
    images: ['/og.png'],
  },
  other: {
    'base:app_id': '69cbc4f32b941e5a27786850',
    // Farcaster Mini App embed card — shown when link is shared in a cast
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: 'https://windswap.org/EmbedPreview.png',
      aspectRatio: '3:2',
      button: {
        title: 'Open Wind Swap',
        action: {
          type: 'launch_miniapp',
          name: 'Wind Swap',
          url: 'https://windswap.org/swap',
          splashImageUrl: 'https://windswap.org/splash.png',
          splashBackgroundColor: '#0a0a14',
        },
      },
    }),
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
        <meta name="theme-color" content="#00d4ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logo.png" />
        
        {/* Logo is 83kB — no preload to save bandwidth on slow connections */}
        
        {/* DNS prefetch for Base RPC endpoints */}
        <link rel="dns-prefetch" href="https://base-rpc.publicnode.com" />
        <link rel="dns-prefetch" href="https://base.meowrpc.com" />

        {/* Preconnect to Base RPC endpoints */}
        <link rel="preconnect" href="https://base-rpc.publicnode.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://base.meowrpc.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} antialiased min-h-screen flex flex-col`}
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
