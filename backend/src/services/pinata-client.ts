/**
 * Pinata IPFS Client
 * Handles pinning and unpinning of global markets JSON
 */

import axios from 'axios';

const PINATA_API_URL = 'https://api.pinata.cloud';

interface PinataConfig {
  jwt: string;
}

let pinataConfig: PinataConfig | null = null;

/**
 * Initialize Pinata client with JWT
 */
export function initPinata(jwt: string) {
  pinataConfig = { jwt };
}

/**
 * Pin JSON data to IPFS
 */
export async function pinJSONToIPFS(data: any, filename: string): Promise<string> {
  if (!pinataConfig) {
    throw new Error('Pinata not initialized. Call initPinata() first.');
  }

  try {
    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinJSONToIPFS`,
      {
        pinataContent: data,
        pinataMetadata: {
          name: filename,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${pinataConfig.jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.IpfsHash;
  } catch (error: any) {
    console.error('Failed to pin to IPFS:', error.response?.data || error.message);
    throw new Error(`IPFS pinning failed: ${error.message}`);
  }
}

/**
 * Unpin content from IPFS
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  if (!pinataConfig) {
    throw new Error('Pinata not initialized. Call initPinata() first.');
  }

  try {
    await axios.delete(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
      headers: {
        Authorization: `Bearer ${pinataConfig.jwt}`,
      },
    });

    console.log(`    Unpinned old CID: ${cid}`);
  } catch (error: any) {
    // Don't throw error on unpin failure - it's not critical
    console.warn(`     Failed to unpin ${cid}:`, error.message);
  }
}

/**
 * Update global markets JSON on IPFS
 *
 * Flow:
 * 1. Get all markets from Redis
 * 2. Create JSON object
 * 3. Pin to IPFS
 * 4. Get new CID
 * 5. Unpin old CID (if exists)
 * 6. Store new CID in Redis
 */
export async function updateGlobalMarketsIPFS(
  markets: any[],
  oldCID: string | null
): Promise<string> {
  const globalMarketsData = {
    markets,
    updatedAt: new Date().toISOString(),
    totalMarkets: markets.length,
  };

  console.log(`\n Pinning ${markets.length} markets to IPFS...`);

  // Pin new data
  const newCID = await pinJSONToIPFS(globalMarketsData, 'global-markets.json');
  console.log(`    Pinned new CID: ${newCID}`);

  // Unpin old data if exists
  if (oldCID) {
    await unpinFromIPFS(oldCID);
  }

  return newCID;
}
