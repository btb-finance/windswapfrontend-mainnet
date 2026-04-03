interface WindLogoProps {
    size?: number;
    className?: string;
}

/**
 * Wind Swap logo
 */
export function WindLogo({ size = 40, className = '' }: WindLogoProps) {
    return (
        <img
            src="/logo.png"
            width={size}
            height={size}
            className={`object-contain ${className}`}
            alt="Wind Swap"
        />
    );
}
