'use client';

import {
  Box,
  Container,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  HStack,
  Button,
  useColorModeValue,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FaPlus, FaChartLine } from 'react-icons/fa';
import CreateMarketTab from '../components/CreateMarketTab';
import BetTab from '../components/BetTab';

export default function HomePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const connectWallet = async () => {
    try {
      if (typeof window === 'undefined') return;

      const mina = (window as any).mina;
      if (!mina) {
        alert('Please install Auro Wallet');
        return;
      }

      const accounts = await mina.requestAccounts();
      setWallet(accounts[0]);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet: ' + error.message);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
  };

  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Header */}
      <Box
        bg="rgba(0, 0, 0, 0.6)"
        backdropFilter="blur(10px)"
        borderBottom="1px"
        borderColor={borderColor}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Container maxW="container.xl" py={4}>
          <HStack justify="space-between">
            <VStack align="start" spacing={0}>
              <Heading size="lg">Prediction Market</Heading>
              <Text fontSize="sm" color="gray.500">
                Powered by Doot Oracle on Zeko L2
              </Text>
            </VStack>

            {wallet ? (
              <VStack align="end" spacing={1}>
                <Text fontSize="sm" color="gray.400">
                  Connected
                </Text>
                <HStack>
                  <Text fontSize="sm" fontFamily="mono">
                    {wallet.slice(0, 8)}...{wallet.slice(-6)}
                  </Text>
                  <Button size="sm" onClick={disconnectWallet} variant="ghost" colorScheme="red">
                    Disconnect
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <Button
                colorScheme="brand"
                onClick={connectWallet}
                size="md"
              >
                Connect Wallet
              </Button>
            )}
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={8}>
        <Tabs variant="enclosed" colorScheme="brand">
          <TabList mb={6}>
            <Tab>
              <HStack>
                <FaPlus />
                <Text>Create Market</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <FaChartLine />
                <Text>Browse & Bet</Text>
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <CreateMarketTab wallet={wallet} />
            </TabPanel>
            <TabPanel>
              <BetTab wallet={wallet} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Container>

      {/* Footer */}
      <Box
        as="footer"
        mt={20}
        py={6}
        borderTop="1px"
        borderColor={borderColor}
        textAlign="center"
      >
        <Text fontSize="sm" color="gray.500">
          Built with ❤️ on Mina Protocol • Powered by Doot Oracle
        </Text>
      </Box>
    </Box>
  );
}
