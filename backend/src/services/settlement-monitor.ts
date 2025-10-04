/**
 * Settlement Monitoring Service
 *
 * Watches for markets past endTime and triggers settlement
 * after the first Doot oracle update observed post endTime.
 */

import { Mina, PublicKey, Field } from 'o1js';
import { config, getDeployerKeypair, getDootOracleAddress, getRegistryAddress } from '../config.js';
import { redis } from './redis-client.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket, MarketRegistry, MARKET_STATUS } from '../../contracts/build/src/index.js';

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

async function getDootCommitment(): Promise<string | null> {
  try {
    const dootAddress = getDootOracleAddress();
    // Minimal contract instance just to read state
    const { Doot } = await import('../../contracts/build/src/utils/DootOracle.js');
    const doot = new Doot(dootAddress);
    const c = await doot.offchainStateCommitments.fetch();
    return c?.toString() ?? null;
  } catch (e) {
    console.error('     Failed to fetch Doot commitment:', (e as any)?.message || e);
    return null;
  }
}

async function trySettleMarket(marketId: number, marketAddress58: string) {
  console.log(`\n Settling Market #${marketId}...`);

  const { privateKey: deployerKey, publicKey: deployer } = getDeployerKeypair();
  const dootAddress = getDootOracleAddress();

  const marketAddress = PublicKey.fromBase58(marketAddress58);
  const market = new PredictionMarket(marketAddress);

  // Fire settlement transaction which reads Doot on-chain prices
  console.log(`    Calling settleWithDoot() on market ${marketAddress58.slice(0, 12)}...`);
  const tx = await Mina.transaction(deployer, async () => {
    await market.settleWithDoot(dootAddress);
  });
  await tx.prove();
  const sentTx = await tx.sign([deployerKey]).send();
  console.log(`    Settlement tx sent: ${sentTx.hash || 'pending'}`);

  // Fetch the outcome from the contract
  const statusField = await market.status.fetch();
  const outcomeValue = statusField?.toString();
  let outcome: 'YES' | 'NO' | 'PENDING' = 'PENDING';

  if (outcomeValue === '1') {
    outcome = 'YES';
    console.log(`    Outcome: YES won!`);
  } else if (outcomeValue === '2') {
    outcome = 'NO';
    console.log(`    Outcome: NO won!`);
  }

  // Mark as settled in registry (owner-only)
  console.log(`    Updating registry status to SETTLED...`);
  const registry = new MarketRegistry(getRegistryAddress());
  const tx2 = await Mina.transaction(deployer, async () => {
    await registry.updateMarketStatus(Field(marketId), MARKET_STATUS.SETTLED);
  });
  await tx2.prove();
  const sentTx2 = await tx2.sign([deployerKey]).send();
  console.log(`    Registry update tx sent: ${sentTx2.hash || 'pending'}`);

  // Update cache with outcome
  await redis.updateMarketStatus(marketId, 'SETTLED', outcome);
  await redis.removePendingSettlement(marketId);

  console.log(`    Market #${marketId} settled successfully! Deployer earned 9 MINA.\n`);
}

export async function startSettlementMonitor() {
  initNetwork();

  console.log(`   Check interval: ${config.settlement.checkInterval / 1000}s`);
  console.log(`   Watching for markets past endTime...\n`);

  // Periodically check for settleable markets
  const intervalId = setInterval(async () => {
    try {
      const awaiting = await redis.getMarketsAwaitingSettlement();

      if (awaiting.length === 0) {
        // Silent when no markets are awaiting
        return;
      }

      const now = Date.now();
      const currentCommitment = await getDootCommitment();

      console.log(` Settlement check: ${awaiting.length} market(s) awaiting settlement`);
      if (currentCommitment) {
        console.log(`   Current Doot commitment: ${currentCommitment.slice(0, 20)}...`);
      }

      for (const m of awaiting) {
        const marketId = Number(m.marketId);

        // If not tracked yet, capture current Doot commitment snapshot and add to pending
        const pending = await redis.get(`doot:commitmentAtDetection:${marketId}`);
        if (!pending) {
          if (currentCommitment) {
            console.log(`    Tracking Market #${marketId} - awaiting Doot update...`);
            await redis.setWithTTL(`doot:commitmentAtDetection:${marketId}`, currentCommitment, 7 * 24 * 60 * 60);
            await redis.addPendingSettlement(marketId);
          }
          continue;
        }

        // If Doot commitment changed since detection and market is past endTime, settle
        if (currentCommitment && currentCommitment !== pending && now >= Number(m.endTimestamp)) {
          console.log(`    Doot commitment changed! Settling Market #${marketId}...`);
          await trySettleMarket(marketId, m.marketAddress);
        }
      }
    } catch (e) {
      // Log and continue
      console.error(' Settlement monitor error:', (e as any)?.message || e);
    }
  }, config.settlement.checkInterval);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
