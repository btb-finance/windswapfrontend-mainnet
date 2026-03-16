interface WindLogoProps {
    size?: number;
    className?: string;
}

/**
 * Wind Swap logo — tornado / funnel mark with brand gradient.
 */
export function WindLogo({ size = 40, className = '' }: WindLogoProps) {
    const id = 'wl';
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-label="Wind Swap"
        >
            <defs>
                <linearGradient id={`${id}-top`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#6366f1" />
                    <stop offset="50%"  stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id={`${id}-mid`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
                <linearGradient id={`${id}-bot`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.8" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <g filter={`url(#${id}-glow)`}>
                {/* ── Wide top band ─────────────────────────────────────── */}
                {/* Outer swept arc — left edge curves right, right edge curves left */}
                <path
                    d="M 10 18 Q 30 10, 50 12 Q 70 10, 90 18
                       Q 76 26, 50 28 Q 24 26, 10 18 Z"
                    fill={`url(#${id}-top)`}
                    opacity="1"
                />

                {/* ── Upper-mid band ────────────────────────────────────── */}
                <path
                    d="M 20 32 Q 36 24, 50 26 Q 64 24, 80 32
                       Q 68 40, 50 42 Q 32 40, 20 32 Z"
                    fill={`url(#${id}-mid)`}
                    opacity="0.92"
                />

                {/* ── Mid band ──────────────────────────────────────────── */}
                <path
                    d="M 28 46 Q 40 38, 50 40 Q 60 38, 72 46
                       Q 62 54, 50 56 Q 38 54, 28 46 Z"
                    fill={`url(#${id}-top)`}
                    opacity="0.85"
                />

                {/* ── Lower-mid band ────────────────────────────────────── */}
                <path
                    d="M 36 60 Q 44 53, 50 55 Q 56 53, 64 60
                       Q 58 67, 50 69 Q 42 67, 36 60 Z"
                    fill={`url(#${id}-mid)`}
                    opacity="0.78"
                />

                {/* ── Narrow neck ───────────────────────────────────────── */}
                <path
                    d="M 42 73 Q 46 67, 50 69 Q 54 67, 58 73
                       Q 54 79, 50 81 Q 46 79, 42 73 Z"
                    fill={`url(#${id}-bot)`}
                    opacity="0.7"
                />

                {/* ── Tip / spout ───────────────────────────────────────── */}
                <ellipse
                    cx="50" cy="88"
                    rx="4" ry="6"
                    fill={`url(#${id}-bot)`}
                    opacity="0.55"
                />

                {/* ── Rotation swirl lines inside upper funnel ──────────── */}
                {/* These give the spinning impression */}
                <path
                    d="M 22 21 Q 50 15, 78 21"
                    stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.25"
                />
                <path
                    d="M 30 35 Q 50 30, 70 35"
                    stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.2"
                />
                <path
                    d="M 36 49 Q 50 44, 64 49"
                    stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.18"
                />
            </g>
        </svg>
    );
}
