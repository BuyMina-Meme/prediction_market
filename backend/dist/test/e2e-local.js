/**
 * Local E2E test: backend services + contracts on LocalBlockchain
 * - Uses real Doot vendor contract from contracts build
 */
import { Mina, PrivateKey, PublicKey, AccountUpdate, Field, UInt64, MerkleMap } from 'o1js';
import dotenv from 'dotenv';
dotenv.config();
import { config } from '../config.js';
import { deployMarket } from '../services/market-deployer.js';
import { startSettlementMonitor } from '../services/settlement-monitor.js';
// Contracts from build
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PredictionMarket, predictionMarketOffchainState, MarketRegistry, marketRegistryOffchainState, MULTIPLICATION_FACTOR } from '../../contracts/build/src/index.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Doot, IpfsCID, TokenInformationArray, offchainState as DootOffchainState } from '../../contracts/build/src/vendor/Doot.js';
async function main() {
    // Use LocalBlockchain
    process.env.LOCAL_MODE = 'true';
    process.env.REDIS_HOST = 'memory';
    const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    const [deployer, creator, yesUser, noUser, settler] = Local.testAccounts;
    // Compile offchain states & contracts
    await predictionMarketOffchainState.compile();
    await marketRegistryOffchainState.compile();
    await DootOffchainState.compile();
    await PredictionMarket.compile();
    await MarketRegistry.compile();
    await Doot.compile();
    // Deploy Doot
    const dootKey = PrivateKey.random();
    const dootAddress = dootKey.toPublicKey();
    const doot = new Doot(dootAddress);
    doot.offchainState.setContractInstance(doot);
    let tx = await Mina.transaction(deployer, async () => {
        AccountUpdate.fundNewAccount(deployer);
        await doot.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, dootKey]).send();
    // Initialize Doot with MINA = $0.165
    const prices = Array(10).fill(Field(0));
    prices[0] = Field(165).mul(MULTIPLICATION_FACTOR).div(Field(1000));
    const tInfo = new TokenInformationArray({ prices });
    const commit0 = new MerkleMap().getRoot();
    const ipfs0 = IpfsCID.fromString('init');
    tx = await Mina.transaction(deployer, async () => {
        await doot.initBase(commit0, ipfs0, tInfo);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    const dootProof0 = await doot.offchainState.createSettlementProof();
    tx = await Mina.transaction(deployer, async () => {
        await doot.settle(dootProof0);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    // Deploy MarketRegistry and initialize owner
    const registryKey = PrivateKey.random();
    const registryAddress = registryKey.toPublicKey();
    const registry = new MarketRegistry(registryAddress);
    tx = await Mina.transaction(deployer, async () => {
        AccountUpdate.fundNewAccount(deployer);
        await registry.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, registryKey]).send();
    tx = await Mina.transaction(deployer, async () => {
        await registry.initialize();
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    // Wire backend config
    process.env.DEPLOYER_PRIVATE_KEY = deployer.key.toBase58();
    process.env.REGISTRY_ADDRESS = registryAddress.toBase58();
    process.env.DOOT_ORACLE_ADDRESS = dootAddress.toBase58();
    // Refresh config module values (already read at import time)
    config.localMode = true;
    // Upstash Redis is serverless - no connect() method exists
    startSettlementMonitor();
    // Create market via backend service
    const request = {
        assetIndex: 0, // MINA
        priceThreshold: Field(17).mul(MULTIPLICATION_FACTOR).div(Field(100)).toString(), // 0.17
        endTimestamp: 0, // immediate (for local e2e)
        creator: creator.toBase58(),
    };
    const createRes = await deployMarket(request);
    if (!createRes.success)
        throw new Error('deployMarket failed: ' + createRes.error);
    const marketAddress58 = createRes.marketAddress;
    const market = new PredictionMarket(PublicKey.fromBase58(marketAddress58));
    // Initialize market (creator pays 10 MINA deposit)
    tx = await Mina.transaction(creator, async () => {
        await market.initialize(Field(0), // assetIndex: MINA
        Field(BigInt(createRes.initParams.priceThreshold)), UInt64.from(createRes.initParams.endTimestamp), creator, PublicKey.fromBase58(createRes.initParams.burnAddress), PublicKey.fromBase58(createRes.initParams.registryAddress));
    });
    await tx.prove();
    await tx.sign([creator.key]).send();
    // YES bet 100 MINA
    tx = await Mina.transaction(yesUser, async () => {
        await market.buyYes(UInt64.from(100 * 1_000_000_000));
    });
    await tx.prove();
    await tx.sign([yesUser.key]).send();
    // NO bet 100 MINA
    tx = await Mina.transaction(noUser, async () => {
        await market.buyNo(UInt64.from(100 * 1_000_000_000));
    });
    await tx.prove();
    await tx.sign([noUser.key]).send();
    // Update Doot price to 0.168 (<= 0.17) and settle offchain
    const prices1 = Array(10).fill(Field(0));
    prices1[0] = Field(168).mul(MULTIPLICATION_FACTOR).div(Field(1000));
    const tInfo1 = new TokenInformationArray({ prices: prices1 });
    const commit1 = new MerkleMap().getRoot();
    const ipfs1 = IpfsCID.fromString('post');
    tx = await Mina.transaction(deployer, async () => {
        await doot.update(commit1, ipfs1, tInfo1);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    const dootProof1 = await doot.offchainState.createSettlementProof();
    tx = await Mina.transaction(deployer, async () => {
        await doot.settle(dootProof1);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    // Allow monitor to observe new commitment and settle market
    // (since we run in a single process, just trigger directly as a safety)
    const settlerBalanceBefore = Mina.getBalance(settler).toBigInt();
    tx = await Mina.transaction(settler, async () => {
        await market.settleWithDoot(PublicKey.fromBase58(process.env.DOOT_ORACLE_ADDRESS));
    });
    await tx.prove();
    await tx.sign([settler.key]).send();
    const settlerBalanceAfter = Mina.getBalance(settler).toBigInt();
    if (settlerBalanceAfter - settlerBalanceBefore < BigInt(9e9)) {
        throw new Error('settler reward not received');
    }
    // Winner claim (NO)
    const noBefore = Mina.getBalance(noUser).toBigInt();
    tx = await Mina.transaction(noUser, async () => {
        await market.claim();
    });
    await tx.prove();
    await tx.sign([noUser.key]).send();
    const noAfter = Mina.getBalance(noUser).toBigInt();
    if (!(noAfter > noBefore)) {
        throw new Error('NO bettor did not receive payout');
    }
    // Loser claim (YES) should fail
    let failed = false;
    try {
        tx = await Mina.transaction(yesUser, async () => {
            await market.claim();
        });
        await tx.prove();
        await tx.sign([yesUser.key]).send();
    }
    catch (e) {
        failed = true;
    }
    if (!failed)
        throw new Error('YES bettor was able to claim unexpectedly');
    console.log(' Local E2E succeeded');
}
main().catch((e) => {
    console.error(' E2E failed:', e);
    process.exit(1);
});
//# sourceMappingURL=e2e-local.js.map