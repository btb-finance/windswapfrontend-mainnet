'use client';
import { useState } from 'react';

export function useAsyncState() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return { isLoading, setIsLoading, error, setError };
}
