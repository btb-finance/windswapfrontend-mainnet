/**
 * Centralized Subgraph Configuration
 * Import from here instead of hardcoding URLs in each file
 */

// The Graph gateway endpoint for WindSwap protocol data
export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

// API key for The Graph gateway (required for authenticated access)
export const SUBGRAPH_API_KEY = process.env.NEXT_PUBLIC_SUBGRAPH_API_KEY || '';

// Standard headers for subgraph requests
export const SUBGRAPH_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUBGRAPH_API_KEY}`,
};

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
    headers: SUBGRAPH_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  const json = await readSubgraphJson(response, 'query') as { data?: T; errors?: unknown[] };

  if (json.errors) {
    console.warn('[Subgraph] Query errors:', json.errors);
    throw new Error('Subgraph query failed');
  }

  return json.data as T;
}
