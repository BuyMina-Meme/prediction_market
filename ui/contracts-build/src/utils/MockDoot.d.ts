/**
 * MockDoot.ts - Mock Doot Oracle for testing
 *
 * Provides a testable version of Doot with methods to set prices
 */
import { SmartContract, State, PublicKey } from 'o1js';
import { IpfsCID, TokenInformationArray, TokenInformationArrayProof } from './DootOracle.js';
/**
 * MockDoot - Testable version of Doot Oracle
 *
 * Adds methods to set prices for testing purposes
 */
export declare class MockDoot extends SmartContract {
    commitment: State<import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
    ipfsCID: State<IpfsCID>;
    owner: State<PublicKey>;
    offchainStateCommitments: State<import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state-rollup.js").OffchainStateCommitments>;
    offchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainStateInstance<{
        readonly tokenInformation: {
            kind: "offchain-map";
            keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
            valueType: typeof TokenInformationArray;
        };
    }>;
    deploy(): Promise<void>;
    /**
     * Initialize mock Doot with initial prices
     */
    initBase(prices: TokenInformationArray): Promise<void>;
    /**
     * Update prices (owner only)
     */
    updatePrices(prices: TokenInformationArray): Promise<void>;
    /**
     * Get current prices from Doot Oracle
     */
    getPrices(): Promise<TokenInformationArray>;
    /**
     * Settle offchain state
     */
    settle(proof: TokenInformationArrayProof): Promise<void>;
}
