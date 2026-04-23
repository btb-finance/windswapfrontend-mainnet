import { MegapotCard } from '@/components/lottery/MegapotCard';

export const metadata = { title: 'Lottery — Wind Swap' };

export default function LotteryPage() {
    return (
        <div className="container mx-auto px-3 sm:px-6 py-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">Daily Jackpot</h1>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                    Buy lottery tickets with USDC and win a share of the daily prize pool — powered by Megapot on Base.
                </p>
            </div>
            <MegapotCard />
        </div>
    );
}
