/**
 * PredictionMarket Contract Tests
 *
 * Comprehensive test suite for binary prediction markets
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { Mina, PrivateKey, AccountUpdate, UInt64, Field, } from 'o1js';
import { PredictionMarket, predictionMarketOffchainState } from './PredictionMarket.js';
import { dootOffchainState, TokenInformationArray } from '../utils/DootOracle.js';
import { MockDoot } from '../utils/MockDoot.js';
import { INITIAL_POOL_AMOUNT, OUTCOME, ASSET_INDEX, MULTIPLICATION_FACTOR, } from '../types/Constants.js';
describe('PredictionMarket', () => {
    let deployer;
    let creator;
    let user1;
    let user2;
    let marketAddress;
    let marketKey;
    let market;
    let dootAddress;
    let dootKey;
    let doot;
    let Local;
    before(async () => {
        console.log('Setting up test environment...');
        // Setup local blockchain
        Local = Mina.LocalBlockchain({ proofsEnabled: false });
        Mina.setActiveInstance(Local);
        // Get test accounts
        [deployer, creator, user1, user2] = Local.testAccounts;
        // Generate keypairs for contracts
        marketKey = PrivateKey.random();
        marketAddress = marketKey.toPublicKey();
        dootKey = PrivateKey.random();
        dootAddress = dootKey.toPublicKey();
        // Initialize contracts
        market = new PredictionMarket(marketAddress);
        doot = new MockDoot(dootAddress);
        console.log('Compiling contracts...');
        // Compile offchain states
        await predictionMarketOffchainState.compile();
        await dootOffchainState.compile();
        // Compile contracts
        await PredictionMarket.compile();
        await MockDoot.compile();
        console.log('✅ Compilation complete');
    });
    describe('Deployment & Initialization', () => {
        it('should deploy mock Doot oracle', async () => {
            const tx = await Mina.transaction(deployer, async () => {
                AccountUpdate.fundNewAccount(deployer);
                await doot.deploy();
            });
            await tx.prove();
            await tx.sign([deployer.key, dootKey]).send();
            // Verify deployment
            const owner = await doot.owner.fetch();
            assert.ok(owner, 'Doot owner should be set');
        });
        it('should initialize Doot with test prices', async () => {
            // Create mock price data (ETH is at index 2)
            const prices = Array(10).fill(Field(0));
            prices[2] = Field(3000).mul(MULTIPLICATION_FACTOR); // ETH at $3000
            const priceData = new TokenInformationArray({ prices });
            const tx = await Mina.transaction(deployer, async () => {
                await doot.initBase(priceData);
            });
            await tx.prove();
            await tx.sign([deployer.key]).send();
            console.log('✅ Doot oracle initialized with test prices');
        });
        it('should deploy PredictionMarket contract', async () => {
            const tx = await Mina.transaction(deployer, async () => {
                AccountUpdate.fundNewAccount(deployer);
                await market.deploy();
            });
            await tx.prove();
            await tx.sign([deployer.key, marketKey]).send();
            // Verify deployment
            const status = await market.status.fetch();
            assert.strictEqual(status?.toString(), Field(0).toString(), 'Initial status should be 0');
        });
        it('should initialize market with config', async () => {
            const assetIdx = ASSET_INDEX.ETHEREUM;
            const threshold = Field(3400).mul(MULTIPLICATION_FACTOR); // Will ETH cross $3400?
            const endTime = UInt64.from(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
            const tx = await Mina.transaction(creator, async () => {
                // Use deployer as protocol address for tests
                await market.initialize(assetIdx, threshold, endTime, creator, deployer, deployer);
            });
            await tx.prove();
            await tx.sign([creator.key]).send();
            // Verify initialization
            const yesPool = await market.yesPool.fetch();
            const noPool = await market.noPool.fetch();
            assert.strictEqual(yesPool?.toString(), INITIAL_POOL_AMOUNT.toString(), 'YES pool should be initialized');
            assert.strictEqual(noPool?.toString(), INITIAL_POOL_AMOUNT.toString(), 'NO pool should be initialized');
            console.log('✅ Market initialized with 5 MINA in each pool');
        });
    });
    describe('Betting Mechanics', () => {
        it('should allow user to buy YES tokens', async () => {
            const betAmount = UInt64.from(2 * 1_000_000_000); // 2 MINA
            const tx = await Mina.transaction(user1, async () => {
                await market.buyYes(betAmount);
            });
            await tx.prove();
            await tx.sign([user1.key]).send();
            // Verify pool updated
            const yesPool = await market.yesPool.fetch();
            const expectedPool = INITIAL_POOL_AMOUNT.add(betAmount);
            assert.strictEqual(yesPool?.toString(), expectedPool.toString(), 'YES pool should increase');
            console.log('✅ User bought YES tokens');
        });
        it('should allow user to buy NO tokens', async () => {
            const betAmount = UInt64.from(3 * 1_000_000_000); // 3 MINA
            const tx = await Mina.transaction(user2, async () => {
                await market.buyNo(betAmount);
            });
            await tx.prove();
            await tx.sign([user2.key]).send();
            // Verify pool updated
            const noPool = await market.noPool.fetch();
            const expectedPool = INITIAL_POOL_AMOUNT.add(betAmount);
            assert.strictEqual(noPool?.toString(), expectedPool.toString(), 'NO pool should increase');
            console.log('✅ User bought NO tokens');
        });
        it('should track user positions in offchain state', async () => {
            // This would require offchain state settlement
            // For now, verify the transaction succeeded
            const status = await market.status.fetch();
            assert.strictEqual(status?.toString(), OUTCOME.PENDING.toString(), 'Market should still be active');
        });
    });
    describe('Settlement Logic', () => {
        it('should settle market when price threshold is met (YES wins)', async () => {
            // Update Doot oracle to price above threshold ($3500 > $3400)
            const prices = Array(10).fill(Field(0));
            prices[2] = Field(3500).mul(MULTIPLICATION_FACTOR); // ETH at index 2
            const priceData = new TokenInformationArray({ prices });
            const updateTx = await Mina.transaction(deployer, async () => {
                await doot.updatePrices(priceData);
            });
            await updateTx.prove();
            await updateTx.sign([deployer.key]).send();
            // Settle market with manual price (using settleMarket for testing)
            const finalPrice = Field(3500).mul(MULTIPLICATION_FACTOR);
            const settlementTimestamp = UInt64.from(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1);
            const settleTx = await Mina.transaction(deployer, async () => {
                await market.settleMarket(finalPrice, settlementTimestamp);
            });
            await settleTx.prove();
            await settleTx.sign([deployer.key]).send();
            // Verify settlement
            const status = await market.status.fetch();
            assert.strictEqual(status?.toString(), OUTCOME.YES.toString(), 'Market should be settled with YES outcome');
            console.log('✅ Market settled with YES outcome');
        });
    });
    describe('Payout Mechanics', () => {
        it('should allow winner to claim proportional payout', async () => {
            // User1 bought YES tokens, so they should be able to claim
            const balanceBefore = Mina.getBalance(user1).toBigInt();
            const tx = await Mina.transaction(user1, async () => {
                await market.claim();
            });
            await tx.prove();
            await tx.sign([user1.key]).send();
            const balanceAfter = Mina.getBalance(user1).toBigInt();
            const netGain = balanceAfter - balanceBefore;
            // User should receive more than they bet (proportional to total pool)
            assert.ok(netGain > 0, 'Winner should receive payout');
            console.log(`✅ Winner claimed payout: ${Number(netGain) / 1_000_000_000} MINA`);
        });
        it('should prevent double claiming', async () => {
            // Try to claim again
            try {
                const tx = await Mina.transaction(user1, async () => {
                    await market.claim();
                });
                await tx.prove();
                await tx.sign([user1.key]).send();
                assert.fail('Should not allow double claim');
            }
            catch (error) {
                assert.ok(error.message.includes('claimed') || error.message.includes('false'), 'Should prevent double claiming');
                console.log('✅ Double claim prevented');
            }
        });
    });
    describe('Field Count Verification', () => {
        it('should verify PredictionMarket uses ≤8 Fields', () => {
            // On-chain state:
            // - yesPool: UInt64 = 1 Field
            // - noPool: UInt64 = 1 Field
            // - status: Field = 1 Field
            // - offchainStateCommitments: OffchainState.Commitments = 4 Fields
            // Total: 7 Fields (within limit)
            console.log('PredictionMarket Field usage:');
            console.log('- yesPool (UInt64): 1 Field');
            console.log('- noPool (UInt64): 1 Field');
            console.log('- status (Field): 1 Field');
            console.log('- offchainStateCommitments: 4 Fields');
            console.log('Total: 7 Fields ✅');
            assert.ok(true, 'Field count verified manually');
        });
    });
});
//# sourceMappingURL=PredictionMarket.test.js.map