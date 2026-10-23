import { WindSwapClient } from '@/lib/windswap-v4';
import { V4_CONTRACT_ID, V4_RPC_URL } from './config';

/** Shared read client for the v4 DEX contract. Views only: sending goes through the wallet. */
export const v4Client = new WindSwapClient({ contractId: V4_CONTRACT_ID, rpcUrl: V4_RPC_URL });
