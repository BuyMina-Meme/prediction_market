'use client';

import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Grid,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Input,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { usePredictionMarket } from '../hooks/usePredictionMarket';

const ASSETS = ['MINA', 'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC', 'LINK', 'DOGE'];

interface Market {
  marketId: number;
  marketAddress: string;
  creator: string;
  assetIndex: number;
  assetName: string;
  priceThreshold: string;
  endTimestamp: number;
  status: 'PENDING_INIT' | 'ACTIVE' | 'LOCKED' | 'AWAITING' | 'SETTLED';
  yesPool?: string;
  noPool?: string;
  outcome?: 'PENDING' | 'YES' | 'NO';
}

interface BetTabProps {
  wallet: string | null;
}

export default function BetTab({ wallet }: BetTabProps) {
  const toast = useToast();
  const {
    isReady,
    isLoading: zkappLoading,
    loadingMessage,
    error: zkappError,
    walletConnected,
    walletAddress,
    connectWallet,
    initializeMarket,
    buyYes,
    buyNo,
    claim,
  } = usePredictionMarket();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});

  // Load markets from API
  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadMarkets = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const response = await axios.get(`${apiBase}/api/markets`);
      if (response.data.success) {
        setMarkets(response.data.markets);
      }
    } catch (error: any) {
      console.error('Failed to load markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async (market: Market) => {
    if (!walletAddress) return;

    try {
      // Get initParams from backend (should be stored with PENDING_INIT market)
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const response = await axios.get(`${apiBase}/api/markets/${market.marketId}`);

      if (!response.data.success || !response.data.market?.initParams) {
        throw new Error('Failed to fetch initialization parameters');
      }

      const { initParams } = response.data.market;

      await initializeMarket(
        market.marketAddress,
        initParams.assetIndex,
        initParams.priceThreshold,
        initParams.endTimestamp,
        initParams.burnAddress,
        initParams.registryAddress
      );

      toast({
        title: 'Market initialized!',
        description: 'You paid 10 MINA deposit. Market is now ACTIVE.',
        status: 'success',
        duration: 5000,
      });
      loadMarkets();
    } catch (error: any) {
      toast({
        title: 'Initialization failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleBetYes = async (market: Market) => {
    const amount = betAmounts[market.marketId] || '1';
    const amountNanomina = (parseFloat(amount) * 1e9).toString();

    try {
      await buyYes(market.marketAddress, amountNanomina);
      toast({
        title: 'Bet placed!',
        description: `${amount} MINA on YES`,
        status: 'success',
        duration: 5000,
      });
      loadMarkets();
    } catch (error: any) {
      toast({
        title: 'Bet failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleBetNo = async (market: Market) => {
    const amount = betAmounts[market.marketId] || '1';
    const amountNanomina = (parseFloat(amount) * 1e9).toString();

    try {
      await buyNo(market.marketAddress, amountNanomina);
      toast({
        title: 'Bet placed!',
        description: `${amount} MINA on NO`,
        status: 'success',
        duration: 5000,
      });
      loadMarkets();
    } catch (error: any) {
      toast({
        title: 'Bet failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleClaim = async (market: Market) => {
    try {
      await claim(market.marketAddress);
      toast({
        title: 'Winnings claimed!',
        status: 'success',
        duration: 5000,
      });
      loadMarkets();
    } catch (error: any) {
      toast({
        title: 'Claim failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const formatTimeRemaining = (endTimestamp: number): string => {
    const now = Date.now();
    const remaining = endTimestamp - now;
    if (remaining <= 0) return 'Ended';

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Show zkApp initialization status
  if (!isReady) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" mb={4} />
        <Text>{loadingMessage || 'Initializing zkApp...'}</Text>
        {zkappError && (
          <Alert status="error" mt={4}>
            <AlertIcon />
            {zkappError}
          </Alert>
        )}
      </Box>
    );
  }

  // Show wallet connection prompt
  if (!walletConnected) {
    return (
      <Box textAlign="center" py={10}>
        <Heading size="md" mb={4}>
          Connect Wallet to Bet
        </Heading>
        <Button colorScheme="blue" onClick={connectWallet} isLoading={zkappLoading}>
          Connect Auro Wallet
        </Button>
        {zkappError && (
          <Alert status="error" mt={4}>
            <AlertIcon />
            {zkappError}
          </Alert>
        )}
      </Box>
    );
  }

  // Show loading message during transaction
  if (zkappLoading && loadingMessage) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" mb={4} />
        <Text>{loadingMessage}</Text>
        <Text fontSize="sm" color="gray.500" mt={2}>
          This may take up to 30 seconds...
        </Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading markets...</Text>
      </Box>
    );
  }

  if (markets.length === 0) {
    return (
      <Alert status="info">
        <AlertIcon />
        No active markets available. Create one to get started!
      </Alert>
    );
  }

  return (
    <Box>
      {/* Wallet Info */}
      <Box mb={6} p={4} bg="rgba(255, 255, 255, 0.05)" borderRadius="md">
        <Text fontSize="sm" color="gray.400">
          Connected: <strong>{walletAddress?.slice(0, 10)}...{walletAddress?.slice(-8)}</strong>
        </Text>
      </Box>

      {/* Markets Grid */}
      <Grid templateColumns="repeat(auto-fill, minmax(350px, 1fr))" gap={6}>
        {markets.map((market) => (
          <Card key={market.marketId} bg="rgba(255, 255, 255, 0.05)">
            <CardHeader pb={2}>
              <HStack justify="space-between">
                <Heading size="md">{ASSETS[market.assetIndex]}</Heading>
                <Badge colorScheme={
                  market.status === 'PENDING_INIT' ? 'orange' :
                  market.status === 'ACTIVE' ? 'green' :
                  market.status === 'SETTLED' ? 'blue' : 'yellow'
                }>
                  {market.status}
                </Badge>
              </HStack>
              <Text fontSize="xs" color="gray.500">
                Market #{market.marketId}
              </Text>
            </CardHeader>

            <CardBody pt={2}>
              <VStack align="stretch" spacing={3}>
                {/* Question */}
                <Text fontSize="sm">
                  Will {ASSETS[market.assetIndex]} be above{' '}
                  <strong>${(parseFloat(market.priceThreshold) / 1e10).toFixed(2)}</strong>?
                </Text>

                {/* Time */}
                <Text fontSize="sm" color="gray.400">
                  ⏱ {formatTimeRemaining(market.endTimestamp)}
                </Text>

                {/* Pools */}
                {market.yesPool && market.noPool && (
                  <HStack fontSize="sm" spacing={4}>
                    <Text color="green.400">
                      YES: {(parseFloat(market.yesPool) / 1e9).toFixed(2)} MINA
                    </Text>
                    <Text color="red.400">
                      NO: {(parseFloat(market.noPool) / 1e9).toFixed(2)} MINA
                    </Text>
                  </HStack>
                )}

                {/* Actions */}
                {market.status === 'PENDING_INIT' && market.creator === walletAddress ? (
                  <>
                    <Alert status="warning" py={2}>
                      <AlertIcon />
                      Needs initialization (10 MINA deposit)
                    </Alert>
                    <Button
                      colorScheme="blue"
                      onClick={() => handleInitialize(market)}
                      isLoading={zkappLoading}
                    >
                      Initialize Market (10 MINA)
                    </Button>
                  </>
                ) : market.status === 'PENDING_INIT' ? (
                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    Awaiting creator initialization
                  </Text>
                ) : market.status === 'ACTIVE' ? (
                  <>
                    <VStack spacing={1} align="stretch">
                      <Input
                        placeholder="Amount (MINA)"
                        type="number"
                        step="0.1"
                        min="0.001"
                        value={betAmounts[market.marketId] || ''}
                        onChange={(e) =>
                          setBetAmounts({ ...betAmounts, [market.marketId]: e.target.value })
                        }
                      />
                      <Text fontSize="xs" color="gray.500">
                        Minimum: 0.001 MINA (UI enforced, contract allows lower)
                      </Text>
                    </VStack>
                    <HStack>
                      <Button
                        colorScheme="green"
                        flex={1}
                        onClick={() => handleBetYes(market)}
                        isLoading={zkappLoading}
                      >
                        Bet YES
                      </Button>
                      <Button
                        colorScheme="red"
                        flex={1}
                        onClick={() => handleBetNo(market)}
                        isLoading={zkappLoading}
                      >
                        Bet NO
                      </Button>
                    </HStack>
                  </>
                ) : market.status === 'SETTLED' && market.outcome ? (
                  <>
                    <Alert status={market.outcome === 'YES' ? 'success' : 'error'} py={2}>
                      <AlertIcon />
                      Outcome: {market.outcome}
                    </Alert>
                    <Button
                      colorScheme="purple"
                      onClick={() => handleClaim(market)}
                      isLoading={zkappLoading}
                    >
                      Claim Winnings
                    </Button>
                  </>
                ) : (
                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    Betting is closed
                  </Text>
                )}
              </VStack>
            </CardBody>
          </Card>
        ))}
      </Grid>
    </Box>
  );
}
