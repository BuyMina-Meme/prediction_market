/**
 * Market Deployer Service
 *
 * Handles programmatic deployment of prediction markets
 */
import { MarketData } from './redis-client.js';
export interface MarketCreateRequest {
    assetIndex: number;
    priceThreshold: string;
    endTimestamp: number;
    creator: string;
}
export interface MarketCreateResponse {
    success: boolean;
    marketId?: number;
    marketAddress?: string;
    txHash?: string;
    error?: string;
    initParams?: {
        assetIndex: number;
        priceThreshold: string;
        endTimestamp: number;
        burnAddress: string;
        registryAddress: string;
    };
}
/**
 * Deploy a new prediction market
 */
export declare function deployMarket(request: MarketCreateRequest): Promise<MarketCreateResponse>;
/**
 * Validate market creation request
 */
export declare function validateMarketRequest(request: MarketCreateRequest): {
    valid: boolean;
    errors: string[];
};
/**
 * Get all markets
 */
export declare function getAllMarkets(): Promise<MarketData[]>;
/**
 * Get specific market
 */
export declare function getMarket(marketId: number): Promise<MarketData | null>;
/**
 * Get active markets
 */
export declare function getActiveMarkets(): Promise<MarketData[]>;
//# sourceMappingURL=market-deployer.d.ts.map