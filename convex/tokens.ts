/**
 * Token list management — fetched from external sources, stored in Convex DB.
 * Refreshed hourly by cron. Client reads from DB instantly.
 */

import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

const CORE_TOKENS = [
  { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", symbol: "ETH", name: "Ethereum", decimals: 18, logoURI: "/logo/eth.svg", source: "core" },
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18, logoURI: "/logo/eth.svg", source: "core" },
  { address: "0x888a4f89af7dd0be836ca367c9ff5490c0f6e888", symbol: "WIND", name: "Wind Swap", decimals: 18, logoURI: "/logo.png", source: "core" },
  { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", name: "USD Coin", decimals: 6, logoURI: "/logo/USDCoin.svg", source: "core" },
  { address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", symbol: "USDT", name: "Tether USD", decimals: 6, logoURI: "/logo/usdt0.webp", source: "core" },
  { address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", symbol: "DAI", name: "Dai Stablecoin", decimals: 18, source: "core" },
  { address: "0x0555e30da8f98308edb960aa94c0db47230d2b9c", symbol: "cbBTC", name: "Coinbase Wrapped BTC", decimals: 8, source: "core" },
  { address: "0x768be13e1680b5ebe0024c42c896e3db59ec0149", symbol: "SKI", name: "SKI", decimals: 18, logoURI: "/logo/ski.webp", source: "core" },
  { address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", symbol: "VIRTUAL", name: "VIRTUAL", decimals: 18, logoURI: "/logo/Virtuals.webp", source: "core" },
  { address: "0x532f27101965dd16442e59d40670faf5ebb142e4", symbol: "BRETT", name: "BRETT", decimals: 18, logoURI: "/logo/brett.webp", source: "core" },
  { address: "0xcde172dc5ffc46d228838446c57c1227e0b82049", symbol: "BOOMER", name: "BOOMER", decimals: 18, logoURI: "/logo/boomer.webp", source: "core" },
  { address: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf", symbol: "VVV", name: "VVV", decimals: 18, logoURI: "/logo/vvv.webp", source: "core" },
];

const TOKEN_LISTS = [
  "https://tokens.uniswap.org",
  "https://static.optimism.io/optimism.tokenlist.json",
];
const WOWMAX_URL = "https://api-gateway.wowmax.exchange/chains/8453/tokens";
const HYDREX_URL = "https://raw.githubusercontent.com/hydrexfi/hydrex-lists/main/tokens/8453.json";
const PANCAKE_URL = "https://tokens.pancakeswap.finance/pancakeswap-base-default.json";

/**
 * Public query — get all tokens for token selector
 */
export const listAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("tokens").collect();
  },
});

/**
 * Internal query — get all addresses (used by price cron)
 */
export const listAllAddresses = internalQuery({
  handler: async (ctx) => {
    const tokens = await ctx.db.query("tokens").collect();
    return tokens.map((t) => t.address);
  },
});

/**
 * Internal action — fetch from external lists and save to DB
 */
export const fetchTokenLists = internalAction({
  handler: async (ctx) => {
    const results = await Promise.allSettled([
      ...TOKEN_LISTS.map((url) => fetch(url, { signal: AbortSignal.timeout(10000) }).then((r) => r.json())),
      fetch(WOWMAX_URL, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()),
      fetch(HYDREX_URL, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()),
      fetch(PANCAKE_URL, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()),
    ]);

    const seen = new Set<string>(CORE_TOKENS.map((t) => t.address));
    const tokens: typeof CORE_TOKENS = [...CORE_TOKENS];

    // Uniswap + Superchain
    for (let i = 0; i < 2; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") continue;
      const source = i === 0 ? "uniswap" : "superchain";
      for (const t of r.value?.tokens || []) {
        if (t.chainId !== 8453) continue;
        const key = t.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push({ address: key, symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI, source });
      }
    }

    // WowMax
    const wm = results[2];
    if (wm.status === "fulfilled" && Array.isArray(wm.value)) {
      for (const t of wm.value) {
        const key = t.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push({ address: key, symbol: t.symbol, name: t.name, decimals: t.decimals, source: "wowmax" });
      }
    }

    // HyDRex
    const hx = results[3];
    if (hx.status === "fulfilled" && Array.isArray(hx.value)) {
      for (const t of hx.value) {
        const key = t.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push({ address: key, symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI, source: "hydrex" });
      }
    }

    // PancakeSwap
    const pk = results[4];
    if (pk.status === "fulfilled") {
      for (const t of pk.value?.tokens || []) {
        if (t.chainId !== 8453) continue;
        const key = t.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push({ address: key, symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI, source: "pancake" });
      }
    }

    // Save all tokens to DB (batch)
    await ctx.runMutation(internal.tokens.saveTokens, { tokens });
  },
});

/**
 * Internal mutation — replace all tokens in DB
 */
export const saveTokens = internalMutation({
  args: {
    tokens: v.array(
      v.object({
        address: v.string(),
        symbol: v.string(),
        name: v.string(),
        decimals: v.float64(),
        logoURI: v.optional(v.string()),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, { tokens }) => {
    // Delete all existing tokens and re-insert
    const existing = await ctx.db.query("tokens").collect();
    for (const t of existing) {
      await ctx.db.delete(t._id);
    }
    for (const t of tokens) {
      await ctx.db.insert("tokens", t);
    }
  },
});
