/**
 * Offchain Settler Service
 *
 * Periodically generates OffchainState settlement proofs for:
 * - MarketRegistry (markets map, status updates)
 * - PredictionMarket (config/positions)
 * and commits them on-chain via settle(proof).
 *
 * Non-invasive: runs alongside existing monitors without altering logic.
 */

import { Mina, PublicKey } from 'o1js';
import { config, getDeployerKeypair, getRegistryAddress } from '../config.js';
import { redis } from './redis-client.js';

// Import compiled contract classes and OffchainState programs directly
// from the built contracts package. We follow existing import style.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
  MarketRegistry,
} from '../../../contracts/build/src/contracts/MarketRegistry.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
  PredictionMarket,
  predictionMarketOffchainState,
} from '../../../contracts/build/src/contracts/PredictionMarket.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { marketRegistryOffchainState } from '../../../contracts/build/src/contracts/MarketRegistry.js';

let networkInitialized = false;
function initNetwork() {
  if (networkInitialized) return;
  const Network = Mina.Network({
    mina: config.zekoNetworkUrl,
    archive: config.zekoNetworkUrl,
  });
  Mina.setActiveInstance(Network);
  networkInitialized = true;
}

let compiled = {
  registry: false,
  market: false,
};

async function ensureCompiled() {
  // Compile OffchainState ZkPrograms once per process
  if (!compiled.registry) {
    await marketRegistryOffchainState.compile();
    compiled.registry = true;
  }
  if (!compiled.market) {
    await predictionMarketOffchainState.compile();
    compiled.market = true;
  }
}

/**
 * Settle MarketRegistry offchain state if there are pending actions.
 */
export async function settleRegistryOffchainState(): Promise<boolean> {
  initNetwork();
  await ensureCompiled();

  const { privateKey: deployerKey, publicKey: deployer } = getDeployerKeypair();
  const registryAddr = getRegistryAddress();
  const registry = new MarketRegistry(registryAddr);

  // Prepare proof generation (bind instance to offchain state)
  registry.offchainState.setContractInstance(registry);

  try {
    const proof = await registry.offchainState.createSettlementProof();
    const tx = await Mina.transaction(deployer, async () => {
      await registry.settle(proof);
    });
    await tx.prove();
    const sent = await tx.sign([deployerKey]).send();
    console.log(` Offchain settle (Registry): ${sent.hash || 'pending'}`);
    return true;
  } catch (e: any) {
    // No pending actions or transient error
    const msg = e?.message || String(e);
    if (!msg.includes('No actions') && !msg.includes('empty') && !msg.includes('no actions')) {
      console.log(` Offchain settle (Registry): ${msg}`);
    }
    return false;
  }
}

/**
 * Settle a PredictionMarket offchain state if there are pending actions.
 */
export async function settlePredictionMarketOffchainState(
  marketAddress58: string
): Promise<boolean> {
  initNetwork();
  await ensureCompiled();

  const { privateKey: deployerKey, publicKey: deployer } = getDeployerKeypair();
  const marketAddress = PublicKey.fromBase58(marketAddress58);
  const market = new PredictionMarket(marketAddress);

  // Prepare proof generation (bind instance to offchain state)
  market.offchainState.setContractInstance(market);

  try {
    const proof = await market.offchainState.createSettlementProof();
    const tx = await Mina.transaction(deployer, async () => {
      await market.settle(proof);
    });
    await tx.prove();
    const sent = await tx.sign([deployerKey]).send();
    console.log(
      ` Offchain settle (Market ${marketAddress58.slice(0, 10)}...): ${sent.hash || 'pending'}`
    );
    return true;
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('No actions') && !msg.includes('empty') && !msg.includes('no actions')) {
      console.log(
        ` Offchain settle (Market ${marketAddress58.slice(0, 10)}...): ${msg}`
      );
    }
    return false;
  }
}

/**
 * Periodic runner: settles registry and all known markets.
 * Default interval: 120 seconds (tune if needed).
 */
export function startOffchainSettler(intervalMs = 120_000) {
  initNetwork();
  console.log('\n Offchain settler started');
  console.log(`   Interval: ${Math.floor(intervalMs / 1000)}s`);

  const timer = setInterval(async () => {
    try {
      // 1) Registry first (metadata + status updates)
      await settleRegistryOffchainState();

      // 2) Each market in Redis
      const markets = await redis.getAllMarkets();
      for (const m of markets) {
        try {
          await settlePredictionMarketOffchainState(m.marketAddress);
          // small spacing between calls
          await new Promise((r) => setTimeout(r, 300));
        } catch (err: any) {
          console.warn(
            `  Offchain settle failed for market #${m.marketId}: ${err?.message || err}`
          );
        }
      }
    } catch (err: any) {
      console.error(' Offchain settler cycle error:', err?.message || err);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
