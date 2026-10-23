/**
 * Checks the one-step builders in src/lib/v4/intents.ts: the exact JSON and key order of both Intent
 * variants, the signed message strings, the NEAR ft_transfer_call messages, and the parsers.
 * Run: `npm run check:v4-intents` (Node 22.6+ strips the types).
 *
 * Loaded by URL so the tsconfig does not need `allowImportingTsExtensions`.
 */

import assert from 'node:assert/strict';

type Intents = typeof import('../src/lib/v4/intents');
const intents: Intents = await import(new URL('../src/lib/v4/intents.ts', import.meta.url).href);
const {
  swapIntent,
  addLiquidityIntent,
  intentMessage,
  cancelIntentMessage,
  nearSwapMsg,
  nearZapMsg,
  nearFtTransferCall,
  parseIntentState,
  withdrawalIdFromResult,
} = intents;

const DEX = 'windswapv4-btb.testnet';
const WALLET = 'evm:0x1111111111111111111111111111111111111111';
const ETH = 'base-sepolia:eth';
const TEST1 = 'base-sepolia:test1';

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

// --- EVM intents: key order and decimal strings are part of the signed bytes.

check('Swap intent JSON (spec order)', () => {
  const got = JSON.stringify(
    swapIntent({ tokenIn: ETH, amountIn: '1000', path: [{ pool_id: 4, token_in: ETH }], minAmountOut: '990', to: WALLET }),
  );
  assert.equal(
    got,
    '{"Swap":{"token_in":"base-sepolia:eth","amount_in":"1000","path":[{"pool_id":4,"token_in":"base-sepolia:eth"}],"min_amount_out":"990","to":"evm:0x1111111111111111111111111111111111111111"}}',
  );
});

check('Swap intent keys in order', () => {
  const body = (swapIntent({ tokenIn: ETH, amountIn: '1', path: [{ pool_id: 4, token_in: ETH }], minAmountOut: '1', to: WALLET }) as { Swap: object }).Swap;
  assert.deepEqual(Object.keys(body), ['token_in', 'amount_in', 'path', 'min_amount_out', 'to']);
  assert.deepEqual(Object.keys((body as { path: object[] }).path[0]), ['pool_id', 'token_in']);
});

check('AddLiquidity intent JSON (spec order)', () => {
  const got = JSON.stringify(
    addLiquidityIntent({ tokenIn: TEST1, amountIn: '5', poolId: 4, tickLower: -60, tickUpper: 60, minLiquidity: '100' }),
  );
  assert.equal(
    got,
    '{"AddLiquidity":{"token_in":"base-sepolia:test1","amount_in":"5","pool_id":4,"tick_lower":-60,"tick_upper":60,"min_liquidity":"100"}}',
  );
});

check('AddLiquidity intent keys in order', () => {
  const body = (addLiquidityIntent({ tokenIn: TEST1, amountIn: '5', poolId: 4, tickLower: -60, tickUpper: 60, minLiquidity: '1' }) as { AddLiquidity: object }).AddLiquidity;
  assert.deepEqual(Object.keys(body), ['token_in', 'amount_in', 'pool_id', 'tick_lower', 'tick_upper', 'min_liquidity']);
});

check('intent signed message', () => {
  const intent = swapIntent({ tokenIn: ETH, amountIn: '1000', path: [{ pool_id: 4, token_in: ETH }], minAmountOut: '990', to: WALLET });
  assert.equal(
    intentMessage(DEX, WALLET, 7, 1_700_000_600, intent),
    `Wind Swap v4 intent on ${DEX} by ${WALLET} nonce 7 expires 1700000600: ${JSON.stringify(intent)}`,
  );
});

check('cancel signed message', () => {
  assert.equal(
    cancelIntentMessage(DEX, '42', WALLET, 8, 1_700_000_900),
    `Wind Swap v4 cancel intent 42 on ${DEX} by ${WALLET} nonce 8 expires 1700000900`,
  );
});

check('swap intent rejects a bad recipient, empty path and non-integer amounts', () => {
  assert.throws(() => swapIntent({ tokenIn: ETH, amountIn: '1', path: [{ pool_id: 4, token_in: ETH }], minAmountOut: '1', to: '0xabc' }));
  assert.throws(() => swapIntent({ tokenIn: ETH, amountIn: '1', path: [{ pool_id: 4, token_in: ETH }], minAmountOut: '1', to: '0x1111111111111111111111111111111111111111' }));
  assert.throws(() => swapIntent({ tokenIn: ETH, amountIn: '1', path: [], minAmountOut: '1', to: WALLET }));
  assert.throws(() => swapIntent({ tokenIn: ETH, amountIn: '1.5', path: [{ pool_id: 4, token_in: ETH }], minAmountOut: '1', to: WALLET }));
  assert.throws(() => addLiquidityIntent({ tokenIn: TEST1, amountIn: '-5', poolId: 4, tickLower: -60, tickUpper: 60, minLiquidity: '1' }));
});

// --- NEAR ft_transfer_call messages.

check('NEAR swap msg', () => {
  assert.equal(
    nearSwapMsg({ path: [{ pool_id: 1, token_in: 'windswapv4-tusdc.testnet' }], minAmountOut: '990', to: 'near:alice.testnet' }),
    '{"swap":{"path":[{"pool_id":1,"token_in":"windswapv4-tusdc.testnet"}],"min_amount_out":"990","to":"near:alice.testnet"}}',
  );
});

check('NEAR swap msg with two hops keeps hop order', () => {
  const msg = JSON.parse(
    nearSwapMsg({
      path: [
        { pool_id: 1, token_in: 'a.testnet' },
        { pool_id: 2, token_in: 'b.testnet' },
      ],
      minAmountOut: '1',
      to: 'near:alice.testnet',
    }),
  );
  assert.deepEqual(msg.swap.path, [
    { pool_id: 1, token_in: 'a.testnet' },
    { pool_id: 2, token_in: 'b.testnet' },
  ]);
});

check('NEAR zap msg (add_liquidity, zap true, spec order)', () => {
  assert.equal(
    nearZapMsg({ poolId: 4, tickLower: -60, tickUpper: 60, minLiquidity: '100' }),
    '{"add_liquidity":{"pool_id":4,"tick_lower":-60,"tick_upper":60,"zap":true,"min_liquidity":"100"}}',
  );
});

check('NEAR swap msg rejects a non-NEAR recipient', () => {
  assert.throws(() => nearSwapMsg({ path: [{ pool_id: 1, token_in: 'a.testnet' }], minAmountOut: '1', to: WALLET }));
});

check('NEAR ft_transfer_call action', () => {
  const action = nearFtTransferCall({ token: 'windswapv4-tusdc.testnet', dex: DEX, amount: '500', msg: '{}', gas: '200000000000000' });
  assert.deepEqual(action, {
    receiverId: 'windswapv4-tusdc.testnet',
    methodName: 'ft_transfer_call',
    args: { receiver_id: DEX, amount: '500', msg: '{}' },
    gas: '200000000000000',
    deposit: '1',
  });
  assert.deepEqual(Object.keys(action.args), ['receiver_id', 'amount', 'msg']);
  assert.ok(BigInt(action.gas) >= 150_000_000_000_000n, 'gas is at least 150 TGas');
});

// --- Parsers.

check('intent state: bare and wrapped variants', () => {
  assert.deepEqual(parseIntentState('Open'), { kind: 'open' });
  assert.deepEqual(parseIntentState({ Open: null }), { kind: 'open' });
  assert.deepEqual(parseIntentState({ status: 'Open' }), { kind: 'open' });
  assert.deepEqual(parseIntentState({ status: { Executed: { withdrawal_id: 3 } } }), { kind: 'executed', result: { withdrawal_id: 3 } });
  assert.deepEqual(parseIntentState({ Failed: { reason: 'TooLittleReceived' } }), { kind: 'failed', reason: 'TooLittleReceived' });
  assert.deepEqual(parseIntentState({ Failed: 'slippage' }), { kind: 'failed', reason: 'slippage' });
  assert.equal(parseIntentState({ weird: true }).kind, 'unknown');
});

check('withdrawal id from an executed result', () => {
  assert.equal(withdrawalIdFromResult({ withdrawal_id: 9 }), 9);
  assert.equal(withdrawalIdFromResult({ withdrawal: '12' }), 12);
  assert.equal(withdrawalIdFromResult({ amount_out: '5' }), null);
  assert.equal(withdrawalIdFromResult(null), null);
});

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('all intent checks passed');
}
