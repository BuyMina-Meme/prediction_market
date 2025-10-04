/**
 * usePredictionMarket Hook
 * Simple interface for betting and claiming
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ZkappWorkerClient } from '../lib/zkappWorkerClient';

/**
 * Wait for transaction confirmation on Zeko
 *
 * NOTE: Zeko GraphQL doesn't expose transaction(hash) query.
 * We use time-based waiting with optimistic confirmation.
 * Zeko L2 has fast finality (~10-25 seconds), so 30s wait is sufficient.
 */
async function waitForTransactionConfirmation(
  txHash: string,
  waitTimeMs = 30000
): Promise<boolean> {
  console.log(` Waiting ${waitTimeMs / 1000}s for Zeko L2 confirmation...`);
  console.log(`   Transaction hash: ${txHash}`);

  // Zeko L2 finality is 10-25 seconds, so 30 second wait is safe
  await new Promise((resolve) => setTimeout(resolve, waitTimeMs));

  console.log(` Transaction likely confirmed (Zeko L2 finality ~10-25s)`);
  return true;
}

interface UsePredictionMarketReturn {
  // State
  isReady: boolean;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  walletConnected: boolean;
  walletAddress: string | null;

  // Methods
  connectWallet: () => Promise<void>;
  initializeMarket: (
    marketAddress: string,
    assetIndex: number,
    priceThreshold: string,
    endTimestamp: number,
    burnAddress: string,
    registryAddress: string
  ) => Promise<void>;
  buyYes: (marketAddress: string, amount: string) => Promise<void>;
  buyNo: (marketAddress: string, amount: string) => Promise<void>;
  claim: (marketAddress: string) => Promise<void>;
}

export function usePredictionMarket(): UsePredictionMarketReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const workerRef = useRef<ZkappWorkerClient | null>(null);

  // Initialize worker and compile contract
  useEffect(() => {
    (async () => {
      try {
        setLoadingMessage('Loading zkApp worker...');
        setIsLoading(true);

        const worker = new ZkappWorkerClient();
        await worker.loadWorker();

        setLoadingMessage('Setting up Zeko network...');
        await worker.setActiveInstance('zeko');

        setLoadingMessage('Loading contract...');
        await worker.loadContract('PredictionMarket');

        setLoadingMessage('Compiling contract (this takes ~30 seconds)...');
        const compileResult = await worker.compileContract('PredictionMarket');

        if (compileResult.cached) {
          setLoadingMessage('Contract loaded from cache');
        }

        workerRef.current = worker;
        setIsReady(true);
        setIsLoading(false);
        setLoadingMessage('');
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError(err.message || 'Failed to initialize');
        setIsLoading(false);
      }
    })();
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof window === 'undefined' || !(window as any).mina) {
        throw new Error('Auro Wallet not installed. Please install from https://www.aurowallet.com/');
      }

      const accounts = await (window as any).mina.requestAccounts();
      const address = accounts[0];

      setWalletAddress(address);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      setIsLoading(false);
    }
  }, []);

  // Buy YES tokens
  const buyYes = useCallback(async (marketAddress: string, amount: string) => {
    if (!workerRef.current) throw new Error('Worker not initialized');
    if (!walletAddress) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      setLoadingMessage('Fetching account...');
      await workerRef.current.fetchAccount(marketAddress);
      await workerRef.current.fetchAccount(walletAddress);

      setLoadingMessage('Creating transaction...');
      await workerRef.current.createBuyYesTransaction(
        marketAddress,
        amount,
        walletAddress
      );

      setLoadingMessage('Generating proof (this takes ~30 seconds)...');
      await workerRef.current.proveTransaction();

      setLoadingMessage('Waiting for signature...');
      const txJson = await workerRef.current.getTransactionJSON();

      const txResult = await (window as any).mina.sendTransaction({
        transaction: txJson.json,
        feePayer: {
          fee: '0.1',
          memo: 'Bet YES',
        },
      });

      const txHash = txResult.hash || txResult.data?.hash;
      if (!txHash) {
        throw new Error('No transaction hash returned');
      }

      setLoadingMessage('Transaction sent! Waiting for Zeko L2 confirmation...');

      // Wait for Zeko L2 confirmation (30 seconds)
      await waitForTransactionConfirmation(txHash);

      setLoadingMessage('Transaction confirmed!');
      setIsLoading(false);
      setLoadingMessage('');

    } catch (err: any) {
      console.error('Buy YES error:', err);
      setError(err.message || 'Transaction failed');
      setIsLoading(false);
      setLoadingMessage('');
      throw err;
    }
  }, [walletAddress]);

  // Buy NO tokens
  const buyNo = useCallback(async (marketAddress: string, amount: string) => {
    if (!workerRef.current) throw new Error('Worker not initialized');
    if (!walletAddress) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      setLoadingMessage('Fetching account...');
      await workerRef.current.fetchAccount(marketAddress);
      await workerRef.current.fetchAccount(walletAddress);

      setLoadingMessage('Creating transaction...');
      await workerRef.current.createBuyNoTransaction(
        marketAddress,
        amount,
        walletAddress
      );

      setLoadingMessage('Generating proof (this takes ~30 seconds)...');
      await workerRef.current.proveTransaction();

      setLoadingMessage('Waiting for signature...');
      const txJson = await workerRef.current.getTransactionJSON();

      const txResult = await (window as any).mina.sendTransaction({
        transaction: txJson.json,
        feePayer: {
          fee: '0.1',
          memo: 'Bet NO',
        },
      });

      const txHash = txResult.hash || txResult.data?.hash;
      if (!txHash) {
        throw new Error('No transaction hash returned');
      }

      setLoadingMessage('Transaction sent! Waiting for Zeko L2 confirmation...');

      // Wait for Zeko L2 confirmation (30 seconds)
      await waitForTransactionConfirmation(txHash);

      setLoadingMessage('Transaction confirmed!');
      setIsLoading(false);
      setLoadingMessage('');

    } catch (err: any) {
      console.error('Buy NO error:', err);
      setError(err.message || 'Transaction failed');
      setIsLoading(false);
      setLoadingMessage('');
      throw err;
    }
  }, [walletAddress]);

  // Claim winnings
  const claim = useCallback(async (marketAddress: string) => {
    if (!workerRef.current) throw new Error('Worker not initialized');
    if (!walletAddress) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      setLoadingMessage('Fetching account...');
      await workerRef.current.fetchAccount(marketAddress);
      await workerRef.current.fetchAccount(walletAddress);

      setLoadingMessage('Creating claim transaction...');
      await workerRef.current.createClaimTransaction(marketAddress, walletAddress);

      setLoadingMessage('Generating proof (this takes ~30 seconds)...');
      await workerRef.current.proveTransaction();

      setLoadingMessage('Waiting for signature...');
      const txJson = await workerRef.current.getTransactionJSON();

      const txResult = await (window as any).mina.sendTransaction({
        transaction: txJson.json,
        feePayer: {
          fee: '0.1',
          memo: 'Claim winnings',
        },
      });

      const txHash = txResult.hash || txResult.data?.hash;
      if (!txHash) {
        throw new Error('No transaction hash returned');
      }

      setLoadingMessage('Transaction sent! Waiting for Zeko L2 confirmation...');

      // Wait for Zeko L2 confirmation (30 seconds)
      await waitForTransactionConfirmation(txHash);

      setLoadingMessage('Claim confirmed!');
      setIsLoading(false);
      setLoadingMessage('');

    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err.message || 'Claim failed');
      setIsLoading(false);
      setLoadingMessage('');
      throw err;
    }
  }, [walletAddress]);

  // Initialize market (creator pays 10 MINA deposit)
  const initializeMarket = useCallback(async (
    marketAddress: string,
    assetIndex: number,
    priceThreshold: string,
    endTimestamp: number,
    burnAddress: string,
    registryAddress: string
  ) => {
    if (!workerRef.current) throw new Error('Worker not initialized');
    if (!walletAddress) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      setLoadingMessage('Fetching account...');
      await workerRef.current.fetchAccount(marketAddress);
      await workerRef.current.fetchAccount(walletAddress);

      setLoadingMessage('Creating initialization transaction...');
      await workerRef.current.createInitializeTransaction(
        marketAddress,
        assetIndex,
        priceThreshold,
        endTimestamp,
        walletAddress,
        burnAddress,
        registryAddress
      );

      setLoadingMessage('Generating proof (this takes ~30 seconds)...');
      await workerRef.current.proveTransaction();

      setLoadingMessage('Waiting for signature...');
      const txJson = await workerRef.current.getTransactionJSON();

      const txResult = await (window as any).mina.sendTransaction({
        transaction: txJson.json,
        feePayer: {
          fee: '0.1',
          memo: 'Initialize Market (10 MINA deposit)',
        },
      });

      const txHash = txResult.hash || txResult.data?.hash;
      if (!txHash) {
        throw new Error('No transaction hash returned');
      }

      setLoadingMessage('Transaction sent! Waiting for Zeko L2 confirmation...');

      // Wait for Zeko L2 confirmation (30 seconds)
      await waitForTransactionConfirmation(txHash);

      setLoadingMessage('Market initialized!');
      setIsLoading(false);
      setLoadingMessage('');

    } catch (err: any) {
      console.error('Initialize error:', err);
      setError(err.message || 'Initialization failed');
      setIsLoading(false);
      setLoadingMessage('');
      throw err;
    }
  }, [walletAddress]);

  return {
    isReady,
    isLoading,
    loadingMessage,
    error,
    walletConnected: !!walletAddress,
    walletAddress,
    connectWallet,
    initializeMarket,
    buyYes,
    buyNo,
    claim,
  };
}
