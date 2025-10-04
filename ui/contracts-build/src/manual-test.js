import { Mina, PrivateKey, AccountUpdate, UInt64, Field } from 'o1js';
import { PredictionMarket, predictionMarketOffchainState } from './contracts/PredictionMarket.js';
import { dootOffchainState, TokenInformationArray } from './utils/DootOracle.js';
import { MockDoot } from './utils/MockDoot.js';
import { ASSET_INDEX, MULTIPLICATION_FACTOR, INITIAL_POOL_AMOUNT } from './types/Constants.js';
async function main() {
    console.log('Setting up LocalBlockchain...');
    const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    const [deployer, creator, user1, user2] = Local.testAccounts;
    const marketKey = PrivateKey.random();
    const marketAddress = marketKey.toPublicKey();
    const market = new PredictionMarket(marketAddress);
    const dootKey = PrivateKey.random();
    const dootAddress = dootKey.toPublicKey();
    const doot = new MockDoot(dootAddress);
    console.log('Compiling offchain states...');
    await predictionMarketOffchainState.compile();
    await dootOffchainState.compile();
    console.log('Compiling contracts...');
    await PredictionMarket.compile();
    console.log('Deploying Doot...');
    let tx = await Mina.transaction(deployer, async () => {
        AccountUpdate.fundNewAccount(deployer);
        await doot.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, dootKey]).send();
    console.log('Initializing Doot prices...');
    const prices = Array(10).fill(Field(0));
    prices[2] = Field(3000).mul(MULTIPLICATION_FACTOR);
    const priceData = new TokenInformationArray({ prices });
    tx = await Mina.transaction(deployer, async () => {
        await doot.initBase(priceData);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    console.log('Deploying market...');
    tx = await Mina.transaction(deployer, async () => {
        AccountUpdate.fundNewAccount(deployer);
        await market.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, marketKey]).send();
    console.log('Initializing market...');
    const assetIdx = ASSET_INDEX.ETHEREUM;
    const threshold = Field(3400).mul(MULTIPLICATION_FACTOR);
    const endTime = UInt64.from(Date.now() + 7 * 24 * 60 * 60 * 1000);
    tx = await Mina.transaction(creator, async () => {
        // Use deployer as burn and registry address for tests
        await market.initialize(assetIdx, threshold, endTime, creator, deployer, deployer);
    });
    await tx.prove();
    await tx.sign([creator.key]).send();
    const yesPool0 = await market.yesPool.fetch();
    const noPool0 = await market.noPool.fetch();
    console.log('Initial pools:', yesPool0?.toString(), noPool0?.toString(), 'Expected each:', INITIAL_POOL_AMOUNT.toString());
    console.log('Buying YES 2 MINA...');
    tx = await Mina.transaction(user1, async () => {
        await market.buyYes(UInt64.from(2 * 1_000_000_000));
    });
    await tx.prove();
    await tx.sign([user1.key]).send();
    console.log('Buying NO 3 MINA...');
    tx = await Mina.transaction(user2, async () => {
        await market.buyNo(UInt64.from(3 * 1_000_000_000));
    });
    await tx.prove();
    await tx.sign([user2.key]).send();
    const yesPool1 = await market.yesPool.fetch();
    const noPool1 = await market.noPool.fetch();
    console.log('Post-bet pools:', yesPool1?.toString(), noPool1?.toString());
    console.log('Settling with manual price (>= threshold)...');
    const finalPrice = Field(3500).mul(MULTIPLICATION_FACTOR);
    const settlementTimestamp = endTime.add(UInt64.from(1));
    tx = await Mina.transaction(deployer, async () => {
        await market.settleMarket(finalPrice, settlementTimestamp);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();
    console.log('Claiming winner payout (user1)...');
    const balanceBefore = Mina.getBalance(user1).toBigInt();
    tx = await Mina.transaction(user1, async () => {
        await market.claim();
    });
    await tx.prove();
    await tx.sign([user1.key]).send();
    const balanceAfter = Mina.getBalance(user1).toBigInt();
    console.log('User1 gain (nanomina):', (balanceAfter - balanceBefore).toString());
    console.log('Manual test completed successfully.');
}
main().catch((e) => {
    console.error('Manual test failed:', e);
    process.exit(1);
});
//# sourceMappingURL=manual-test.js.map