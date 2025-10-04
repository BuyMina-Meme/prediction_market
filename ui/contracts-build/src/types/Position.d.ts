/**
 * Position.ts - User betting position tracking
 *
 * Stores a user's YES and NO token holdings for a specific market.
 * This data is stored in offchain state to avoid on-chain Field limits.
 */
import { UInt64, Bool } from 'o1js';
declare const Position_base: (new (value: {
    yesAmount: UInt64;
    noAmount: UInt64;
    claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
}) => {
    yesAmount: UInt64;
    noAmount: UInt64;
    claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
}) & {
    _isStruct: true;
} & Omit<import("node_modules/o1js/dist/node/lib/provable/types/provable-intf.js").Provable<{
    yesAmount: UInt64;
    noAmount: UInt64;
    claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
}, {
    yesAmount: bigint;
    noAmount: bigint;
    claimed: boolean;
}>, "fromFields"> & {
    fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[]) => {
        yesAmount: UInt64;
        noAmount: UInt64;
        claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    };
} & {
    fromValue: (value: {
        yesAmount: number | bigint | UInt64;
        noAmount: number | bigint | UInt64;
        claimed: boolean | import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    }) => {
        yesAmount: UInt64;
        noAmount: UInt64;
        claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    };
    toInput: (x: {
        yesAmount: UInt64;
        noAmount: UInt64;
        claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    }) => {
        fields?: import("o1js").Field[] | undefined;
        packed?: [import("o1js").Field, number][] | undefined;
    };
    toJSON: (x: {
        yesAmount: UInt64;
        noAmount: UInt64;
        claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    }) => {
        yesAmount: string;
        noAmount: string;
        claimed: boolean;
    };
    fromJSON: (x: {
        yesAmount: string;
        noAmount: string;
        claimed: boolean;
    }) => {
        yesAmount: UInt64;
        noAmount: UInt64;
        claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    };
    empty: () => {
        yesAmount: UInt64;
        noAmount: UInt64;
        claimed: import("node_modules/o1js/dist/node/lib/provable/bool.js").Bool;
    };
};
/**
 * Position: Represents a user's stake in a prediction market
 *
 * @property yesAmount - Amount of YES tokens held (in nanomina)
 * @property noAmount - Amount of NO tokens held (in nanomina)
 * @property claimed - Whether user has claimed their winnings (if applicable)
 *
 * Storage: Offchain state map (UserAddress → Position)
 *
 * Example:
 * - User bets 5 MINA on YES: yesAmount = 5000000000, noAmount = 0
 * - User bets 3 MINA on NO: yesAmount = 0, noAmount = 3000000000
 * - User bets both sides: yesAmount = 2000000000, noAmount = 1000000000
 */
export declare class Position extends Position_base {
    /**
     * Creates an empty position (no tokens held)
     */
    static empty(): Position;
    /**
     * Check if position has any holdings
     */
    hasPosition(): Bool;
    /**
     * Get total amount bet across both outcomes
     */
    totalBet(): UInt64;
    /**
     * Check if user can claim (has winning position and hasn't claimed)
     */
    canClaim(isYesWinner: Bool): Bool;
}
export { Struct, UInt64, Bool } from 'o1js';
