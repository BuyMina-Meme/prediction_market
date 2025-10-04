import { SmartContract, Field, State, PublicKey, Signature } from 'o1js';
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
export declare class TokenInformationArray extends TokenInformationArray_base {
}
export declare const offchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainState<{
    readonly tokenInformation: {
        kind: "offchain-map";
        keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
        valueType: typeof TokenInformationArray;
    };
}>;
export declare class TokenInformationArrayProof extends offchainState.Proof {
}
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
export declare class IpfsCID extends IpfsCID_base {
}
export declare class Doot extends SmartContract {
    commitment: State<import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
    ipfsCID: State<IpfsCID>;
    owner: State<PublicKey>;
    offchainStateCommitments: State<import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state-rollup.js").OffchainStateCommitments>;
    init(): void;
    offchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainStateInstance<{
        readonly tokenInformation: {
            kind: "offchain-map";
            keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
            valueType: typeof TokenInformationArray;
        };
    }>;
    initBase(updatedCommitment: Field, updatedIpfsCID: IpfsCID, informationArray: TokenInformationArray): Promise<void>;
    update(updatedCommitment: Field, updatedIpfsCID: IpfsCID, informationArray: TokenInformationArray): Promise<void>;
    getPrices(): Promise<TokenInformationArray>;
    settle(proof: TokenInformationArrayProof): Promise<void>;
    verify(signature: Signature, deployer: PublicKey, Price: Field): Promise<void>;
}
export {};
