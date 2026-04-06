import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Token prices — refreshed every 5 min by cron
  tokenPrices: defineTable({
    address: v.string(),       // lowercase token address
    priceUsd: v.float64(),
    liquidityUsd: v.float64(),
    updatedAt: v.float64(),
  }).index("by_address", ["address"]),

  // Token metadata — merged list from all sources, refreshed hourly
  tokens: defineTable({
    address: v.string(),       // lowercase
    symbol: v.string(),
    name: v.string(),
    decimals: v.float64(),
    logoURI: v.optional(v.string()),
    source: v.string(),        // "core" | "uniswap" | "wowmax" | "hydrex" | "pancake"
  }).index("by_address", ["address"]),
});
