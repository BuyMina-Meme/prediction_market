import { Field, SelfProof } from 'o1js';
export declare const AddZkProgram: {
    name: string;
    maxProofsVerified(): Promise<0 | 1 | 2>;
    compile: (options?: {
        cache?: import("o1js").Cache;
        forceRecompile?: boolean;
        proofsEnabled?: boolean;
        withRuntimeTables?: boolean;
        numChunks?: number;
        lazyMode?: boolean;
    }) => Promise<{
        verificationKey: {
            data: string;
            hash: Field;
        };
    }>;
    verify: (proof: import("o1js").Proof<import("node_modules/o1js/dist/node/lib/provable/field.js").Field, import("node_modules/o1js/dist/node/lib/provable/field.js").Field>) => Promise<boolean>;
    digest: () => Promise<string>;
    analyzeMethods: () => Promise<{
        init: import("node_modules/o1js/dist/node/lib/provable/core/provable-context.js").ConstraintSystemSummary & {
            proofs: import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofClass[];
        };
        update: import("node_modules/o1js/dist/node/lib/provable/core/provable-context.js").ConstraintSystemSummary & {
            proofs: import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofClass[];
        };
    }>;
    analyzeSingleMethod<K extends "init" | "update">(methodName: K): Promise<import("node_modules/o1js/dist/node/lib/provable/core/provable-context.js").ConstraintSystemSummary & {
        proofs: import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofClass[];
    }>;
    publicInputType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
    publicOutputType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
    privateInputTypes: {
        init: [];
        update: [typeof SelfProof];
    };
    auxiliaryOutputTypes: {
        init: undefined;
        update: undefined;
    };
    rawMethods: {
        init: (publicInput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => Promise<{
            publicOutput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        }>;
        update: (publicInput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field, args_0: SelfProof<unknown, unknown>) => Promise<{
            publicOutput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        }>;
    };
    Proof: {
        new ({ proof, publicInput, publicOutput, maxProofsVerified, }: {
            proof: import("node_modules/o1js/dist/node/bindings.js").Pickles.Proof;
            publicInput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
            publicOutput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
            maxProofsVerified: 0 | 1 | 2;
        }): import("o1js").Proof<import("node_modules/o1js/dist/node/lib/provable/field.js").Field, import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
        fromJSON<S extends import("node_modules/o1js/dist/node/lib/util/types.js").Subclass<typeof import("o1js").Proof>>(this: S, { maxProofsVerified, proof: proofString, publicInput: publicInputJson, publicOutput: publicOutputJson, }: import("o1js").JsonProof): Promise<import("o1js").Proof<import("o1js").InferProvable<S["publicInputType"]>, import("o1js").InferProvable<S["publicOutputType"]>>>;
        dummy<Input, OutPut>(publicInput: Input, publicOutput: OutPut, maxProofsVerified: 0 | 1 | 2, domainLog2?: number): Promise<import("o1js").Proof<Input, OutPut>>;
        get provable(): {
            toFields: (value: import("o1js").Proof<any, any>) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
            toAuxiliary: (value?: import("o1js").Proof<any, any> | undefined) => any[];
            fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[], aux: any[]) => import("o1js").Proof<any, any>;
            sizeInFields(): number;
            check: (value: import("o1js").Proof<any, any>) => void;
            toValue: (x: import("o1js").Proof<any, any>) => import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofValue<any, any>;
            fromValue: (x: import("o1js").Proof<any, any> | import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofValue<any, any>) => import("o1js").Proof<any, any>;
            toCanonical?: ((x: import("o1js").Proof<any, any>) => import("o1js").Proof<any, any>) | undefined;
        };
        publicInputType: import("o1js").FlexibleProvable<any>;
        publicOutputType: import("o1js").FlexibleProvable<any>;
        tag: () => {
            name: string;
        };
        publicFields(value: import("o1js").ProofBase): {
            input: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
            output: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
        };
        _proofFromBase64(proofString: import("node_modules/o1js/dist/node/bindings.js").Base64ProofString, maxProofsVerified: 0 | 1 | 2): unknown;
        _proofToBase64(proof: import("node_modules/o1js/dist/node/bindings.js").Pickles.Proof, maxProofsVerified: 0 | 1 | 2): string;
    };
    proofsEnabled: boolean;
    setProofsEnabled(proofsEnabled: boolean): void;
} & {
    init: (publicInput: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => Promise<{
        proof: import("o1js").Proof<import("node_modules/o1js/dist/node/lib/provable/field.js").Field, import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
        auxiliaryOutput: undefined;
    }>;
    update: (publicInput: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field, args_0: import("o1js").Proof<any, any> | import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofValue<any, any>) => Promise<{
        proof: import("o1js").Proof<import("node_modules/o1js/dist/node/lib/provable/field.js").Field, import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
        auxiliaryOutput: undefined;
    }>;
};
declare const AddProgramProof_base: {
    new ({ proof, publicInput, publicOutput, maxProofsVerified, }: {
        proof: unknown;
        publicInput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        publicOutput: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        maxProofsVerified: 0 | 2 | 1;
    }): import("o1js").Proof<import("node_modules/o1js/dist/node/lib/provable/field.js").Field, import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
    fromJSON<S extends import("node_modules/o1js/dist/node/lib/util/types.js").Subclass<typeof import("o1js").Proof>>(this: S, { maxProofsVerified, proof: proofString, publicInput: publicInputJson, publicOutput: publicOutputJson, }: import("o1js").JsonProof): Promise<import("o1js").Proof<import("o1js").InferProvable<S["publicInputType"]>, import("o1js").InferProvable<S["publicOutputType"]>>>;
    dummy<Input, OutPut>(publicInput: Input, publicOutput: OutPut, maxProofsVerified: 0 | 2 | 1, domainLog2?: number): Promise<import("o1js").Proof<Input, OutPut>>;
    readonly provable: {
        toFields: (value: import("o1js").Proof<any, any>) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
        toAuxiliary: (value?: import("o1js").Proof<any, any> | undefined) => any[];
        fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[], aux: any[]) => import("o1js").Proof<any, any>;
        sizeInFields(): number;
        check: (value: import("o1js").Proof<any, any>) => void;
        toValue: (x: import("o1js").Proof<any, any>) => import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofValue<any, any>;
        fromValue: (x: import("o1js").Proof<any, any> | import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofValue<any, any>) => import("o1js").Proof<any, any>;
        toCanonical?: ((x: import("o1js").Proof<any, any>) => import("o1js").Proof<any, any>) | undefined;
    };
    publicInputType: import("o1js").FlexibleProvable<any>;
    publicOutputType: import("o1js").FlexibleProvable<any>;
    tag: () => {
        name: string;
    };
    publicFields(value: import("o1js").ProofBase<any, any>): {
        input: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
        output: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[];
    };
    _proofFromBase64(proofString: string, maxProofsVerified: 0 | 2 | 1): unknown;
    _proofToBase64(proof: unknown, maxProofsVerified: 0 | 2 | 1): string;
} & {
    provable: import("o1js").Provable<import("o1js").Proof<import("node_modules/o1js/dist/node/lib/provable/field.js").Field, import("node_modules/o1js/dist/node/lib/provable/field.js").Field>, import("node_modules/o1js/dist/node/lib/proof-system/proof.js").ProofValue<bigint, bigint>>;
};
export declare class AddProgramProof extends AddProgramProof_base {
}
export {};
