'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

interface ReferralContextType {
    referralAddress: string | null;
    isReferred: boolean;
    referralLink: (userAddress: string) => string;
}

const ReferralContext = createContext<ReferralContextType>({
    referralAddress: null,
    isReferred: false,
    referralLink: () => '',
});

const STORAGE_KEY = 'windswap_referral';
const DEFAULT_REFERRAL = '0xfed2Ff614E0289D41937139730B49Ee158D02299';

export function ReferralProvider({ children }: { children: ReactNode }) {
    const searchParams = useSearchParams();
    const [referralAddress, setReferralAddress] = useState<string | null>(DEFAULT_REFERRAL);

    useEffect(() => {
        // 1. Check URL param first (overrides default)
        const refParam = searchParams.get('ref');
        if (refParam && /^0x[a-fA-F0-9]{40}$/.test(refParam)) {
            setReferralAddress(refParam);
            try {
                localStorage.setItem(STORAGE_KEY, refParam);
            } catch { /* noop */ }
            return;
        }

        // 2. Fall back to localStorage
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && /^0x[a-fA-F0-9]{40}$/.test(stored)) {
                setReferralAddress(stored);
                return;
            }
        } catch { /* noop */ }

        // 3. Fall back to default
        setReferralAddress(DEFAULT_REFERRAL);
    }, [searchParams]);

    const referralLink = (userAddress: string) =>
        `${typeof window !== 'undefined' ? window.location.origin : ''}/swap?ref=${userAddress}`;

    return (
        <ReferralContext.Provider
            value={{
                referralAddress,
                isReferred: !!referralAddress,
                referralLink,
            }}
        >
            {children}
        </ReferralContext.Provider>
    );
}

export function useReferral() {
    return useContext(ReferralContext);
}
