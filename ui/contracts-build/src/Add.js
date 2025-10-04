import { __decorate, __metadata } from "tslib";
import { Field, SmartContract, state, State, method } from 'o1js';
import { AddProgramProof } from './AddZkProgram.js';
/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract verifies a ZkProgram proof and updates a 'num' state variable.
 * When the 'settleState' method is called, the Add contract verifies a
 * proof from the 'AddZkProgram' and saves the 'num' value to the contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */
export class Add extends SmartContract {
    constructor() {
        super(...arguments);
        this.num = State();
    }
    async settleState(proof) {
        proof.verify();
        this.num.requireEquals(proof.publicInput);
        const addProgramState = proof.publicOutput;
        this.num.set(addProgramState);
    }
}
__decorate([
    state(Field),
    __metadata("design:type", Object)
], Add.prototype, "num", void 0);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AddProgramProof]),
    __metadata("design:returntype", Promise)
], Add.prototype, "settleState", null);
//# sourceMappingURL=Add.js.map