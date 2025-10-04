/**
 * Pinata IPFS Client
 * Handles pinning and unpinning of global markets JSON
 */
/**
 * Initialize Pinata client with JWT
 */
export declare function initPinata(jwt: string): void;
/**
 * Pin JSON data to IPFS
 */
export declare function pinJSONToIPFS(data: any, filename: string): Promise<string>;
/**
 * Unpin content from IPFS
 */
export declare function unpinFromIPFS(cid: string): Promise<void>;
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
export declare function updateGlobalMarketsIPFS(markets: any[], oldCID: string | null): Promise<string>;
//# sourceMappingURL=pinata-client.d.ts.map