/**
 * Market Deployer Service
 *
 * Handles programmatic deployment of prediction markets
 */

import { PrivateKey, PublicKey, Mina, Field, UInt64, fetchAccount, AccountUpdate } from 'o1js';
import { config, getDeployerKeypair, getRegistryAddress, getBurnAddress } from '../config.js';
import { redis, MarketData } from './redis-client.js';
import { updateGlobalMarketsIPFS } from './pinata-client.js';
// Import compiled contracts from local contracts package
// Assumes `npm run build` has been run in market/contracts
// and backend is executed from repository root structure
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket, MarketRegistry, ASSET_INDEX } from '../../../contracts/build/src/index.js';

// Asset names mapping
const ASSET_NAMES = [
  'MINA', 'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC', 'LINK', 'DOGE'
];

/**
 * V1 Protocol-Only Market Creation
 *
 * Markets are created and operated by the protocol, not individual users.
 * This simplifies economics and removes creator incentive misalignment.
 */
export interface MarketCreateRequest {
  assetIndex: number; // 0-9 (MINA, BTC, ETH, SOL, XRP, ADA, AVAX, MATIC, LINK, DOGE)
  priceThreshold: string; // In Doot format (price * 10^10)
  endTimestamp: number; // Unix milliseconds (1-30 days from now)
  // V1: No creator parameter - protocol-operated markets only
}

export interface MarketCreateResponse {
  success: boolean;
  marketId?: number;
  marketAddress?: string;
  txHash?: string;
  error?: string;
  // V1: No initParams - market is fully initialized by protocol on deployment
}

/**
 * Initialize network connection
 */
let networkInitialized = false;

async function initNetwork() {
  if (networkInitialized) return;
  if (config.localMode) {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
  } else {
    const Network = Mina.Network({
      mina: config.zekoNetworkUrl,
      archive: config.zekoNetworkUrl,
    });
    Mina.setActiveInstance(Network);
  }
  networkInitialized = true;
}

/**
 * V1: Deploy a new protocol-operated prediction market
 *
 * Changes from V0:
 * - Protocol is the creator (deployer address)
 * - Protocol pays 10 MINA deposit immediately
 * - Market is ACTIVE immediately (no PENDING_INIT state)
 * - Registry address receives 50% of fees (treasury)
 * - Burn address receives 50% of fees
 */
export async function deployMarket(
  request: MarketCreateRequest
): Promise<MarketCreateResponse> {
  try {
    console.log(`\n🚀 [V1] Deploying protocol-operated market for ${ASSET_NAMES[request.assetIndex]}...`);

    // Initialize network
    await initNetwork();

    // Get deployer keypair (protocol operator)
    const { privateKey: deployerKey, publicKey: deployer } = getDeployerKeypair();

    // Get addresses
    const registryAddress = getRegistryAddress();
    const burnAddress = getBurnAddress();

    // Verify deployer balance (need funds for 10 MINA deposit + account creation + fees)
    if (!config.localMode) {
      await fetchAccount({ publicKey: deployer });
    }
    const balance = Mina.getBalance(deployer).toBigInt();
    console.log(`   💰 Protocol balance: ${Number(balance) / 1e9} MINA`);

    const requiredBalance = 12e9; // 10 MINA deposit + 1 MINA account + 1 MINA fees
    if (balance < BigInt(requiredBalance)) {
      throw new Error(`Insufficient protocol balance (need at least 12 MINA, have ${Number(balance) / 1e9})`);
    }

    // 1) Generate market keypair
    const marketKey = PrivateKey.random();
    const marketAddress = marketKey.toPublicKey();

    // 2) Instantiate contracts
    const market = new PredictionMarket(marketAddress);
    const registry = new MarketRegistry(registryAddress);

    // 3) Deploy market contract
    console.log('   📝 Deploying PredictionMarket contract...');
    const deployTx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await market.deploy();
    });
    await deployTx.prove();
    const deploySent = await deployTx.sign([deployerKey, marketKey]).send();
    const txHash = deploySent.hash || undefined;
    console.log(`      ✓ Market deployed at ${marketAddress.toBase58()}`);

    // 4) Initialize market immediately (protocol pays 10 MINA deposit)
    console.log('   ⚙️  Initializing market (protocol-operated)...');
    const assetIndexField = Field(request.assetIndex);
    const thresholdField = Field(BigInt(request.priceThreshold));
    const endTime = UInt64.from(request.endTimestamp);

    const initTx = await Mina.transaction(deployer, async () => {
      await market.initialize(
        assetIndexField,
        thresholdField,
        endTime,
        deployer,        // creator = protocol (deployer)
        registryAddress, // treasury = registry address (50% fees)
        burnAddress      // burn = burn address (50% fees)
      );
    });
    await initTx.prove();
    await initTx.sign([deployerKey]).send();
    console.log('      ✓ Market initialized with 5 MINA YES + 5 MINA NO pools');

    // 5) Register in MarketRegistry
    console.log('   📋 Registering market in MarketRegistry...');
    const endTimestampField = Field(request.endTimestamp);
    let marketIdField: Field;
    const registerTx = await Mina.transaction(deployer, async () => {
      marketIdField = await registry.registerMarket(
        marketAddress,
        deployer,           // creator = protocol
        assetIndexField,
        endTimestampField
      );
    });
    await registerTx.prove();
    await registerTx.sign([deployerKey]).send();

    const marketId = Number(marketIdField!.toBigInt());
    console.log(`      ✓ Registered as market #${marketId}`);

    // 6) Persist in Redis with ACTIVE status (V1: immediately active)
    const marketData: MarketData = {
      marketId,
      marketAddress: marketAddress.toBase58(),
      creator: deployer.toBase58(), // V1: Protocol is creator
      assetIndex: request.assetIndex,
      assetName: ASSET_NAMES[request.assetIndex],
      priceThreshold: request.priceThreshold,
      endTimestamp: request.endTimestamp,
      status: 'ACTIVE', // V1: Immediately ACTIVE (not PENDING_INIT)
      createdAt: new Date().toISOString(),
      // V1: No initParams (already initialized)
    };
    await redis.saveMarket(marketData);

    // 7) Update global markets on IPFS
    try {
      const allMarkets = await redis.getAllMarkets();
      const oldCID = await redis.getGlobalMarketsCID();
      const newCID = await updateGlobalMarketsIPFS(allMarkets, oldCID);
      await redis.setGlobalMarketsCID(newCID);
      console.log(`   📌 Updated global markets IPFS: ${newCID}`);
    } catch (error: any) {
      console.warn(`   ⚠️  IPFS update failed (non-critical):`, error.message);
      // Don't fail the entire deployment if IPFS fails
    }

    console.log(`\n✅ Market #${marketId} deployed and active!`);
    console.log(`   Address: ${marketAddress.toBase58()}`);
    console.log(`   Asset: ${ASSET_NAMES[request.assetIndex]}`);
    console.log(`   Threshold: ${Number(request.priceThreshold) / 1e10}`);
    console.log(`   Duration: ${Math.floor((request.endTimestamp - Date.now()) / (24 * 60 * 60 * 1000))} days\n`);

    return {
      success: true,
      marketId,
      marketAddress: marketAddress.toBase58(),
      txHash,
    };

  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * V1: Validate protocol market creation request
 *
 * Changes from V0:
 * - No creator validation (protocol-operated)
 * - Updated duration: 1-30 days (was 1-7 days)
 */
export function validateMarketRequest(request: MarketCreateRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate asset index
  if (request.assetIndex < 0 || request.assetIndex > 9) {
    errors.push('Asset index must be between 0 and 9');
  }

  // Validate price threshold
  try {
    const threshold = BigInt(request.priceThreshold);
    if (threshold <= 0) {
      errors.push('Price threshold must be positive');
    }
  } catch (e) {
    errors.push('Invalid price threshold format');
  }

  // V1: Validate end timestamp (1-30 days)
  const now = Date.now();
  const endTime = request.endTimestamp;
  const minEndTime = now + 24 * 60 * 60 * 1000; // 1 day from now
  const maxEndTime = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

  if (endTime < minEndTime) {
    errors.push('Market must run for at least 1 day');
  }

  if (endTime > maxEndTime) {
    errors.push('Market cannot run for more than 30 days');
  }

  // V1: No creator validation (protocol-operated markets)

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all markets
 */
export async function getAllMarkets(): Promise<MarketData[]> {
  return await redis.getAllMarkets();
}

/**
 * Get specific market
 */
export async function getMarket(marketId: number): Promise<MarketData | null> {
  return await redis.getMarket(marketId);
}

/**
 * Get active markets
 */
export async function getActiveMarkets(): Promise<MarketData[]> {
  return await redis.getActiveMarkets();
}
