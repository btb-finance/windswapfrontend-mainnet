/**
 * Shared queries — used by portfolio action and client components
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all prices — used by portfolio action
 */
export const listAllPrices = query({
  handler: async (ctx) => {
    return await ctx.db.query("tokenPrices").collect();
  },
});

/**
 * Get price for a specific token — used by swap UI
 */
export const getPrice = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    return await ctx.db
      .query("tokenPrices")
      .withIndex("by_address", (q) => q.eq("address", address.toLowerCase()))
      .unique();
  },
});

/**
 * Get prices for multiple tokens — used by swap UI
 */
export const getPrices = query({
  args: { addresses: v.array(v.string()) },
  handler: async (ctx, { addresses }) => {
    const results: Record<string, number> = {};
    for (const addr of addresses) {
      const entry = await ctx.db
        .query("tokenPrices")
        .withIndex("by_address", (q) => q.eq("address", addr.toLowerCase()))
        .unique();
      if (entry) results[addr.toLowerCase()] = entry.priceUsd;
    }
    return results;
  },
});
