/**
 * MarketInfo.ts - Registry tracking data for markets
 *
 * Stored in MarketRegistry's offchain state to track all deployed markets.
 */
import { Struct, PublicKey, Field } from 'o1js';
import { MARKET_STATUS } from './Constants.js';
/**
 * MarketInfo: Metadata tracked by MarketRegistry
 *
 * @property marketAddress - Address of the deployed PredictionMarket contract
 * @property creator - Address that created and funded the market
 * @property assetIndex - Which asset is being predicted (0-9)
 * @property endTimestamp - When market closes for betting
 * @property status - Current market status (ACTIVE/LOCKED/AWAITING/SETTLED)
 *
 * Storage: MarketRegistry offchain state (marketId → MarketInfo)
 */
export class MarketInfo extends Struct({
    marketAddress: PublicKey, // Contract address
    creator: PublicKey, // Market creator
    assetIndex: Field, // Asset being predicted (0-9)
    endTimestamp: Field, // Market end time
    status: Field, // Current status (0-3)
}) {
    /**
     * Creates a new market info entry
     */
    static create(marketAddress, creator, assetIndex, endTimestamp) {
        return new MarketInfo({
            marketAddress,
            creator,
            assetIndex,
            endTimestamp,
            status: MARKET_STATUS.ACTIVE, // Start as active
        });
    }
    /**
     * Check if market is active (accepting bets)
     */
    isActive() {
        return this.status.equals(MARKET_STATUS.ACTIVE);
    }
    /**
     * Check if market is locked (within lockout period)
     */
    isLocked() {
        return this.status.equals(MARKET_STATUS.LOCKED);
    }
    /**
     * Check if market is awaiting settlement
     */
    isAwaiting() {
        return this.status.equals(MARKET_STATUS.AWAITING);
    }
    /**
     * Check if market is settled
     */
    isSettled() {
        return this.status.equals(MARKET_STATUS.SETTLED);
    }
    /**
     * Update market status
     */
    withStatus(newStatus) {
        return new MarketInfo({
            marketAddress: this.marketAddress,
            creator: this.creator,
            assetIndex: this.assetIndex,
            endTimestamp: this.endTimestamp,
            status: newStatus,
        });
    }
}
// Re-export for convenience
export { Struct, PublicKey, Field, Bool } from 'o1js';
export { MARKET_STATUS } from './Constants.js';
//# sourceMappingURL=MarketInfo.js.map