/**
 * Market Status Monitor Service
 *
 * Automatically transitions market status based on time:
 * - ACTIVE → LOCKED (T-30min before end)
 * - LOCKED → AWAITING (at endTime)
 *
 * Ensures UI reflects contract-enforced betting restrictions.
 */

import { config } from '../config.js';
import { redis } from './redis-client.js';

const LOCKOUT_PERIOD_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Check and update market statuses based on current time
 */
async function updateMarketStatuses() {
  try {
    const allMarkets = await redis.getAllMarkets();
    const now = Date.now();

    let transitioned = 0;

    for (const market of allMarkets) {
      const endTime = Number(market.endTimestamp);
      const lockoutStart = endTime - LOCKOUT_PERIOD_MS; // T-30min

      // ACTIVE → LOCKED (entering lockout period)
      if (market.status === 'ACTIVE' && now >= lockoutStart && now < endTime) {
        await redis.updateMarketStatus(Number(market.marketId), 'LOCKED');
        console.log(`    Market #${market.marketId} → LOCKED (entered lockout period)`);
        transitioned++;
      }

      // LOCKED → AWAITING (market ended, waiting for settlement)
      else if (market.status === 'LOCKED' && now >= endTime) {
        await redis.updateMarketStatus(Number(market.marketId), 'AWAITING');
        console.log(`    Market #${market.marketId} → AWAITING (market ended)`);
        transitioned++;
      }

      // ACTIVE → AWAITING (rare case: market ended while we weren't checking)
      else if (market.status === 'ACTIVE' && now >= endTime) {
        await redis.updateMarketStatus(Number(market.marketId), 'AWAITING');
        console.log(`    Market #${market.marketId} → AWAITING (skipped LOCKED, market ended)`);
        transitioned++;
      }
    }

    if (transitioned > 0) {
      console.log(`    Transitioned ${transitioned} market(s)\n`);
    }

  } catch (error) {
    console.error(' Status monitor error:', (error as any)?.message || error);
  }
}

/**
 * Status Monitor Service
 *
 * Runs every check interval to update market statuses
 */
export async function startStatusMonitor() {
  console.log('\n STATUS MONITOR STARTED');
  console.log(`   Check interval: ${config.settlement.checkInterval / 1000}s`);
  console.log(`   Monitors: ACTIVE → LOCKED (T-30m), LOCKED → AWAITING (post-end)\n`);

  // Run immediately on startup
  await updateMarketStatuses();

  const intervalId = setInterval(async () => {
    await updateMarketStatuses();
  }, config.settlement.checkInterval);

  return () => clearInterval(intervalId);
}

/**
 * Manual status update for a specific market
 */
export async function manuallyUpdateStatus(marketId: number): Promise<boolean> {
  console.log(`\n MANUAL STATUS UPDATE for Market #${marketId}`);

  const market = await redis.getMarket(marketId);

  if (!market) {
    console.error(`    Market #${marketId} not found in Redis`);
    return false;
  }

  const now = Date.now();
  const endTime = Number(market.endTimestamp);
  const lockoutStart = endTime - LOCKOUT_PERIOD_MS;

  let updated = false;

  if (market.status === 'ACTIVE' && now >= lockoutStart && now < endTime) {
    await redis.updateMarketStatus(marketId, 'LOCKED');
    console.log(`    Status updated: ACTIVE → LOCKED`);
    updated = true;
  } else if ((market.status === 'LOCKED' || market.status === 'ACTIVE') && now >= endTime) {
    await redis.updateMarketStatus(marketId, 'AWAITING');
    console.log(`    Status updated: ${market.status} → AWAITING`);
    updated = true;
  } else {
    console.log(`   ℹ️  No status change needed (current: ${market.status})`);
    console.log(`      Now: ${new Date(now).toISOString()}`);
    console.log(`      Lockout starts: ${new Date(lockoutStart).toISOString()}`);
    console.log(`      Market ends: ${new Date(endTime).toISOString()}`);
  }

  return updated;
}
