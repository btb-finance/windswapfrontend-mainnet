/**
 * Portfolio — fetches user balances via RPC multicall, joins with cached prices.
 * Client calls getUserPortfolio action on connect.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const PRIMARY_RPC = "https://base-rpc.publicnode.com";
const FALLBACK_RPCS = [
  "https://mainnet.base.org",
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
  "https://rpc.ankr.com/base",
];
const CL_INTERFACE_MULTICALL = "0x8888Ce7DE18b513DBe6935E0C82aAaE08ADc6127";
const BALANCE_OF_SELECTOR = "70a08231";

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  for (const rpc of [PRIMARY_RPC, ...FALLBACK_RPCS]) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.error) continue;
      return json.result;
    } catch { continue; }
  }
  return null;
}

function encodeMulticallData(calls: { target: string; data: string }[]): string {
  const n = calls.length;
  const tupleBlobs: string[] = [];
  for (const call of calls) {
    const addr = call.target.slice(2).toLowerCase().padStart(64, "0");
    const gas = (100000).toString(16).padStart(64, "0");
    const bytesOffset = "0000000000000000000000000000000000000000000000000000000000000060";
    const dataHex = call.data.startsWith("0x") ? call.data.slice(2) : call.data;
    const dataByteLen = dataHex.length / 2;
    const dataLenHex = dataByteLen.toString(16).padStart(64, "0");
    const dataPadded = dataHex + "0".repeat(Math.ceil(dataHex.length / 64) * 64 - dataHex.length);
    tupleBlobs.push(addr + gas + bytesOffset + dataLenHex + dataPadded);
  }
  let offsetAccum = n * 32;
  const offsets: string[] = [];
  for (const blob of tupleBlobs) {
    offsets.push(offsetAccum.toString(16).padStart(64, "0"));
    offsetAccum += blob.length / 2;
  }
  return (
    "0x1749e1e3" +
    "0000000000000000000000000000000000000000000000000000000000000020" +
    n.toString(16).padStart(64, "0") +
    offsets.join("") +
    tupleBlobs.join("")
  );
}

function decodeMulticallResult(raw: string): { success: boolean; returnData: string }[] {
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  const arrayOffset = parseInt(hex.slice(64, 128), 16) * 2;
  const arrayLen = parseInt(hex.slice(arrayOffset, arrayOffset + 64), 16);
  const results: { success: boolean; returnData: string }[] = [];
  const offsetsStart = arrayOffset + 64;
  for (let i = 0; i < arrayLen; i++) {
    const tupleOff = parseInt(hex.slice(offsetsStart + i * 64, offsetsStart + (i + 1) * 64), 16) * 2;
    const tupleStart = arrayOffset + 64 + tupleOff;
    const success = parseInt(hex.slice(tupleStart, tupleStart + 64), 16) !== 0;
    const bytesOff = parseInt(hex.slice(tupleStart + 128, tupleStart + 192), 16) * 2;
    const bytesStart = tupleStart + bytesOff;
    const bytesLen = parseInt(hex.slice(bytesStart, bytesStart + 64), 16);
    const returnData = "0x" + hex.slice(bytesStart + 64, bytesStart + 64 + bytesLen * 2);
    results.push({ success, returnData });
  }
  return results;
}

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals).replace(/0+$/, "").slice(0, 6);
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Public action — called by client when wallet connects.
 * Reads tokens + prices from Convex DB, fetches balances via RPC.
 */
export const getUserPortfolio = action({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    // Read tokens + prices from Convex DB (instant, no external calls)
    const [tokens, prices] = await Promise.all([
      ctx.runQuery(api.tokens.listAll),
      ctx.runQuery(api.queries.listAllPrices),
    ]);

    if (tokens.length === 0) {
      return { totalValueUsd: 0, holdings: [] };
    }

    const priceMap = new Map<string, number>();
    for (const p of prices) {
      priceMap.set(p.address, p.priceUsd);
    }

    // Fetch balances via RPC multicall (1 call)
    const paddedAddr = address.slice(2).toLowerCase().padStart(64, "0");
    const nativeAddr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const erc20Tokens = tokens.filter((t) => t.address !== nativeAddr);

    const calls = erc20Tokens.map((t) => ({
      target: t.address,
      data: "0x" + BALANCE_OF_SELECTOR + paddedAddr,
    }));

    const [nativeRaw, multicallRaw] = await Promise.all([
      rpcCall("eth_getBalance", [address, "latest"]),
      calls.length > 0
        ? rpcCall("eth_call", [{ to: CL_INTERFACE_MULTICALL, data: encodeMulticallData(calls) }, "latest"])
        : null,
    ]);

    const balanceMap = new Map<string, bigint>();

    if (nativeRaw && typeof nativeRaw === "string") {
      balanceMap.set(nativeAddr, BigInt(nativeRaw));
    }

    if (multicallRaw && typeof multicallRaw === "string" && multicallRaw !== "0x") {
      try {
        const decoded = decodeMulticallResult(multicallRaw);
        for (let i = 0; i < decoded.length; i++) {
          const r = decoded[i];
          if (r.success && r.returnData.length >= 66) {
            try { balanceMap.set(erc20Tokens[i].address, BigInt(r.returnData)); } catch {}
          }
        }
      } catch {}
    }

    // Build holdings
    const wethPrice = priceMap.get("0x4200000000000000000000000000000000000006") || 0;
    const holdings: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI?: string;
      isNative: boolean;
      balanceRaw: string;
      balanceFormatted: string;
      priceUsd: number;
      valueUsd: number;
    }[] = [];
    let totalValueUsd = 0;

    for (const token of tokens) {
      const balance = balanceMap.get(token.address) || 0n;
      if (balance === 0n) continue;

      const balanceFormatted = formatUnits(balance, token.decimals);
      const isNative = token.address === nativeAddr;
      const priceUsd = isNative ? wethPrice : (priceMap.get(token.address) || 0);
      const valueUsd = Math.round(parseFloat(balanceFormatted) * priceUsd * 100) / 100;

      holdings.push({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        isNative,
        balanceRaw: balance.toString(),
        balanceFormatted,
        priceUsd,
        valueUsd,
      });
      totalValueUsd += valueUsd;
    }

    holdings.sort((a, b) => b.valueUsd - a.valueUsd);

    return {
      totalValueUsd: Math.round(totalValueUsd * 100) / 100,
      holdings,
    };
  },
});
