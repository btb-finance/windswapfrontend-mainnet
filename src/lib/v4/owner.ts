/** Owner id of a NEAR account: lower-case hex of SHA-256 over the account id bytes (`owner_of_account`). */
export async function ownerOfNearAccount(accountId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accountId));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
