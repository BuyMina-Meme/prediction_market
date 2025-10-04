/**
 * MockDoot.ts - Mock Doot Oracle for testing
 *
 * Provides a testable version of Doot with methods to set prices
 */
import { __decorate, __metadata } from "tslib";
import { SmartContract, Field, method, State, state, PublicKey, Experimental, Permissions, } from 'o1js';
const { OffchainState } = Experimental;
import { IpfsCID, TokenInformationArray, TokenInformationArrayProof, dootOffchainState, } from './DootOracle.js';
/**
 * MockDoot - Testable version of Doot Oracle
 *
 * Adds methods to set prices for testing purposes
 */
export class MockDoot extends SmartContract {
    constructor() {
        super(...arguments);
        this.commitment = State();
        this.ipfsCID = State();
        this.owner = State();
        this.offchainStateCommitments = dootOffchainState.emptyCommitments();
        this.offchainState = dootOffchainState.init(this);
    }
    async deploy() {
        await super.deploy();
        this.account.permissions.set({
            ...Permissions.default(),
            setPermissions: Permissions.impossible(),
            access: Permissions.proof(),
        });
    }
    /**
     * Initialize mock Doot with initial prices
     */
    async initBase(prices) {
        // Ensure offchain state has contract instance
        this.offchainState.setContractInstance(this);
        // Verify first initialization
        this.owner.getAndRequireEquals().assertEquals(PublicKey.empty());
        // Set caller as owner
        const sender = this.sender.getAndRequireSignature();
        this.owner.set(sender);
        // Initialize prices in offchain state
        const currentPrices = await this.offchainState.fields.tokenInformation.get(Field(0));
        this.offchainState.fields.tokenInformation.update(Field(0), {
            from: currentPrices,
            to: prices,
        });
        // Set dummy commitment
        this.commitment.set(Field(0));
    }
    /**
     * Update prices (owner only)
     */
    async updatePrices(prices) {
        this.offchainState.setContractInstance(this);
        // Verify owner
        const owner = this.owner.getAndRequireEquals();
        const sender = this.sender.getAndRequireSignature();
        sender.assertEquals(owner);
        // Update prices
        const currentPrices = await this.offchainState.fields.tokenInformation.get(Field(0));
        this.offchainState.fields.tokenInformation.update(Field(0), {
            from: currentPrices,
            to: prices,
        });
    }
    /**
     * Get current prices from Doot Oracle
     */
    async getPrices() {
        this.offchainState.setContractInstance(this);
        const info = await this.offchainState.fields.tokenInformation.get(Field(0));
        return info.value;
    }
    /**
     * Settle offchain state
     */
    async settle(proof) {
        this.offchainState.setContractInstance(this);
        await this.offchainState.settle(proof);
    }
}
__decorate([
    state(Field),
    __metadata("design:type", Object)
], MockDoot.prototype, "commitment", void 0);
__decorate([
    state(IpfsCID),
    __metadata("design:type", Object)
], MockDoot.prototype, "ipfsCID", void 0);
__decorate([
    state(PublicKey),
    __metadata("design:type", Object)
], MockDoot.prototype, "owner", void 0);
__decorate([
    state(OffchainState.Commitments),
    __metadata("design:type", Object)
], MockDoot.prototype, "offchainStateCommitments", void 0);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TokenInformationArray]),
    __metadata("design:returntype", Promise)
], MockDoot.prototype, "initBase", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TokenInformationArray]),
    __metadata("design:returntype", Promise)
], MockDoot.prototype, "updatePrices", null);
__decorate([
    method.returns(TokenInformationArray),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MockDoot.prototype, "getPrices", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TokenInformationArrayProof]),
    __metadata("design:returntype", Promise)
], MockDoot.prototype, "settle", null);
//# sourceMappingURL=MockDoot.js.map