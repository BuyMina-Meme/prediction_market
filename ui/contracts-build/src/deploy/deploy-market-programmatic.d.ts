/**
 * Programmatic Market Deployment (for backend service)
 *
 * This module exports functions to deploy prediction markets
 * programmatically from the backend service.
 */
import { PrivateKey, PublicKey } from 'o1js';
export interface MarketDeployConfig {
    assetIndex: number;
    priceThreshold: bigint;
    endTimestamp: number;
    creator: string;
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
export declare function deployMarket(config: MarketDeployConfig, deployerKey: PrivateKey, registryAddress: PublicKey, networkUrl?: string): Promise<MarketDeployResult>;
/**
 * Batch deploy multiple markets
 */
export declare function deployMarkets(configs: MarketDeployConfig[], deployerKey: PrivateKey, registryAddress: PublicKey, networkUrl?: string): Promise<MarketDeployResult[]>;
/**
 * Deploy market from CLI args (for manual testing)
 */
export declare function deployMarketCLI(): Promise<void>;
