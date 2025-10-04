/**
 * Configuration module - Centralized configuration management
 */

import dotenv from 'dotenv';
import { PrivateKey, PublicKey } from 'o1js';

// Load environment variables
dotenv.config();

export const config = {
  // Local mode (use LocalBlockchain and memory storage)
  localMode: process.env.LOCAL_MODE === 'true',
  // Server
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Network
  zekoNetworkUrl: process.env.ZEKO_NETWORK_URL || 'https://devnet.zeko.io/graphql',
  chain: process.env.CHAIN || 'devnet',

  // Contract Addresses
  registryAddress: process.env.REGISTRY_ADDRESS || '',
  dootOracleAddress: process.env.DOOT_ORACLE_ADDRESS || '',
  // Burn address (40% of fees sent here - unrecoverable)
  burnAddress: process.env.BURN_ADDRESS || 'B62qiburnzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzmp7r7UN6X',

  // Deployer
  deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY || '',

  // Upstash Redis
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },

  // IPFS/Pinata
  pinata: {
    jwt: process.env.PINATA_JWT || '',
    gateway: process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud',
  },

  // API
  api: {
    rateLimit: parseInt(process.env.API_RATE_LIMIT || '100'),
    rateWindow: parseInt(process.env.API_RATE_WINDOW || '60000'),
  },

  // Settlement Monitor
  settlement: {
    checkInterval: parseInt(process.env.SETTLEMENT_CHECK_INTERVAL || '30000'),
    dootPollInterval: parseInt(process.env.DOOT_POLL_INTERVAL || '10000'),
  },
};

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!config.registryAddress && !config.localMode) {
    errors.push('REGISTRY_ADDRESS is required');
  } else {
    try {
      if (config.registryAddress) PublicKey.fromBase58(config.registryAddress);
    } catch (e) {
      errors.push('REGISTRY_ADDRESS is not a valid public key');
    }
  }

  if (!config.deployerPrivateKey) {
    errors.push('DEPLOYER_PRIVATE_KEY is required');
  } else {
    try {
      PrivateKey.fromBase58(config.deployerPrivateKey);
    } catch (e) {
      errors.push('DEPLOYER_PRIVATE_KEY is not a valid private key');
    }
  }

  if (!config.dootOracleAddress && !config.localMode) {
    console.warn('  DOOT_ORACLE_ADDRESS not set (optional for testing)');
  }

  // Check Upstash Redis credentials
  if (!config.redis.url || !config.redis.token) {
    errors.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get deployer keypair
 */
export function getDeployerKeypair() {
  const privateKey = PrivateKey.fromBase58(config.deployerPrivateKey);
  const publicKey = privateKey.toPublicKey();
  return { privateKey, publicKey };
}

/**
 * Get registry address
 */
export function getRegistryAddress() {
  return PublicKey.fromBase58(config.registryAddress);
}

/**
 * Get Doot oracle address
 */
export function getDootOracleAddress() {
  if (!config.dootOracleAddress) {
    throw new Error('DOOT_ORACLE_ADDRESS not configured');
  }
  return PublicKey.fromBase58(config.dootOracleAddress);
}

/**
 * Get burn address (40% of fees sent here - unrecoverable)
 */
export function getBurnAddress() {
  return PublicKey.fromBase58(config.burnAddress);
}
