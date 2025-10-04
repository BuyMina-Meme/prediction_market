import { ZkProgram, Field, SelfProof } from 'o1js';
export const AddZkProgram = ZkProgram({
    name: 'add-program',
    publicInput: Field,
    publicOutput: Field,
    methods: {
        init: {
            privateInputs: [],
            async method(initialState) {
                return {
                    publicOutput: initialState,
                };
            },
        },
        update: {
            privateInputs: [SelfProof],
            async method(initialState, previousProof) {
                previousProof.verify();
                initialState.assertEquals(previousProof.publicInput);
                return {
                    publicOutput: previousProof.publicOutput.add(Field(1)),
                };
            },
        },
    },
});
export class AddProgramProof extends ZkProgram.Proof(AddZkProgram) {
}
//# sourceMappingURL=AddZkProgram.js.map