/**
 * Centralized Subgraph Configuration
 * Import from here instead of hardcoding URLs in each file
 */

// Goldsky GraphQL endpoint for WindSwap protocol data
export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || 
  'https://api.goldsky.com/api/public/project_cmjlh2t5mylhg01tm7t545rgk/subgraphs/windswap-base/1.0.6/gn';

/**
 * Helper to read subgraph JSON response with error handling
 */
export async function readSubgraphJson(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    const ct = response.headers.get('content-type') || '';
    const snippet = text.slice(0, 200);
    throw new Error(`[Subgraph] ${label} returned non-JSON response (status=${response.status}, content-type=${ct}): ${snippet}`);
  }
  return json;
}

/**
 * Fetch from subgraph with proper error handling
 */
export async function fetchSubgraph<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  
  const json = await readSubgraphJson(response, 'query') as { data?: T; errors?: unknown[] };
  
  if (json.errors) {
    console.warn('[Subgraph] Query errors:', json.errors);
    throw new Error('Subgraph query failed');
  }
  
  return json.data as T;
}
