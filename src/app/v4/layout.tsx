import { NearWalletProvider } from '@/providers/NearWalletProvider';
import { V4Nav } from '@/components/v4/V4Nav';

/** Wind Swap v4 (NEAR testnet). The NEAR wallet is scoped to these routes. */
export default function V4Layout({ children }: { children: React.ReactNode }) {
  return (
    <NearWalletProvider>
      <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <V4Nav />
        {children}
      </div>
    </NearWalletProvider>
  );
}
