/**
 * Price cron — runs every 5 minutes, fetches all token prices from DexScreener,
 * stores in Convex DB. All connected clients auto-update via real-time subscriptions.
 */

import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Known stablecoins — always $1
const STABLECOINS: Record<string, number> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": 1, // USDC
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": 1, // USDT
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": 1, // DAI
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": 1, // USDbC
};

// Core token addresses to always fetch prices for
const CORE_ADDRESSES = [
  "0x4200000000000000000000000000000000000006", // WETH
  "0x888a4f89af7dd0be836ca367c9ff5490c0f6e888", // WIND
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", // USDT
  "0x0555e30da8f98308edb960aa94c0db47230d2b9c", // cbBTC
  "0x768be13e1680b5ebe0024c42c896e3db59ec0149", // SKI
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", // VIRTUAL
  "0x532f27101965dd16442e59d40670faf5ebb142e4", // BRETT
  "0xcde172dc5ffc46d228838446c57c1227e0b82049", // BOOMER
  "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf", // VVV
];

/**
 * Internal action — fetches prices from DexScreener, then calls mutation to save
 */
export const fetchPrices = internalAction({
  handler: async (ctx) => {
    // Get all token addresses from DB
    const allTokens = await ctx.runQuery(internal.tokens.listAllAddresses);
    const addresses = [...new Set([...CORE_ADDRESSES, ...allTokens])];

    const now = Date.now();
    const updates: { address: string; priceUsd: number; liquidityUsd: number }[] = [];

    // Add stablecoins
    for (const [addr, price] of Object.entries(STABLECOINS)) {
      updates.push({ address: addr, priceUsd: price, liquidityUsd: 1e9 });
    }

    // Fetch from DexScreener in batches of 30
    const toFetch = addresses.filter(a => !STABLECOINS[a]);
    for (let i = 0; i < toFetch.length; i += 30) {
      const batch = toFetch.slice(i, i + 30);
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data?.pairs) continue;

        // Best price per token (highest liquidity pair)
        const bestByToken = new Map<string, { price: number; liq: number }>();
        for (const pair of data.pairs) {
          if (pair.chainId !== "base") continue;
          const baseAddr = pair.baseToken?.address?.toLowerCase();
          const priceUsd = parseFloat(pair.priceUsd || "0");
          const liq = pair.liquidity?.usd || 0;
          if (!baseAddr || priceUsd <= 0) continue;
          const existing = bestByToken.get(baseAddr);
          if (!existing || liq > existing.liq) {
            bestByToken.set(baseAddr, { price: priceUsd, liq });
          }
        }

        for (const addr of batch) {
          const key = addr.toLowerCase();
          const entry = bestByToken.get(key);
          if (entry) {
            updates.push({ address: key, priceUsd: entry.price, liquidityUsd: entry.liq });
          }
        }
      } catch {
        // Skip failed batch
      }
    }

    // Save all prices in one mutation
    if (updates.length > 0) {
      await ctx.runMutation(internal.prices.savePrices, { updates, now });
    }
  },
});

/**
 * Internal mutation — upserts price records
 */
export const savePrices = internalMutation({
  args: {
    updates: v.array(v.object({
      address: v.string(),
      priceUsd: v.float64(),
      liquidityUsd: v.float64(),
    })),
    now: v.float64(),
  },
  handler: async (ctx, { updates, now }) => {
    for (const { address, priceUsd, liquidityUsd } of updates) {
      const existing = await ctx.db
        .query("tokenPrices")
        .withIndex("by_address", (q) => q.eq("address", address))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { priceUsd, liquidityUsd, updatedAt: now });
      } else {
        await ctx.db.insert("tokenPrices", { address, priceUsd, liquidityUsd, updatedAt: now });
      }
    }
  },
});
