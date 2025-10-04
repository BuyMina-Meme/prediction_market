/**
 * Market Deployer Service
 *
 * Handles programmatic deployment of prediction markets
 */
import { PrivateKey, PublicKey, Mina, Field, UInt64, fetchAccount, AccountUpdate } from 'o1js';
import { config, getDeployerKeypair, getRegistryAddress } from '../config.js';
import { redis } from './redis-client.js';
import { updateGlobalMarketsIPFS } from './pinata-client.js';
// Import compiled contracts from local contracts package
// Assumes `npm run build` has been run in market/contracts
// and backend is executed from repository root structure
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket, MarketRegistry } from '../../contracts/build/src/index.js';
// Asset names mapping
const ASSET_NAMES = [
    'MINA', 'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC', 'LINK', 'DOGE'
];
/**
 * Initialize network connection
 */
let networkInitialized = false;
async function initNetwork() {
    if (networkInitialized)
        return;
    if (config.localMode) {
        const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
        Mina.setActiveInstance(Local);
    }
    else {
        const Network = Mina.Network({
            mina: config.zekoNetworkUrl,
            archive: config.zekoNetworkUrl,
        });
        Mina.setActiveInstance(Network);
    }
    networkInitialized = true;
}
/**
 * Deploy a new prediction market
 */
export async function deployMarket(request) {
    try {
        console.log(`\n🏗️  Deploying market for ${ASSET_NAMES[request.assetIndex]}...`);
        // Initialize network
        await initNetwork();
        // Get deployer keypair
        const { privateKey: deployerKey, publicKey: deployer } = getDeployerKeypair();
        // Get registry address
        const registryAddress = getRegistryAddress();
        // Verify deployer balance
        if (!config.localMode) {
            await fetchAccount({ publicKey: deployer });
        }
        const balance = Mina.getBalance(deployer).toBigInt();
        console.log(`   Deployer balance: ${Number(balance) / 1e9} MINA`);
        if (balance < BigInt(1e9)) {
            throw new Error('Insufficient deployer balance (need at least 1 MINA)');
        }
        // 1) Generate market keypair
        const marketKey = PrivateKey.random();
        const marketAddress = marketKey.toPublicKey();
        // 2) Instantiate contracts
        const market = new PredictionMarket(marketAddress);
        const registry = new MarketRegistry(registryAddress);
        // 3) Deploy and initialize market
        const assetIndexField = Field(request.assetIndex);
        const thresholdField = Field(BigInt(request.priceThreshold));
        const endTime = UInt64.from(request.endTimestamp);
        const creator = PublicKey.fromBase58(request.creator);
        // Burn address: Use registry for now (TODO: create dedicated burn address)
        const burnAddress = registryAddress;
        // Registry receives 40% of fees as treasury
        const registryAddressFees = registryAddress;
        // Deploy contract only (without initialize - creator will call that from UI)
        const deployTx = await Mina.transaction(deployer, async () => {
            AccountUpdate.fundNewAccount(deployer);
            await market.deploy();
            // NOTE: initialize() NOT called here - requires creator's signature for deposit
            // Creator must call initialize() from UI with Auro Wallet to pay 10 MINA deposit
        });
        await deployTx.prove();
        const deploySent = await deployTx.sign([deployerKey, marketKey]).send();
        const txHash = deploySent.hash || undefined;
        // 4) Register in MarketRegistry (owner must be deployer)
        // Use endTimestamp as Field for registry record
        const endTimestampField = Field(request.endTimestamp);
        let marketIdField;
        const registerTx = await Mina.transaction(deployer, async () => {
            marketIdField = await registry.registerMarket(marketAddress, creator, assetIndexField, endTimestampField);
        });
        await registerTx.prove();
        await registerTx.sign([deployerKey]).send();
        const marketId = Number(marketIdField.toBigInt());
        // 5) Persist in Redis with PENDING status (not ACTIVE until initialized)
        const initParams = {
            assetIndex: request.assetIndex,
            priceThreshold: request.priceThreshold,
            endTimestamp: request.endTimestamp,
            burnAddress: burnAddress.toBase58(),
            registryAddress: registryAddressFees.toBase58(),
        };
        const marketData = {
            marketId,
            marketAddress: marketAddress.toBase58(),
            creator: request.creator,
            assetIndex: request.assetIndex,
            assetName: ASSET_NAMES[request.assetIndex],
            priceThreshold: request.priceThreshold,
            endTimestamp: request.endTimestamp,
            status: 'PENDING_INIT', // Not ACTIVE until creator calls initialize()
            createdAt: new Date().toISOString(),
            initParams, // Store for later UI initialization
        };
        await redis.saveMarket(marketData);
        // 6) Update global markets on IPFS
        try {
            const allMarkets = await redis.getAllMarkets();
            const oldCID = await redis.getGlobalMarketsCID();
            const newCID = await updateGlobalMarketsIPFS(allMarkets, oldCID);
            await redis.setGlobalMarketsCID(newCID);
            console.log(`   📦 Updated global markets IPFS: ${newCID}`);
        }
        catch (error) {
            console.warn(`   ⚠️  IPFS update failed (non-critical):`, error.message);
            // Don't fail the entire deployment if IPFS fails
        }
        console.log(`   ✅ Deployed market #${marketId} at ${marketAddress.toBase58()}`);
        console.log(`   ⚠️  Market requires initialization by creator (10 MINA deposit)`);
        return {
            success: true,
            marketId,
            marketAddress: marketAddress.toBase58(),
            txHash,
            initParams, // Return initialization parameters for UI to call initialize()
        };
    }
    catch (error) {
        console.error('   ❌ Deployment failed:', error.message);
        return {
            success: false,
            error: error.message,
        };
    }
}
/**
 * Validate market creation request
 */
export function validateMarketRequest(request) {
    const errors = [];
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
    }
    catch (e) {
        errors.push('Invalid price threshold format');
    }
    // Validate end timestamp
    const now = Date.now();
    const endTime = request.endTimestamp;
    const minEndTime = now + 24 * 60 * 60 * 1000; // 1 day from now
    const maxEndTime = now + 7 * 24 * 60 * 60 * 1000; // 7 days from now
    if (endTime < minEndTime) {
        errors.push('Market must run for at least 1 day');
    }
    if (endTime > maxEndTime) {
        errors.push('Market cannot run for more than 7 days');
    }
    // Validate creator address
    try {
        PublicKey.fromBase58(request.creator);
    }
    catch (e) {
        errors.push('Invalid creator address');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Get all markets
 */
export async function getAllMarkets() {
    return await redis.getAllMarkets();
}
/**
 * Get specific market
 */
export async function getMarket(marketId) {
    return await redis.getMarket(marketId);
}
/**
 * Get active markets
 */
export async function getActiveMarkets() {
    return await redis.getActiveMarkets();
}
//# sourceMappingURL=market-deployer.js.map