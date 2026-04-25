'use client';

import { useAutoSwitchToEthereum } from '@/hooks/useAutoSwitchToEthereum';

export function ChainGuard() {
    useAutoSwitchToEthereum();
    return null;
}
