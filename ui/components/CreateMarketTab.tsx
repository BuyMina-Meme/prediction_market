'use client';

import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Select,
  Input,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  FormHelperText,
  Card,
  CardBody,
  Heading,
  HStack,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { usePredictionMarket } from '../hooks/usePredictionMarket';

const ASSETS = [
  { index: 0, name: 'MINA', dootName: 'mina' },
  { index: 1, name: 'BTC', dootName: 'bitcoin' },
  { index: 2, name: 'ETH', dootName: 'ethereum' },
  { index: 3, name: 'SOL', dootName: 'solana' },
  { index: 4, name: 'XRP', dootName: 'ripple' },
  { index: 5, name: 'ADA', dootName: 'cardano' },
  { index: 6, name: 'AVAX', dootName: 'avalanche' },
  { index: 7, name: 'MATIC', dootName: 'polygon' },
  { index: 8, name: 'LINK', dootName: 'chainlink' },
  { index: 9, name: 'DOGE', dootName: 'dogecoin' },
];

interface CreateMarketTabProps {
  wallet: string | null;
}

export default function CreateMarketTab({ wallet }: CreateMarketTabProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const { initializeMarket, isLoading: zkappLoading, loadingMessage } = usePredictionMarket();

  const [assetIndex, setAssetIndex] = useState(2); // ETH
  const [priceThreshold, setPriceThreshold] = useState('');
  const [duration, setDuration] = useState(7); // Days
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Fetch current price from Doot API when asset changes
  useEffect(() => {
    const fetchDootPrice = async () => {
      setFetchingPrice(true);
      setCurrentPrice(null);

      try {
        const tokenName = ASSETS[assetIndex].dootName;
        const apiKey = process.env.NEXT_PUBLIC_DOOT_API_KEY || '';

        const response = await axios.get(
          `https://doot.foundation/api/get/price?token=${tokenName}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (response.data?.price_data?.price) {
          // Doot returns price with 10 decimals
          const priceWithDecimals = response.data.price_data.price;
          const priceUSD = (parseFloat(priceWithDecimals) / 1e10).toFixed(2);
          setCurrentPrice(priceUSD);
        }
      } catch (error: any) {
        console.error('Failed to fetch Doot price:', error);
        // Don't show error toast, just fail silently
      } finally {
        setFetchingPrice(false);
      }
    };

    fetchDootPrice();
  }, [assetIndex]);

  const handleCreateMarket = async () => {
    if (!wallet) {
      toast({
        title: 'Wallet not connected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!priceThreshold || parseFloat(priceThreshold) <= 0) {
      toast({
        title: 'Invalid price threshold',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (duration < 1 || duration > 7) {
      toast({
        title: 'Duration must be between 1-7 days',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      // Show loading overlay during zkApp operations
      if (zkappLoading && loadingMessage) {
        toast({
          title: loadingMessage,
          status: 'info',
          duration: null,
          isClosable: false,
        });
      }
      // Convert price to Doot format (price * 10^10)
      const thresholdInDootFormat = (parseFloat(priceThreshold) * 1e10).toString();

      // Calculate end timestamp
      const endTimestamp = Date.now() + duration * 24 * 60 * 60 * 1000;

      // Call backend API to create market (deploys contract)
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const response = await axios.post(`${apiBase}/api/markets`, {
        assetIndex,
        priceThreshold: thresholdInDootFormat,
        endTimestamp,
        creator: wallet,
      });

      if (response.data.success) {
        const { marketAddress, initParams } = response.data;

        // Show deployment success
        toast({
          title: 'Market deployed!',
          description: 'Now initializing with your deposit (10 MINA)...',
          status: 'info',
          duration: 3000,
        });

        // Call initialize with creator's signature
        try {
          await initializeMarket(
            marketAddress,
            initParams.assetIndex,
            initParams.priceThreshold,
            initParams.endTimestamp,
            initParams.burnAddress,
            initParams.registryAddress
          );

          toast({
            title: 'Market created successfully!',
            description: `Market initialized and active. You paid 10 MINA deposit.`,
            status: 'success',
            duration: 5000,
          });

          // Reset form
          setPriceThreshold('');
          setDuration(7);
        } catch (initError: any) {
          toast({
            title: 'Initialization failed',
            description: initError.message || 'Failed to initialize market. Contract deployed but not active.',
            status: 'error',
            duration: 10000,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Failed to create market',
        description: error.response?.data?.error || error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return (
      <Alert status="warning">
        <AlertIcon />
        Please connect your wallet to create a market
      </Alert>
    );
  }

  return (
    <Box maxW="600px" mx="auto">
      <Card bg="rgba(255, 255, 255, 0.05)">
        <CardBody>
          <VStack spacing={6} align="stretch">
            <Heading size="md">Create Prediction Market</Heading>

            <Alert status="info" fontSize="sm">
              <AlertIcon />
              Requires 10 MINA deposit (0.5 MINA per pool + 9 MINA settlement reward)
            </Alert>

            {/* Asset Selection */}
            <FormControl>
              <FormLabel>Asset</FormLabel>
              <Select
                value={assetIndex}
                onChange={(e) => setAssetIndex(parseInt(e.target.value))}
              >
                {ASSETS.map((asset) => (
                  <option key={asset.index} value={asset.index}>
                    {asset.name}
                  </option>
                ))}
              </Select>
              <FormHelperText>
                Choose the cryptocurrency for this market
              </FormHelperText>
            </FormControl>

            {/* Price Threshold */}
            <FormControl>
              <FormLabel>Price Threshold (USD)</FormLabel>
              {currentPrice && (
                <Text fontSize="sm" color="gray.400" mb={2}>
                  Current price: ${currentPrice}
                </Text>
              )}
              {fetchingPrice && (
                <Text fontSize="sm" color="gray.500" mb={2}>
                  Fetching current price...
                </Text>
              )}
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., 3500.00"
                value={priceThreshold}
                onChange={(e) => setPriceThreshold(e.target.value)}
              />
              <FormHelperText>
                Market predicts if {ASSETS[assetIndex].name} will be ABOVE this price
              </FormHelperText>
            </FormControl>

            {/* Duration */}
            <FormControl>
              <FormLabel>Duration (Days)</FormLabel>
              <Input
                type="number"
                min={1}
                max={7}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              />
              <FormHelperText>
                Market will run for {duration} day{duration !== 1 ? 's' : ''}. Min: 1, Max: 7
              </FormHelperText>
            </FormControl>

            {/* Summary */}
            <Box bg="rgba(255, 255, 255, 0.03)" p={4} borderRadius="md">
              <Text fontSize="sm" fontWeight="bold" mb={2}>
                Market Question:
              </Text>
              <Text fontSize="sm">
                Will <strong>{ASSETS[assetIndex].name}</strong> be above{' '}
                <strong>${priceThreshold || '___'}</strong> in <strong>{duration} days</strong>?
              </Text>
            </Box>

            {/* Create Button */}
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleCreateMarket}
              isLoading={loading}
              loadingText="Creating Market..."
            >
              Create Market (10 MINA)
            </Button>

            {/* Info */}
            <Box fontSize="xs" color="gray.500">
              <Text>• Betting closes 30 minutes before market end</Text>
              <Text>• Settlement happens automatically via Doot Oracle</Text>
              <Text>• Winners claim proportional payouts (0.2% fee)</Text>
              <Text>• Minimum bet: 1 nanomina (0.000000001 MINA)</Text>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
}
