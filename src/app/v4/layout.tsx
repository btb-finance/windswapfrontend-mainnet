import { NearWalletProvider } from '@/providers/NearWalletProvider';
import { V4ActorProvider } from '@/providers/V4ActorProvider';
import { V4Nav } from '@/components/v4/V4Nav';
import { V4SignedPayload } from '@/components/v4/V4SignedPayload';

/** Wind Swap v4 (NEAR testnet + Base Sepolia bridge). The NEAR wallet and the actor are scoped to these routes. */
export default function V4Layout({ children }: { children: React.ReactNode }) {
  return (
    <NearWalletProvider>
      <V4ActorProvider>
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8">
          <V4Nav />
          <V4SignedPayload />
          {children}
        </div>
      </V4ActorProvider>
    </NearWalletProvider>
  );
}
