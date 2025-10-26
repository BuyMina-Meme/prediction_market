/**
 * Pool Synchronization Service
 *
 * Periodically reads on-chain pool sizes and syncs them to Redis
 * for accurate UI display.
 */

import { Mina, PublicKey, fetchAccount } from 'o1js';
import { config } from '../config.js';
import { redis } from './redis-client.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket } from '../../../contracts/build/src/index.js';

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
 * Sync pool sizes for a single market
 */
async function syncMarketPools(marketId: number, marketAddress58: string): Promise<boolean> {
  try {
    const marketAddress = PublicKey.fromBase58(marketAddress58);
    const market = new PredictionMarket(marketAddress);

    await fetchAccount({ publicKey: marketAddress });

    const yesPool = await market.yesPool.fetch();
    const noPool = await market.noPool.fetch();

    if (!yesPool || !noPool) {
      console.warn(`        Failed to fetch pools for market #${marketId}`);
      return false;
    }

    // Update Redis
    const marketData = await redis.getMarket(marketId);
    if (marketData) {
      marketData.yesPool = yesPool.toString();
      marketData.noPool = noPool.toString();
      await redis.saveMarket(marketData);
      console.log(`       Market #${marketId} pools synced: YES=${yesPool.toString()}, NO=${noPool.toString()}`);
      return true;
    } else {
      console.warn(`        Market #${marketId} not found in Redis`);
      return false;
    }

  } catch (error) {
    console.error(`       Error syncing pools for market #${marketId}:`, error);
    return false;
  }
}

/**
 * Pool Sync Monitor
 *
 * Periodically syncs pool sizes for all ACTIVE markets
 */
export async function startPoolSync() {
  initNetwork();

  console.log('\n POOL SYNC SERVICE STARTED');
  console.log(`   Check interval: ${config.settlement.checkInterval / 1000}s`);
  console.log(`   Syncs pool sizes for ACTIVE markets\n`);

  const intervalId = setInterval(async () => {
    try {
      const activeMarkets = await redis.getActiveMarkets();

      if (activeMarkets.length === 0) {
        return; // Silent when no active markets
      }

      console.log(`\n Pool sync: ${activeMarkets.length} active market(s)`);

      let synced = 0;
      for (const market of activeMarkets) {
        const success = await syncMarketPools(Number(market.marketId), market.marketAddress);
        if (success) synced++;
      }

      console.log(`    Synced ${synced}/${activeMarkets.length} markets\n`);

    } catch (error) {
      console.error('\n Pool sync error:', (error as any)?.message || error);
    }
  }, config.settlement.checkInterval);

  return () => clearInterval(intervalId);
}

/**
 * Manual pool sync for a specific market
 */
export async function manuallySyncPools(marketId: number): Promise<boolean> {
  console.log(`\n MANUAL POOL SYNC for Market #${marketId}`);

  initNetwork();

  const market = await redis.getMarket(marketId);

  if (!market) {
    console.error(`    Market #${marketId} not found in Redis`);
    return false;
  }

  const success = await syncMarketPools(marketId, market.marketAddress);

  if (success) {
    console.log(`    Pool sync complete!`);
  } else {
    console.log(`    Pool sync failed`);
  }

  return success;
}
