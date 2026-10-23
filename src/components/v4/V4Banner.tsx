'use client';

export function V4Banner({ tone, children }: { tone: 'error' | 'info' | 'warning'; children: React.ReactNode }) {
  const styles = {
    error: 'bg-red-500/10 border-red-500/40 text-red-300',
    warning: 'bg-amber-500/10 border-amber-500/40 text-amber-200',
    info: 'bg-white/5 border-white/10 text-gray-300',
  }[tone];
  return (
    <div className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${styles}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
