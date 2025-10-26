/**
 * Configuration module - Centralized configuration management
 */
import { PrivateKey, PublicKey } from 'o1js';
export declare const config: {
    localMode: boolean;
    port: number;
    nodeEnv: string;
    zekoNetworkUrl: string;
    chain: string;
    registryAddress: string;
    dootOracleAddress: string;
    burnAddress: string;
    deployerPrivateKey: string;
    redis: {
        url: string;
        token: string;
    };
    pinata: {
        jwt: string;
        gateway: string;
    };
    api: {
        rateLimit: number;
        rateWindow: number;
    };
    settlement: {
        checkInterval: number;
        dootPollInterval: number;
    };
};
/**
 * Validate configuration
 */
export declare function validateConfig(): {
    valid: boolean;
    errors: string[];
};
/**
 * Get deployer keypair
 */
export declare function getDeployerKeypair(): {
    privateKey: PrivateKey;
    publicKey: PublicKey;
};
/**
 * Get registry address
 */
export declare function getRegistryAddress(): PublicKey;
/**
 * Get Doot oracle address
 */
export declare function getDootOracleAddress(): PublicKey;
/**
 * Get burn address (40% of fees sent here - unrecoverable)
 */
export declare function getBurnAddress(): PublicKey;
//# sourceMappingURL=config.d.ts.map