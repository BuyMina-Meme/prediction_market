/**
 * zkApp Web Worker
 * Handles heavy computation (contract compilation, proof generation) off main thread
 */

import { Mina, PublicKey, UInt64, Field, fetchAccount } from 'o1js';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// State
const state = {
  PredictionMarket: null as any,
  MarketRegistry: null as any,
  transaction: null as Transaction | null,
  compiledContracts: new Set<string>(),
};

// API
const functions = {
  setActiveInstance: async (args: { network: string }) => {
    const { network } = args;

    if (network === 'zeko') {
      const Zeko = Mina.Network({
        mina: 'https://devnet.zeko.io/graphql',
        archive: 'https://devnet.zeko.io/graphql',
      });
      Mina.setActiveInstance(Zeko);
    } else {
      // Mina devnet
      const Devnet = Mina.Network({
        mina: 'https://api.minascan.io/node/devnet/v1/graphql',
        archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
      });
      Mina.setActiveInstance(Devnet);
    }
  },

  loadContract: async (args: { name: 'PredictionMarket' | 'MarketRegistry' }) => {
    const { name } = args;

    if (name === 'PredictionMarket') {
      const { PredictionMarket } = await import('../contracts-build/src/contracts/PredictionMarket.js');
      state.PredictionMarket = PredictionMarket;
    } else if (name === 'MarketRegistry') {
      const { MarketRegistry } = await import('../contracts-build/src/contracts/MarketRegistry.js');
      state.MarketRegistry = MarketRegistry;
    }
  },

  compileContract: async (args: { name: 'PredictionMarket' | 'MarketRegistry' }) => {
    const { name } = args;

    // Only compile once
    if (state.compiledContracts.has(name)) {
      return { success: true, cached: true };
    }

    if (name === 'PredictionMarket') {
      await state.PredictionMarket.compile();
    } else if (name === 'MarketRegistry') {
      await state.MarketRegistry.compile();
    }

    state.compiledContracts.add(name);
    return { success: true, cached: false };
  },

  fetchAccount: async (args: { publicKey: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey);
    return await fetchAccount({ publicKey });
  },

  initZkappInstance: async (args: { publicKey: string, contractType: 'PredictionMarket' | 'MarketRegistry' }) => {
    const { publicKey, contractType } = args;
    const pubKey = PublicKey.fromBase58(publicKey);

    if (contractType === 'PredictionMarket') {
      const zkapp = new state.PredictionMarket(pubKey);
      return { success: true };
    } else {
      const zkapp = new state.MarketRegistry(pubKey);
      return { success: true };
    }
  },

  createInitializeTransaction: async (args: {
    marketAddress: string;
    assetIndex: number;
    priceThreshold: string;
    endTimestamp: number;
    creatorAddress: string;
    burnAddress: string;
    registryAddress: string;
  }) => {
    const { marketAddress, assetIndex, priceThreshold, endTimestamp, creatorAddress, burnAddress, registryAddress } = args;

    const market = new state.PredictionMarket(PublicKey.fromBase58(marketAddress));
    const creator = PublicKey.fromBase58(creatorAddress);
    const burn = PublicKey.fromBase58(burnAddress);
    const registry = PublicKey.fromBase58(registryAddress);

    const tx = await Mina.transaction(creator, async () => {
      await market.initialize(
        Field(assetIndex),
        Field(BigInt(priceThreshold)),
        UInt64.from(endTimestamp),
        creator,
        burn,
        registry
      );
    });

    state.transaction = tx;
    return { success: true };
  },

  createBuyYesTransaction: async (args: {
    marketAddress: string;
    amount: string;
    senderAddress: string;
    fee?: string;
  }) => {
    const { marketAddress, amount, senderAddress, fee } = args;

    const market = new state.PredictionMarket(PublicKey.fromBase58(marketAddress));
    const sender = PublicKey.fromBase58(senderAddress);

    const tx = await Mina.transaction(
      {
        sender,
        fee: fee ? UInt64.from(fee) : UInt64.from(100_000_000) // 0.1 MINA default
      },
      async () => {
        await market.buyYes(UInt64.from(amount));
      }
    );

    state.transaction = tx;
    return { success: true };
  },

  createBuyNoTransaction: async (args: {
    marketAddress: string;
    amount: string;
    senderAddress: string;
    fee?: string;
  }) => {
    const { marketAddress, amount, senderAddress, fee } = args;

    const market = new state.PredictionMarket(PublicKey.fromBase58(marketAddress));
    const sender = PublicKey.fromBase58(senderAddress);

    const tx = await Mina.transaction(
      {
        sender,
        fee: fee ? UInt64.from(fee) : UInt64.from(100_000_000)
      },
      async () => {
        await market.buyNo(UInt64.from(amount));
      }
    );

    state.transaction = tx;
    return { success: true };
  },

  createClaimTransaction: async (args: {
    marketAddress: string;
    senderAddress: string;
    fee?: string;
  }) => {
    const { marketAddress, senderAddress, fee } = args;

    const market = new state.PredictionMarket(PublicKey.fromBase58(marketAddress));
    const sender = PublicKey.fromBase58(senderAddress);

    const tx = await Mina.transaction(
      {
        sender,
        fee: fee ? UInt64.from(fee) : UInt64.from(100_000_000)
      },
      async () => {
        await market.claim();
      }
    );

    state.transaction = tx;
    return { success: true };
  },

  proveTransaction: async () => {
    if (!state.transaction) {
      throw new Error('No transaction to prove');
    }

    await state.transaction.prove();
    return { success: true };
  },

  getTransactionJSON: async () => {
    if (!state.transaction) {
      throw new Error('No transaction available');
    }

    const json = state.transaction.toJSON();
    return { json };
  },
};

// Expose API to main thread
export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerResponse = {
  id: number;
  data: any;
  error?: string;
};

if (typeof window !== 'undefined') {
  addEventListener('message', async (event: MessageEvent<ZkappWorkerRequest>) => {
    const { id, fn, args } = event.data;

    try {
      const result = await functions[fn](args);

      const message: ZkappWorkerResponse = {
        id,
        data: result,
      };
      postMessage(message);
    } catch (error: any) {
      const message: ZkappWorkerResponse = {
        id,
        data: null,
        error: error.message || String(error),
      };
      postMessage(message);
    }
  });
}
