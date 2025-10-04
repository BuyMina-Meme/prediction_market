/**
 * Programmatic Market Deployment (for backend service)
 *
 * This module exports functions to deploy prediction markets
 * programmatically from the backend service.
 */

import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Field,
  UInt64,
  fetchAccount,
} from 'o1js';
import { PredictionMarket, predictionMarketOffchainState } from '../contracts/PredictionMarket.js';
import { MarketRegistry } from '../contracts/MarketRegistry.js';

export interface MarketDeployConfig {
  assetIndex: number; // 0-9 (MINA, BTC, ETH, SOL, XRP, ADA, AVAX, MATIC, LINK, DOGE)
  priceThreshold: bigint; // Threshold price in Doot format (price * 10^10)
  endTimestamp: number; // Unix timestamp (milliseconds)
  creator: string; // Base58 public key of market creator
}

export interface MarketDeployResult {
  success: boolean;
  marketAddress?: string;
  marketId?: number;
  txHash?: string;
  error?: string;
}

/**
 * Deploy a new prediction market
 *
 * @param config Market configuration
 * @param deployerKey Private key for deploying (must be funded)
 * @param registryAddress Address of deployed MarketRegistry
 * @param networkUrl Zeko L2 network URL
 * @returns Deployment result
 */
export async function deployMarket(
  config: MarketDeployConfig,
  deployerKey: PrivateKey,
  registryAddress: PublicKey,
  networkUrl = 'https://devnet.zeko.io/graphql'
): Promise<MarketDeployResult> {
  try {
    console.log(`\n  Deploying market for asset index ${config.assetIndex}...`);

    // Setup network
    const Network = Mina.Network({
      mina: networkUrl,
      archive: networkUrl,
    });
    Mina.setActiveInstance(Network);

    const deployer = deployerKey.toPublicKey();

    // Verify deployer balance
    await fetchAccount({ publicKey: deployer });
    const balance = Mina.getBalance(deployer).toBigInt();
    if (balance < BigInt(1e9)) {
      return {
        success: false,
        error: 'Insufficient deployer balance (need at least 1 MINA)',
      };
    }

    // Generate market contract keypair
    const marketKey = PrivateKey.random();
    const marketAddress = marketKey.toPublicKey();

    console.log(`   Market address: ${marketAddress.toBase58()}`);

    // Compile if not already compiled (should be cached)
    console.log('   Ensuring contracts are compiled...');
    await predictionMarketOffchainState.compile();
    await PredictionMarket.compile();

    // Deploy market contract
    console.log('   Deploying PredictionMarket contract...');
    const market = new PredictionMarket(marketAddress);

    const deployTx = await Mina.transaction(
      { sender: deployer, fee: 0.1 * 1e9 },
      async () => {
        AccountUpdate.fundNewAccount(deployer);
        await market.deploy();
      }
    );

    await deployTx.prove();
    await deployTx.sign([deployerKey, marketKey]).send();

    console.log('    Market contract deployed');

    // Initialize market with config
    console.log('   Initializing market...');
    const creatorPublicKey = PublicKey.fromBase58(config.creator);

    const initTx = await Mina.transaction(
      { sender: deployer, fee: 0.1 * 1e9 },
      async () => {
        // Use deployer as burn and registry address (can be updated later)
        await market.initialize(
          Field(config.assetIndex),
          Field(config.priceThreshold),
          UInt64.from(config.endTimestamp),
          creatorPublicKey,
          deployer, // burnAddress
          deployer  // registryAddress
        );
      }
    );

    await initTx.prove();
    const initResult = await initTx.sign([deployerKey]).send();

    console.log('    Market initialized');

    // Register market in registry
    console.log('   Registering market in MarketRegistry...');
    const registry = new MarketRegistry(registryAddress);

    const registerTx = await Mina.transaction(
      { sender: deployer, fee: 0.1 * 1e9 },
      async () => {
        await registry.registerMarket(
          marketAddress,
          creatorPublicKey,
          Field(config.assetIndex),
          Field(config.endTimestamp)
        );
      }
    );

    await registerTx.prove();
    const registerResult = await registerTx.sign([deployerKey]).send();

    console.log('    Market registered\n');

    // Get market ID from registry
    const marketCountField = await registry.marketCount.fetch();
    const marketId = marketCountField ? Number(marketCountField.toBigInt()) - 1 : 0;

    return {
      success: true,
      marketAddress: marketAddress.toBase58(),
      marketId,
      txHash: registerResult.hash,
    };
  } catch (error: any) {
    console.error('    Deployment failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Batch deploy multiple markets
 */
export async function deployMarkets(
  configs: MarketDeployConfig[],
  deployerKey: PrivateKey,
  registryAddress: PublicKey,
  networkUrl?: string
): Promise<MarketDeployResult[]> {
  const results: MarketDeployResult[] = [];

  for (const config of configs) {
    const result = await deployMarket(config, deployerKey, registryAddress, networkUrl);
    results.push(result);

    // Wait between deployments to avoid network issues
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return results;
}

/**
 * Deploy market from CLI args (for manual testing)
 */
export async function deployMarketCLI() {
  const args = process.argv.slice(2);

  if (args.length < 5) {
    console.log('Usage: node deploy-market-programmatic.js <assetIndex> <priceThreshold> <endTimestamp> <creatorAddress> <deployerKeyPath>');
    console.log('\nExample:');
    console.log('  node deploy-market-programmatic.js 2 "34000000000000" 1735689600000 B62qod2DugDj... keys/deployer.json');
    process.exit(1);
  }

  const [assetIndex, priceThreshold, endTimestamp, creator, keyPath] = args;

  // Load deployer key
  const fs = await import('fs');
  const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  const deployerKey = PrivateKey.fromBase58(keyData.privateKey);

  // Load registry address from deployment
  const deploymentPath = 'deployments/zeko-devnet-registry.json';
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const registryAddress = PublicKey.fromBase58(deployment.address);

  const result = await deployMarket(
    {
      assetIndex: parseInt(assetIndex),
      priceThreshold: BigInt(priceThreshold),
      endTimestamp: parseInt(endTimestamp),
      creator,
    },
    deployerKey,
    registryAddress
  );

  if (result.success) {
    console.log(' Market deployed successfully!');
    console.log(`   Address: ${result.marketAddress}`);
    console.log(`   Market ID: ${result.marketId}`);
    console.log(`   Tx Hash: ${result.txHash}`);
  } else {
    console.error(' Deployment failed:', result.error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployMarketCLI();
}
