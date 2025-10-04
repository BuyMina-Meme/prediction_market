/**
 * Redis Client - Upstash Redis Integration
 *
 * Simplified storage using Upstash's serverless Redis with REST API.
 * All data stored as JSON strings with set/get operations.
 */
export interface MarketData {
    marketId: number;
    marketAddress: string;
    creator: string;
    assetIndex: number;
    assetName: string;
    priceThreshold: string;
    endTimestamp: number;
    status: 'PENDING_INIT' | 'ACTIVE' | 'LOCKED' | 'AWAITING' | 'SETTLED';
    yesPool?: string;
    noPool?: string;
    outcome?: 'PENDING' | 'YES' | 'NO';
    createdAt: string;
    initParams?: {
        assetIndex: number;
        priceThreshold: string;
        endTimestamp: number;
        burnAddress: string;
        registryAddress: string;
    };
}
export interface DootPriceUpdate {
    asset: string;
    assetIndex: number;
    price: string;
    timestamp: number;
    settlementTimestamp?: number;
}
/**
 * Upstash Redis Service
 *
 * Simplified data model:
 * - market:{id} → JSON of MarketData
 * - markets:all → JSON array of market IDs
 * - markets:pending → JSON array of pending market IDs
 * - doot:commitment:{id} → commitment string
 */
declare class UpstashRedisService {
    private client;
    constructor();
    /**
     * Save market data
     */
    saveMarket(data: MarketData): Promise<void>;
    /**
     * Get market data
     */
    getMarket(marketId: number): Promise<MarketData | null>;
    /**
     * Get all markets
     */
    getAllMarkets(): Promise<MarketData[]>;
    /**
     * Get active markets
     */
    getActiveMarkets(): Promise<MarketData[]>;
    /**
     * Get markets awaiting settlement
     */
    getMarketsAwaitingSettlement(): Promise<MarketData[]>;
    /**
     * Update market status
     */
    updateMarketStatus(marketId: number, status: MarketData['status'], outcome?: 'PENDING' | 'YES' | 'NO'): Promise<void>;
    /**
     * Get all market IDs
     */
    private getAllMarketIds;
    /**
     * Add market to global list
     */
    private addToMarketsList;
    /**
     * Add market to pending settlements
     */
    addPendingSettlement(marketId: number): Promise<void>;
    /**
     * Remove market from pending settlements
     */
    removePendingSettlement(marketId: number): Promise<void>;
    /**
     * Get all pending settlements
     */
    getPendingSettlements(): Promise<number[]>;
    /**
     * Save latest Doot price update
     */
    saveDootPrice(data: DootPriceUpdate): Promise<void>;
    /**
     * Get latest price for asset
     */
    getLatestDootPrice(assetIndex: number): Promise<DootPriceUpdate | null>;
    /**
     * Set key-value with optional TTL
     */
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    /**
     * Set key with TTL (alias for compatibility)
     */
    setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void>;
    /**
     * Get key value
     */
    get(key: string): Promise<string | null>;
    /**
     * Delete key
     */
    del(key: string): Promise<void>;
    /**
     * Check if key exists
     */
    exists(key: string): Promise<boolean>;
    /**
     * Get multiple keys (pipeline for efficiency)
     */
    mget(...keys: string[]): Promise<(string | null)[]>;
    /**
     * Get global markets IPFS CID
     */
    getGlobalMarketsCID(): Promise<string | null>;
    /**
     * Set global markets IPFS CID
     */
    setGlobalMarketsCID(cid: string): Promise<void>;
}
export declare const redis: UpstashRedisService;
export {};
//# sourceMappingURL=redis-client.d.ts.map