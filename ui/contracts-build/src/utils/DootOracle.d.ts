/**
 * DootOracle.ts - Integration with Doot Oracle for price feeds
 *
 * Provides a clean interface to fetch prices from deployed Doot contract.
 * Handles price extraction for specific assets from the 10-token array.
 */
import { SmartContract, Field, State, PublicKey } from 'o1js';
declare const IpfsCID_base: {
    new (packed: Array<Field>): {
        toString(): string;
        toFields(): Array<Field>;
        assertEquals(other: {
            toFields(): Array<Field>;
            assertEquals(other: any): void;
            packed: import("o1js/dist/node/lib/provable/field.js").Field[];
        }): void;
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    };
    extractField(input: import("o1js").Character): Field;
    sizeInBits(): bigint;
    elementsPerField(): number;
    unpack(fields: Field[]): import("o1js").Character[];
    fromCharacters(input: Array<import("o1js").Character>): {
        toString(): string;
        toFields(): Array<Field>;
        assertEquals(other: {
            toFields(): Array<Field>;
            assertEquals(other: any): void;
            packed: import("o1js/dist/node/lib/provable/field.js").Field[];
        }): void;
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    };
    fromString(str: string): {
        toString(): string;
        toFields(): Array<Field>;
        assertEquals(other: {
            toFields(): Array<Field>;
            assertEquals(other: any): void;
            packed: import("o1js/dist/node/lib/provable/field.js").Field[];
        }): void;
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    };
    type: import("o1js/dist/node/bindings/lib/generic.js").GenericProvableExtendedPure<{
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }, {
        packed: bigint[];
    }, {
        packed: string[];
    }, import("o1js/dist/node/lib/provable/field.js").Field>;
    l: number;
    n: number;
    bitSize: bigint;
    checkPack(unpacked: import("o1js").Character[]): void;
    pack(unpacked: import("o1js").Character[]): Array<Field>;
    unpackToBigints(fields: Array<Field>): Array<bigint>;
    _isStruct: true;
    toFields: (value: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }) => import("o1js/dist/node/lib/provable/field.js").Field[];
    toAuxiliary: (value?: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    } | undefined) => any[];
    sizeInFields: () => number;
    check: (value: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }) => void;
    toValue: (x: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }) => {
        packed: bigint[];
    };
    fromValue: ((x: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    } | {
        packed: bigint[];
    }) => {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }) & ((value: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[] | bigint[];
    }) => {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    });
    fromFields: (fields: import("o1js/dist/node/lib/provable/field.js").Field[]) => {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    };
    toInput: (x: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }) => {
        fields?: Field[] | undefined;
        packed?: [Field, number][] | undefined;
    };
    toJSON: (x: {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    }) => {
        packed: string[];
    };
    fromJSON: (x: {
        packed: string[];
    }) => {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    };
    empty: () => {
        packed: import("o1js/dist/node/lib/provable/field.js").Field[];
    };
};
/**
 * IpfsCID type matching Doot's implementation
 */
export declare class IpfsCID extends IpfsCID_base {
}
declare const TokenInformationArray_base: (new (value: {
    prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
}) => {
    prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
}) & {
    _isStruct: true;
} & Omit<import("node_modules/o1js/dist/node/lib/provable/types/provable-intf.js").Provable<{
    prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
}, {
    prices: bigint[];
}>, "fromFields"> & {
    fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[]) => {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    };
} & {
    fromValue: (value: {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[] | bigint[];
    }) => {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    };
    toInput: (x: {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    }) => {
        fields?: Field[] | undefined;
        packed?: [Field, number][] | undefined;
    };
    toJSON: (x: {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    }) => {
        prices: string[];
    };
    fromJSON: (x: {
        prices: string[];
    }) => {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    };
    empty: () => {
        prices: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    };
};
/**
 * TokenInformationArray matching Doot's structure
 * Stores prices for exactly 10 cryptocurrencies
 */
export declare class TokenInformationArray extends TokenInformationArray_base {
}
/**
 * Offchain state configuration matching Doot
 */
export declare const dootOffchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainState<{
    readonly tokenInformation: {
        kind: "offchain-map";
        keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
        valueType: typeof TokenInformationArray;
    };
}>;
export declare class TokenInformationArrayProof extends dootOffchainState.Proof {
}
/**
 * Doot Oracle Contract (Read-only interface)
 *
 * This is a minimal interface to Doot contract for reading prices.
 * We don't need all methods, just getPrices().
 */
export declare class Doot extends SmartContract {
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
    /**
     * Get current prices from Doot Oracle
     *
     * Returns array of 10 prices:
     * [0]=MINA, [1]=BTC, [2]=ETH, [3]=SOL, [4]=XRP,
     * [5]=ADA, [6]=AVAX, [7]=MATIC, [8]=LINK, [9]=DOGE
     *
     * Prices are in Doot format (price * 10^10)
     */
    getPrices(): Promise<TokenInformationArray>;
}
/**
 * DootOracleClient - Helper class for interacting with Doot
 */
export declare class DootOracleClient {
    /**
     * Fetch price for a specific asset from Doot Oracle
     *
     * @param dootContract - Instance of Doot contract
     * @param assetIndex - Asset to fetch (0-9)
     * @returns Price in Doot format (price * 10^10)
     */
    static getAssetPrice(dootContract: Doot, assetIndex: Field): Promise<Field>;
    /**
     * Select price from array by index using ZK-compatible logic
     *
     * Uses Provable.switch to select the correct price without dynamic indexing.
     */
    private static selectPriceByIndex;
}
/**
 * Asset index constants for clarity
 */
export declare const DOOT_ASSET_INDEX: {
    readonly MINA: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly BITCOIN: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly ETHEREUM: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly SOLANA: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly RIPPLE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly CARDANO: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly AVALANCHE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly POLYGON: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly CHAINLINK: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly DOGECOIN: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
};
export {};
