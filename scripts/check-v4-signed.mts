/**
 * Checks that the EVM signed-action JSON matches serde's output for the contract's `SignedAction`.
 * Run: `npm run check:v4-signed` (Node 22.6+ strips the types). The expected strings are the ones
 * `serde_json::to_string` gives in crates/near-contract/src/tokenomics_tests.rs and the field order
 * of crates/near-contract/src/lib.rs (`SignedAction`).
 *
 * Loaded by URL so the tsconfig does not need `allowImportingTsExtensions`.
 */

import assert from 'node:assert/strict';

type Signed = typeof import('../src/lib/v4/evm/signed');
const signed: Signed = await import(new URL('../src/lib/v4/evm/signed.ts', import.meta.url).href);
const { toSignedAction, actionMessage, hasSignedForm } = signed;

const E18 = 10n ** 18n;
const WEEK = 604_800;

function json(method: string, args: Record<string, unknown>): string {
  return JSON.stringify(toSignedAction({ receiverId: 'windswapv4-btb.testnet', methodName: method, args, gas: '0', deposit: '0' }));
}

const cases: Array<[string, string, string]> = [
  // Rust test: `CreateLock { amount: 5, duration: 7, permanent: false }` serializes without `permanent`.
  ['CreateLock without permanent', json('create_lock', { amount: '5', duration: 7, permanent: false }), '{"CreateLock":{"amount":"5","duration":7}}'],
  // `permanent: true` is written last, after duration (declaration order).
  [
    'CreateLock permanent',
    json('create_lock', { amount: (20n * E18).toString(), duration: 4 * WEEK, permanent: true }),
    '{"CreateLock":{"amount":"20000000000000000000","duration":2419200,"permanent":true}}',
  ],
  // An absent `permanent` (an older caller) is also left out.
  ['CreateLock with permanent absent', json('create_lock', { amount: '5', duration: 7 }), '{"CreateLock":{"amount":"5","duration":7}}'],
  // Unit variant: serde writes a bare string.
  ['Distribute', json('distribute', {}), '"Distribute"'],
  ['Vote (docs example)', json('vote', { token_id: 1, pools: [4, 1], weights: ['70', '30'] }), '{"Vote":{"token_id":1,"pools":[4,1],"weights":["70","30"]}}'],
  [
    'MintPosition',
    json('mint_position', { pool_id: 1, tick_lower: -60, tick_upper: 60, liquidity: '1000' }),
    '{"MintPosition":{"pool_id":1,"tick_lower":-60,"tick_upper":60,"liquidity":"1000"}}',
  ],
  ['Collect', json('collect', { pool_id: 2, tick_lower: -120, tick_upper: 120 }), '{"Collect":{"pool_id":2,"tick_lower":-120,"tick_upper":120}}'],
];

let failed = 0;
for (const [name, got, want] of cases) {
  try {
    assert.equal(got, want);
    console.log(`ok   ${name}`);
  } catch {
    failed += 1;
    console.error(`FAIL ${name}\n  got  ${got}\n  want ${want}`);
  }
}

// The signed message embeds the same JSON, and Distribute is signable.
const distributeAction = toSignedAction({ receiverId: 'x', methodName: 'distribute', args: {}, gas: '0', deposit: '0' });
assert.equal(
  actionMessage('windswapv4-btb.testnet', 'evm:0xabc', 1, 2, distributeAction),
  'Wind Swap v4 action on windswapv4-btb.testnet by evm:0xabc nonce 1 expires 2: "Distribute"',
);
assert.equal(hasSignedForm('distribute'), true);
assert.equal(hasSignedForm('deposit'), false);
assert.throws(() => toSignedAction({ receiverId: 'x', methodName: 'deposit', args: {}, gas: '0', deposit: '0' }));

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('all signed-action checks passed');
}
