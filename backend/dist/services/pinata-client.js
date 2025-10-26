/**
 * Pinata IPFS Client
 * Handles pinning and unpinning of global markets JSON
 */
import axios from 'axios';
const PINATA_API_URL = 'https://api.pinata.cloud';
let pinataConfig = null;
/**
 * Initialize Pinata client with JWT
 */
export function initPinata(jwt) {
    pinataConfig = { jwt };
}
/**
 * Pin JSON data to IPFS
 */
export async function pinJSONToIPFS(data, filename) {
    if (!pinataConfig) {
        throw new Error('Pinata not initialized. Call initPinata() first.');
    }
    try {
        const response = await axios.post(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
            pinataContent: data,
            pinataMetadata: {
                name: filename,
            },
        }, {
            headers: {
                Authorization: `Bearer ${pinataConfig.jwt}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data.IpfsHash;
    }
    catch (error) {
        console.error('Failed to pin to IPFS:', error.response?.data || error.message);
        throw new Error(`IPFS pinning failed: ${error.message}`);
    }
}
/**
 * Unpin content from IPFS
 */
export async function unpinFromIPFS(cid) {
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
    }
    catch (error) {
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
export async function updateGlobalMarketsIPFS(markets, oldCID) {
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
//# sourceMappingURL=pinata-client.js.map