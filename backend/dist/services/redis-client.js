/**
 * Redis Client - Upstash Redis Integration
 *
 * Simplified storage using Upstash's serverless Redis with REST API.
 * All data stored as JSON strings with set/get operations.
 */
import { Redis } from '@upstash/redis';
import { config } from '../config.js';
/**
 * Upstash Redis Service
 *
 * Simplified data model:
 * - market:{id} → JSON of MarketData
 * - markets:all → JSON array of market IDs
 * - markets:pending → JSON array of pending market IDs
 * - doot:commitment:{id} → commitment string
 */
class UpstashRedisService {
    client;
    constructor() {
        // Upstash Redis is serverless - no connect/disconnect needed
        this.client = new Redis({
            url: config.redis.url,
            token: config.redis.token,
        });
    }
    // ========== Market Data ==========
    /**
     * Save market data
     */
    async saveMarket(data) {
        const key = `market:${data.marketId}`;
        await this.client.set(key, JSON.stringify(data));
        // Add to markets list
        await this.addToMarketsList(data.marketId);
    }
    /**
     * Get market data
     */
    async getMarket(marketId) {
        const key = `market:${marketId}`;
        const data = await this.client.get(key);
        if (!data)
            return null;
        // Upstash returns parsed JSON automatically
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data;
    }
    /**
     * Get all markets
     */
    async getAllMarkets() {
        const marketIds = await this.getAllMarketIds();
        const markets = [];
        for (const id of marketIds) {
            const market = await this.getMarket(id);
            if (market)
                markets.push(market);
        }
        return markets;
    }
    /**
     * Get active markets
     */
    async getActiveMarkets() {
        const allMarkets = await this.getAllMarkets();
        return allMarkets.filter(m => m.status === 'ACTIVE' || m.status === 'LOCKED');
    }
    /**
     * Get markets awaiting settlement
     */
    async getMarketsAwaitingSettlement() {
        const allMarkets = await this.getAllMarkets();
        const now = Date.now();
        return allMarkets.filter(m => (m.status === 'ACTIVE' || m.status === 'LOCKED') &&
            parseInt(m.endTimestamp.toString()) < now);
    }
    /**
     * Update market status
     */
    async updateMarketStatus(marketId, status, outcome) {
        const market = await this.getMarket(marketId);
        if (!market) {
            console.warn(`⚠️  Market ${marketId} not found, cannot update status`);
            return;
        }
        market.status = status;
        if (outcome)
            market.outcome = outcome;
        await this.saveMarket(market);
    }
    // ========== Market List Management ==========
    /**
     * Get all market IDs
     */
    async getAllMarketIds() {
        const data = await this.client.get('markets:all');
        if (!data)
            return [];
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data;
    }
    /**
     * Add market to global list
     */
    async addToMarketsList(marketId) {
        const currentIds = await this.getAllMarketIds();
        if (!currentIds.includes(marketId)) {
            currentIds.push(marketId);
            await this.client.set('markets:all', JSON.stringify(currentIds));
        }
    }
    // ========== Pending Settlements ==========
    /**
     * Add market to pending settlements
     */
    async addPendingSettlement(marketId) {
        const pending = await this.getPendingSettlements();
        if (!pending.includes(marketId)) {
            pending.push(marketId);
            await this.client.set('markets:pending', JSON.stringify(pending));
        }
    }
    /**
     * Remove market from pending settlements
     */
    async removePendingSettlement(marketId) {
        const pending = await this.getPendingSettlements();
        const filtered = pending.filter(id => id !== marketId);
        await this.client.set('markets:pending', JSON.stringify(filtered));
    }
    /**
     * Get all pending settlements
     */
    async getPendingSettlements() {
        const data = await this.client.get('markets:pending');
        if (!data)
            return [];
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data;
    }
    // ========== Doot Price Data (Optional - Not used in core flow) ==========
    /**
     * Save latest Doot price update
     */
    async saveDootPrice(data) {
        const key = `doot:latest:${data.assetIndex}`;
        await this.client.set(key, JSON.stringify(data));
    }
    /**
     * Get latest price for asset
     */
    async getLatestDootPrice(assetIndex) {
        const key = `doot:latest:${assetIndex}`;
        const data = await this.client.get(key);
        if (!data)
            return null;
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data;
    }
    // ========== Generic Operations ==========
    /**
     * Set key-value with optional TTL
     */
    async set(key, value, ttlSeconds) {
        if (ttlSeconds) {
            await this.client.setex(key, ttlSeconds, value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    /**
     * Set key with TTL (alias for compatibility)
     */
    async setWithTTL(key, value, ttlSeconds) {
        await this.set(key, value, ttlSeconds);
    }
    /**
     * Get key value
     */
    async get(key) {
        const data = await this.client.get(key);
        if (data === null || data === undefined)
            return null;
        // Upstash may return parsed JSON or string
        if (typeof data === 'string')
            return data;
        // If it's an object, stringify it back
        return JSON.stringify(data);
    }
    /**
     * Delete key
     */
    async del(key) {
        await this.client.del(key);
    }
    /**
     * Check if key exists
     */
    async exists(key) {
        const result = await this.client.exists(key);
        return result === 1;
    }
    /**
     * Get multiple keys (pipeline for efficiency)
     */
    async mget(...keys) {
        const results = await this.client.mget(...keys);
        return results.map(data => {
            if (data === null || data === undefined)
                return null;
            if (typeof data === 'string')
                return data;
            return JSON.stringify(data);
        });
    }
    /**
     * Get global markets IPFS CID
     */
    async getGlobalMarketsCID() {
        return await this.get('global:markets:cid');
    }
    /**
     * Set global markets IPFS CID
     */
    async setGlobalMarketsCID(cid) {
        await this.set('global:markets:cid', cid);
    }
}
// Export singleton instance
export const redis = new UpstashRedisService();
//# sourceMappingURL=redis-client.js.map