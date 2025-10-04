/**
 * zkApp Worker Client
 * Clean interface to communicate with Web Worker
 */

import type { ZkappWorkerRequest, ZkappWorkerResponse, WorkerFunctions } from './zkappWorker';

export class ZkappWorkerClient {
  worker: Worker | null = null;
  promiseResolvers = new Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }>();
  nextId = 0;

  async loadWorker() {
    if (this.worker) return;

    this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.addEventListener('message', (event: MessageEvent<ZkappWorkerResponse>) => {
      const { id, data, error } = event.data;
      const resolver = this.promiseResolvers.get(id);

      if (resolver) {
        if (error) {
          resolver.reject(new Error(error));
        } else {
          resolver.resolve(data);
        }
        this.promiseResolvers.delete(id);
      }
    });
  }

  private call(fn: WorkerFunctions, args: any): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not loaded');
    }

    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.promiseResolvers.set(id, { resolve, reject });

      const message: ZkappWorkerRequest = {
        id,
        fn,
        args,
      };

      this.worker!.postMessage(message);
    });
  }

  // Network setup
  async setActiveInstance(network: 'zeko' | 'mina') {
    return this.call('setActiveInstance', { network });
  }

  // Contract loading
  async loadContract(name: 'PredictionMarket' | 'MarketRegistry') {
    return this.call('loadContract', { name });
  }

  // Contract compilation (cached after first time)
  async compileContract(name: 'PredictionMarket' | 'MarketRegistry') {
    return this.call('compileContract', { name });
  }

  // Account fetching
  async fetchAccount(publicKey: string) {
    return this.call('fetchAccount', { publicKey });
  }

  // Initialize contract instance
  async initZkappInstance(publicKey: string, contractType: 'PredictionMarket' | 'MarketRegistry') {
    return this.call('initZkappInstance', { publicKey, contractType });
  }

  // Create initialize transaction (creator pays 10 MINA deposit)
  async createInitializeTransaction(
    marketAddress: string,
    assetIndex: number,
    priceThreshold: string,
    endTimestamp: number,
    creatorAddress: string,
    burnAddress: string,
    registryAddress: string
  ) {
    return this.call('createInitializeTransaction', {
      marketAddress,
      assetIndex,
      priceThreshold,
      endTimestamp,
      creatorAddress,
      burnAddress,
      registryAddress,
    });
  }

  // Create transactions
  async createBuyYesTransaction(marketAddress: string, amount: string, senderAddress: string, fee?: string) {
    return this.call('createBuyYesTransaction', { marketAddress, amount, senderAddress, fee });
  }

  async createBuyNoTransaction(marketAddress: string, amount: string, senderAddress: string, fee?: string) {
    return this.call('createBuyNoTransaction', { marketAddress, amount, senderAddress, fee });
  }

  async createClaimTransaction(marketAddress: string, senderAddress: string, fee?: string) {
    return this.call('createClaimTransaction', { marketAddress, senderAddress, fee });
  }

  // Prove transaction
  async proveTransaction() {
    return this.call('proveTransaction', {});
  }

  // Get transaction JSON for signing
  async getTransactionJSON() {
    return this.call('getTransactionJSON', {});
  }
}
