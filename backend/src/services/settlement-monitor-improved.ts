/**
 * IMPROVED Settlement Monitoring Service
 *
 * Uses Zeko GraphQL Actions API to detect Doot settlements.
 * This is the CORRECT way to monitor off-chain state updates.
 */

import { Mina, PublicKey, Field } from 'o1js';
import { config, getDeployerKeypair, getDootOracleAddress, getRegistryAddress } from '../config.js';
import { redis } from './redis-client.js';
import { detectDootSettlementAfterTime, waitForDootSettlement, DootSettlement } from './doot-settlement-detector.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket, MarketRegistry, MARKET_STATUS } from '../../../contracts/build/src/index.js';

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

/**
 * Settle a prediction market using Doot oracle
 */
async function settleMarket(marketId: number, marketAddress58: string) {
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

/**
 * IMPROVED Settlement Monitor with GraphQL Actions API
 */
export async function startImprovedSettlementMonitor() {
  initNetwork();

  console.log('\n IMPROVED SETTLEMENT MONITOR STARTED');
  console.log(`   Check interval: ${config.settlement.checkInterval / 1000}s`);
  console.log(`   Detection method: Zeko GraphQL Actions API`);
  console.log(`   Watching for markets past endTime...\n`);

  const dootAddress = getDootOracleAddress().toBase58();

  // Periodically check for settleable markets
  const intervalId = setInterval(async () => {
    try {
      const awaiting = await redis.getMarketsAwaitingSettlement();

      if (awaiting.length === 0) {
        // Silent when no markets are awaiting
        return;
      }

      const now = Date.now();

      console.log(`\n Settlement check: ${awaiting.length} market(s) awaiting settlement`);

      for (const m of awaiting) {
        const marketId = Number(m.marketId);
        const endTime = Number(m.endTimestamp);

        // Only check markets that have already ended
        if (now < endTime) {
          console.log(`    Market #${marketId} not yet ended (ends in ${Math.floor((endTime - now) / 60000)}min)`);
          continue;
        }

        console.log(`\n    Checking Market #${marketId}...`);

        // Check if we have a baseline action state for this market
        const baselineActionState = await redis.get(`doot:actionStateAtEnd:${marketId}`);

        if (!baselineActionState) {
          // First time checking this market - check if Doot already settled after market end
          console.log(`       First check - looking for post-end settlement...`);

          const latestSettlement = await detectDootSettlementAfterTime(
            endTime,
            dootAddress
          );

          if (latestSettlement) {
            // Found a post-end action! Settle immediately instead of waiting for next cycle
            console.log(`       POST-END SETTLEMENT DETECTED ON FIRST CHECK!`);
            console.log(`      Action state: ${latestSettlement.actionStateOne.slice(0, 20)}...`);
            console.log(`      Action timestamp: ${new Date(latestSettlement.timestamp).toISOString()}`);
            console.log(`      Market end: ${new Date(endTime).toISOString()}`);
            console.log(`      Settling prediction market immediately...`);

            try {
              await settleMarket(marketId, m.marketAddress);
              // No need to set baseline - market is settled
            } catch (error) {
              console.error(`       Failed to settle market #${marketId}:`, error);
              // Set baseline so we can retry on next cycle
              await redis.setWithTTL(
                `doot:actionStateAtEnd:${marketId}`,
                latestSettlement.actionStateOne,
                7 * 24 * 60 * 60  // 7 days TTL
              );
            }
          } else {
            console.log(`       No post-end settlement yet, will check again next cycle`);
          }

          continue;
        }

        // Check if Doot has settled since baseline
        console.log(`       Checking for new Doot settlement...`);
        console.log(`      Baseline: ${baselineActionState.slice(0, 20)}...`);

        const newSettlement = await detectDootSettlementAfterTime(
          endTime,
          dootAddress,
          baselineActionState
        );

        if (newSettlement) {
          console.log(`       NEW DOOT SETTLEMENT DETECTED!`);
          console.log(`      New action state: ${newSettlement.actionStateOne.slice(0, 20)}...`);
          console.log(`      Settling prediction market...`);

          try {
            await settleMarket(marketId, m.marketAddress);

            // Clean up baseline after successful settlement
            await redis.del(`doot:actionStateAtEnd:${marketId}`);

          } catch (error) {
            console.error(`       Failed to settle market #${marketId}:`, error);
            // Don't remove baseline - will retry next cycle
          }
        } else {
          console.log(`       Waiting for Doot settlement...`);
        }
      }

    } catch (e) {
      // Log and continue
      console.error('\n Settlement monitor error:', (e as any)?.message || e);
    }
  }, config.settlement.checkInterval);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

/**
 * One-time settlement check for a specific market (manual trigger)
 */
export async function manuallySettleMarket(marketId: number): Promise<boolean> {
  console.log(`\n MANUAL SETTLEMENT TRIGGER for Market #${marketId}`);

  initNetwork();

  const market = await redis.getMarket(marketId);

  if (!market) {
    console.error(`    Market #${marketId} not found in Redis`);
    return false;
  }

  if (market.status === 'SETTLED') {
    console.log(`     Market #${marketId} already settled`);
    return false;
  }

  const now = Date.now();
  const endTime = Number(market.endTimestamp);

  if (now < endTime) {
    console.error(`    Market has not ended yet (ends in ${Math.floor((endTime - now) / 60000)}min)`);
    return false;
  }

  console.log(`   Waiting for Doot settlement (max 10 minutes)...`);

  const dootAddress = getDootOracleAddress().toBase58();

  try {
    // Wait up to 10 minutes for Doot settlement (20 attempts x 30s = 10min)
    const dootSettlement = await waitForDootSettlement(
      endTime,
      dootAddress,
      20,  // maxAttempts
      30000  // 30s interval
    );

    console.log(`    Doot settlement confirmed!`);
    console.log(`      Action state: ${dootSettlement.actionStateOne.slice(0, 20)}...`);

    // Settle the prediction market
    await settleMarket(marketId, market.marketAddress);

    return true;

  } catch (error) {
    console.error(`    Timeout waiting for Doot settlement:`, error);
    return false;
  }
}

export { detectDootSettlementAfterTime, waitForDootSettlement };
