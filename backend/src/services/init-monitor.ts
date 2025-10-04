/**
 * Initialization Monitor Service
 *
 * Monitors PENDING_INIT markets and promotes them to ACTIVE
 * once on-chain state confirms successful initialize() call.
 *
 * NEVER FAILS - Uses deterministic on-chain verification.
 */

import { Mina, PublicKey, fetchAccount } from 'o1js';
import { config, getRegistryAddress } from '../config.js';
import { redis } from './redis-client.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket, MarketRegistry, MARKET_STATUS } from '../../contracts/build/src/index.js';
import { INITIAL_POOL_AMOUNT, CREATOR_DEPOSIT } from '../../contracts/build/src/types/index.js';

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
 * Verify if a market has been successfully initialized on-chain
 *
 * Deterministic checks:
 * 1. yesPool === INITIAL_POOL_AMOUNT (0.5 MINA)
 * 2. noPool === INITIAL_POOL_AMOUNT (0.5 MINA)
 * 3. endTime > 0 and > current time
 * 4. (Optional) Contract balance >= CREATOR_DEPOSIT (10 MINA)
 */
async function verifyMarketInitialized(marketAddress58: string): Promise<boolean> {
  try {
    const marketAddress = PublicKey.fromBase58(marketAddress58);
    const market = new PredictionMarket(marketAddress);

    // Fetch account and state
    await fetchAccount({ publicKey: marketAddress });

    // Read on-chain state
    const yesPool = await market.yesPool.fetch();
    const noPool = await market.noPool.fetch();
    const endTime = await market.endTime.fetch();

    // Verify all conditions
    const poolsInitialized =
      yesPool?.toString() === INITIAL_POOL_AMOUNT.toString() &&
      noPool?.toString() === INITIAL_POOL_AMOUNT.toString();

    const endTimeValid =
      endTime &&
      Number(endTime.toBigInt()) > 0 &&
      Number(endTime.toBigInt()) > Date.now();

    if (!poolsInitialized) {
      console.log(`       Pools not initialized (yesPool: ${yesPool?.toString()}, noPool: ${noPool?.toString()})`);
      return false;
    }

    if (!endTimeValid) {
      console.log(`       endTime invalid (${endTime?.toBigInt()})`);
      return false;
    }

    // Optional: Check contract balance (extra safety)
    const account = Mina.getAccount(marketAddress);
    const balance = account.balance.toBigInt();
    const minBalance = CREATOR_DEPOSIT.toBigInt();

    if (balance < minBalance) {
      console.log(`        Contract balance (${balance}) < expected (${minBalance})`);
      // Don't fail on this - balance check is optional
    }

    console.log(`       All initialization checks passed`);
    console.log(`         yesPool: ${yesPool?.toString()} nanomina`);
    console.log(`         noPool: ${noPool?.toString()} nanomina`);
    console.log(`         endTime: ${new Date(Number(endTime.toBigInt())).toISOString()}`);
    console.log(`         balance: ${balance} nanomina`);

    return true;

  } catch (error) {
    console.error(`       Error verifying market initialization:`, error);
    return false;
  }
}

/**
 * Update market status to ACTIVE in both Redis and Registry
 * Also syncs pool sizes from on-chain state
 */
async function activateMarket(marketId: number, marketAddress58: string): Promise<void> {
  console.log(`       Activating market #${marketId}...`);

  // Sync pool sizes from on-chain state
  try {
    const marketAddress = PublicKey.fromBase58(marketAddress58);
    const market = new PredictionMarket(marketAddress);

    const yesPool = await market.yesPool.fetch();
    const noPool = await market.noPool.fetch();

    // Update Redis with status AND pool sizes
    const marketData = await redis.getMarket(marketId);
    if (marketData) {
      marketData.status = 'ACTIVE';
      marketData.yesPool = yesPool?.toString();
      marketData.noPool = noPool?.toString();
      await redis.saveMarket(marketData);
      console.log(`       Redis updated: status=ACTIVE, yesPool=${yesPool?.toString()}, noPool=${noPool?.toString()}`);
    } else {
      console.warn(`        Market ${marketId} not found in Redis, only updating status`);
      await redis.updateMarketStatus(marketId, 'ACTIVE');
    }
  } catch (error) {
    console.error(`       Failed to sync pool sizes:`, error);
    // Fallback: just update status
    await redis.updateMarketStatus(marketId, 'ACTIVE');
    console.log(`       Redis status updated to ACTIVE (pool sync failed)`);
  }

  // Optional: Update Registry on-chain (requires owner signature + fee)
  // Uncomment if you want on-chain lifecycle tracking
  /*
  try {
    const { privateKey: deployerKey, publicKey: deployer } = getDeployerKeypair();
    const registry = new MarketRegistry(getRegistryAddress());

    const tx = await Mina.transaction(deployer, async () => {
      await registry.updateMarketStatus(Field(marketId), MARKET_STATUS.ACTIVE);
    });
    await tx.prove();
    const sentTx = await tx.sign([deployerKey]).send();
    console.log(`       Registry updated on-chain: ${sentTx.hash || 'pending'}`);
  } catch (error) {
    console.warn(`        Failed to update registry on-chain:`, error);
    // Don't fail - Redis update is sufficient
  }
  */
}

/**
 * Initialization Monitor
 *
 * Periodically checks PENDING_INIT markets and promotes to ACTIVE
 * when on-chain state confirms initialization.
 */
export async function startInitMonitor() {
  initNetwork();

  console.log('\n INITIALIZATION MONITOR STARTED');
  console.log(`   Check interval: ${config.settlement.checkInterval / 1000}s`);
  console.log(`   Detection method: On-chain state verification\n`);

  const intervalId = setInterval(async () => {
    try {
      const allMarkets = await redis.getAllMarkets();
      const pendingInit = allMarkets.filter(m => m.status === 'PENDING_INIT');

      if (pendingInit.length === 0) {
        return; // Silent when no pending markets
      }

      console.log(`\n Init check: ${pendingInit.length} market(s) pending initialization`);

      for (const market of pendingInit) {
        const marketId = Number(market.marketId);
        console.log(`\n    Checking Market #${marketId} (${market.marketAddress.slice(0, 12)}...)`);

        const isInitialized = await verifyMarketInitialized(market.marketAddress);

        if (isInitialized) {
          try {
            await activateMarket(marketId, market.marketAddress);
            console.log(`    Market #${marketId} activated!\n`);
          } catch (error) {
            console.error(`    Failed to activate market #${marketId}:`, error);
          }
        } else {
          console.log(`    Market #${marketId} not yet initialized on-chain\n`);
        }
      }

    } catch (error) {
      console.error('\n Init monitor error:', (error as any)?.message || error);
    }
  }, config.settlement.checkInterval);

  return () => clearInterval(intervalId);
}

/**
 * Manual initialization check for a specific market
 */
export async function manuallyCheckInit(marketId: number): Promise<boolean> {
  console.log(`\n MANUAL INIT CHECK for Market #${marketId}`);

  initNetwork();

  const market = await redis.getMarket(marketId);

  if (!market) {
    console.error(`    Market #${marketId} not found in Redis`);
    return false;
  }

  if (market.status !== 'PENDING_INIT') {
    console.log(`     Market #${marketId} status is ${market.status}, not PENDING_INIT`);
    return false;
  }

  const isInitialized = await verifyMarketInitialized(market.marketAddress);

  if (isInitialized) {
    await activateMarket(marketId, market.marketAddress);
    console.log(`    Market #${marketId} activated!`);
    return true;
  } else {
    console.log(`    Market #${marketId} not yet initialized on-chain`);
    return false;
  }
}
