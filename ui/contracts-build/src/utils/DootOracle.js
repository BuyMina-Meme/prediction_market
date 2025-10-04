/**
 * DootOracle.ts - Integration with Doot Oracle for price feeds
 *
 * Provides a clean interface to fetch prices from deployed Doot contract.
 * Handles price extraction for specific assets from the 10-token array.
 */
import { __decorate, __metadata } from "tslib";
import { SmartContract, Field, method, State, state, PublicKey, Experimental, Struct, Provable, } from 'o1js';
const { OffchainState } = Experimental;
import { MultiPackedStringFactory } from 'o1js-pack';
/**
 * IpfsCID type matching Doot's implementation
 */
export class IpfsCID extends MultiPackedStringFactory(2) {
}
/**
 * TokenInformationArray matching Doot's structure
 * Stores prices for exactly 10 cryptocurrencies
 */
export class TokenInformationArray extends Struct({
    prices: Provable.Array(Field, 10),
}) {
}
/**
 * Offchain state configuration matching Doot
 */
export const dootOffchainState = OffchainState({
    tokenInformation: OffchainState.Map(Field, TokenInformationArray),
}, { maxActionsPerUpdate: 2 });
export class TokenInformationArrayProof extends dootOffchainState.Proof {
}
/**
 * Doot Oracle Contract (Read-only interface)
 *
 * This is a minimal interface to Doot contract for reading prices.
 * We don't need all methods, just getPrices().
 */
export class Doot extends SmartContract {
    constructor() {
        super(...arguments);
        this.commitment = State();
        this.ipfsCID = State();
        this.owner = State();
        this.offchainStateCommitments = dootOffchainState.emptyCommitments();
        this.offchainState = dootOffchainState.init(this);
    }
    /**
     * Get current prices from Doot Oracle
     *
     * Returns array of 10 prices:
     * [0]=MINA, [1]=BTC, [2]=ETH, [3]=SOL, [4]=XRP,
     * [5]=ADA, [6]=AVAX, [7]=MATIC, [8]=LINK, [9]=DOGE
     *
     * Prices are in Doot format (price * 10^10)
     */
    async getPrices() {
        const info = await this.offchainState.fields.tokenInformation.get(Field(0));
        return info.value;
    }
}
__decorate([
    state(Field),
    __metadata("design:type", Object)
], Doot.prototype, "commitment", void 0);
__decorate([
    state(IpfsCID),
    __metadata("design:type", Object)
], Doot.prototype, "ipfsCID", void 0);
__decorate([
    state(PublicKey),
    __metadata("design:type", Object)
], Doot.prototype, "owner", void 0);
__decorate([
    state(OffchainState.Commitments),
    __metadata("design:type", Object)
], Doot.prototype, "offchainStateCommitments", void 0);
__decorate([
    method.returns(TokenInformationArray),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Doot.prototype, "getPrices", null);
/**
 * DootOracleClient - Helper class for interacting with Doot
 */
export class DootOracleClient {
    /**
     * Fetch price for a specific asset from Doot Oracle
     *
     * @param dootContract - Instance of Doot contract
     * @param assetIndex - Asset to fetch (0-9)
     * @returns Price in Doot format (price * 10^10)
     */
    static async getAssetPrice(dootContract, assetIndex) {
        // Verify asset index is valid (0-9)
        assetIndex.assertLessThanOrEqual(Field(9));
        assetIndex.assertGreaterThanOrEqual(Field(0));
        // Fetch all prices from Doot
        const tokenInfo = await dootContract.getPrices();
        // Extract the specific asset's price
        // Since we can't dynamically index arrays in ZK, we use a selector pattern
        const price = this.selectPriceByIndex(tokenInfo.prices, assetIndex);
        return price;
    }
    /**
     * Select price from array by index using ZK-compatible logic
     *
     * Uses Provable.switch to select the correct price without dynamic indexing.
     */
    static selectPriceByIndex(prices, index) {
        // Use Provable.switch for ZK-compatible array indexing
        return Provable.switch([index.equals(Field(0)), index.equals(Field(1)), index.equals(Field(2)), index.equals(Field(3)), index.equals(Field(4)), index.equals(Field(5)), index.equals(Field(6)), index.equals(Field(7)), index.equals(Field(8)), index.equals(Field(9))], Field, [
            prices[0],
            prices[1],
            prices[2],
            prices[3],
            prices[4],
            prices[5],
            prices[6],
            prices[7],
            prices[8],
            prices[9],
        ]);
    }
}
/**
 * Asset index constants for clarity
 */
export const DOOT_ASSET_INDEX = {
    MINA: Field(0),
    BITCOIN: Field(1),
    ETHEREUM: Field(2),
    SOLANA: Field(3),
    RIPPLE: Field(4),
    CARDANO: Field(5),
    AVALANCHE: Field(6),
    POLYGON: Field(7),
    CHAINLINK: Field(8),
    DOGECOIN: Field(9),
};
//# sourceMappingURL=DootOracle.js.map