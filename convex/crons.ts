import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh token prices every 5 minutes
crons.interval("refresh prices", { minutes: 5 }, internal.prices.fetchPrices);

// Refresh token list every hour
crons.interval("refresh token list", { hours: 1 }, internal.tokens.fetchTokenLists);

export default crons;
