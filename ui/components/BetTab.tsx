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
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { usePredictionMarket } from '../hooks/usePredictionMarket';
import {
  calculateBetFees,
  getPoolRatio,
  getImbalanceSeverity,
  getTimeUrgency,
  getImbalanceWarning,
  getTimeWarning,
  formatFeeRate,
  formatMina,
} from '../lib/v1-fees';

const ASSETS = ['MINA', 'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC', 'LINK', 'DOGE'];

interface Market {
  marketId: number;
  marketAddress: string;
  creator: string;
  assetIndex: number;
  assetName: string;
  priceThreshold: string;
  endTimestamp: number;
  startTimestamp?: number; // V1: For τ normalization
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

                {/* V1 Fee Preview & Warnings */}
                {market.status === 'ACTIVE' && market.yesPool && market.noPool && (() => {
                  const betAmount = parseFloat(betAmounts[market.marketId] || '1');
                  if (isNaN(betAmount) || betAmount <= 0) return null;

                  const yesPool = parseFloat(market.yesPool) / 1e9;
                  const noPool = parseFloat(market.noPool) / 1e9;
                  const now = Date.now();
                  const remaining = market.endTimestamp - now;
                  const totalDuration = market.startTimestamp
                    ? market.endTimestamp - market.startTimestamp
                    : 7 * 24 * 60 * 60 * 1000; // Default 7 days if not available
                  const tau = remaining / totalDuration;

                  const fees = calculateBetFees(betAmount, yesPool, noPool, remaining, totalDuration);
                  const poolRatio = getPoolRatio(yesPool, noPool);
                  const imbalanceSeverity = getImbalanceSeverity(poolRatio);
                  const timeUrgency = getTimeUrgency(tau);
                  const imbalanceWarning = getImbalanceWarning(imbalanceSeverity);
                  const timeWarning = getTimeWarning(timeUrgency);

                  return (
                    <Box
                      bg="rgba(0, 0, 0, 0.3)"
                      p={3}
                      borderRadius="md"
                      border="1px solid rgba(255, 255, 255, 0.1)"
                    >
                      <VStack align="stretch" spacing={2}>
                        <Text fontSize="xs" fontWeight="bold" color="gray.300">
                          V1 FEE PREVIEW ({formatFeeRate(fees.effectiveRate)} total)
                        </Text>

                        {/* Fee Breakdown */}
                        <HStack fontSize="xs" justify="space-between">
                          <Text color="gray.400">Base fee (0.2%):</Text>
                          <Text>{formatMina(fees.baseFee)} MINA</Text>
                        </HStack>
                        {fees.lateFee > 0 && (
                          <>
                            <HStack fontSize="xs" justify="space-between">
                              <Text color="gray.400">
                                Late fee (time {formatFeeRate(fees.timeFeeRate)} + imbalance {formatFeeRate(fees.imbalanceFeeRate)}):
                              </Text>
                              <Text color="orange.400">{formatMina(fees.lateFee)} MINA</Text>
                            </HStack>
                          </>
                        )}
                        <HStack fontSize="xs" justify="space-between" fontWeight="bold">
                          <Text>You receive:</Text>
                          <Text color="green.400">{formatMina(fees.netReceived)} shares</Text>
                        </HStack>

                        {/* Warnings */}
                        {imbalanceWarning && (
                          <Alert status={imbalanceSeverity === 'extreme' ? 'error' : 'warning'} py={1} fontSize="xs">
                            <AlertIcon boxSize={3} />
                            {imbalanceWarning}
                          </Alert>
                        )}
                        {timeWarning && (
                          <Alert status={timeUrgency === 'extreme' ? 'error' : 'warning'} py={1} fontSize="xs">
                            <AlertIcon boxSize={3} />
                            {timeWarning}
                          </Alert>
                        )}

                        {/* Pool Ratio Indicator */}
                        <HStack fontSize="xs" justify="space-between">
                          <Text color="gray.400">Pool balance:</Text>
                          <Text color={poolRatio < 0.5 ? 'red.400' : poolRatio < 0.8 ? 'orange.400' : 'green.400'}>
                            {(poolRatio * 100).toFixed(1)}% ({yesPool.toFixed(1)} / {noPool.toFixed(1)})
                          </Text>
                        </HStack>

                        <Text fontSize="xs" color="gray.500" fontStyle="italic">
                          Fees charged at bet time, distributed 50/50 treasury/burn
                        </Text>
                      </VStack>
                    </Box>
                  );
                })()}

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
                    Awaiting protocol initialization
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
                        V1: Min 1 nanomina, fees 0.2-20.2% (bet-time)
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
