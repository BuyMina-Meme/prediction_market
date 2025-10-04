import { SmartContract, State } from 'o1js';
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
export declare class Add extends SmartContract {
    num: State<import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
    settleState(proof: AddProgramProof): Promise<void>;
}
