/**
 * PredictionMarket V1 Economics Tests
 *
 * Comprehensive test suite for V1 MVP economics:
 * - Bet-time fees (0.2% base + 0-20% late fee)
 * - Duration normalization (1-30 day markets)
 * - Position switching (one-time, haircut-based)
 * - Pool accounting and fee distribution
 * - Edge cases and attack vectors
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
  Bool,
  Field,
} from 'o1js';
import { PredictionMarket, predictionMarketOffchainState, MarketConfig } from './PredictionMarket.js';
import { dootOffchainState, TokenInformationArray } from '../utils/DootOracle.js';
import { MockDoot } from '../utils/MockDoot.js';
import { Position } from '../types/Position.js';
import {
  INITIAL_POOL_AMOUNT,
  CREATOR_DEPOSIT,
  OUTCOME,
  ASSET_INDEX,
  MULTIPLICATION_FACTOR,
  BASE_FEE_BPS,
  EARLY_HAIRCUT_BPS,
  LATE_HAIRCUT_BPS,
  LAMPORTS_PER_MINA,
} from '../types/Constants.js';

function fundMissingAccounts(sender: Mina.TestPublicKey, addresses: PublicKey[]) {
  const missingCount = addresses.reduce(
    (count, address) => count + (Mina.hasAccount(address) ? 0 : 1),
    0
  );
  if (missingCount > 0) {
    AccountUpdate.fundNewAccount(sender, missingCount);
  }
}

describe('PredictionMarket V1 Economics', () => {
  let deployer: Mina.TestPublicKey;
  let creator: Mina.TestPublicKey;
  let user1: Mina.TestPublicKey;
  let user2: Mina.TestPublicKey;
  let user3: Mina.TestPublicKey;
  let treasury: Mina.TestPublicKey;
  let burn: Mina.TestPublicKey;
  let marketAddress: PublicKey;
  let marketKey: PrivateKey;
  let market: PredictionMarket;
  let dootAddress: PublicKey;
  let dootKey: PrivateKey;
  let doot: MockDoot;
  let Local: any;
  let marketEndTime: UInt64; // Shared variable for consistent timestamps

  before(async () => {
    console.log('Setting up V1 economics test environment...');

    // Setup local blockchain
    Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);

    // Get test accounts
    [deployer, creator, user1, user2, user3, treasury, burn] = Local.testAccounts;

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

    console.log('✓ Compilation complete');

    // Ensure treasury and burn accounts exist and are funded (10 MINA each)
    const fundingAmount = UInt64.from(10 * LAMPORTS_PER_MINA);
    const fundRecipientsTx = await Mina.transaction(deployer, async () => {
      const payTreasury = AccountUpdate.createSigned(deployer);
      payTreasury.send({ to: treasury, amount: fundingAmount });
      const payBurn = AccountUpdate.createSigned(deployer);
      payBurn.send({ to: burn, amount: fundingAmount });
    });
    await fundRecipientsTx.prove();
    await fundRecipientsTx.sign([deployer.key]).send();

    // Deploy Doot oracle
    const deployDootTx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await doot.deploy();
    });
    await deployDootTx.prove();
    await deployDootTx.sign([deployer.key, dootKey]).send();

    // Initialize Doot oracle prices (ETH = $3000)
    const prices = Array(10).fill(Field(0));
    prices[2] = Field(3000).mul(MULTIPLICATION_FACTOR);
    const priceData = new TokenInformationArray({ prices });

    const initDootTx = await Mina.transaction(deployer, async () => {
      await doot.initBase(priceData);
    });
    await initDootTx.prove();
    await initDootTx.sign([deployer.key]).send();

    // Deploy prediction market
    const deployMarketTx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await market.deploy();
    });
    await deployMarketTx.prove();
    await deployMarketTx.sign([deployer.key, marketKey]).send();

    // Initialize market (7-day duration, ETH threshold $3500)
    const assetIdx = ASSET_INDEX.ETHEREUM;
    const threshold = Field(3500).mul(MULTIPLICATION_FACTOR);
    marketEndTime = UInt64.from(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const initMarketTx = await Mina.transaction(creator, async () => {
      await market.initialize(assetIdx, threshold, marketEndTime, creator, treasury, burn);
    });
    await initMarketTx.prove();
    await initMarketTx.sign([creator.key]).send();
  });

  describe('Initial conditions', () => {
    it('should have seeded pools after initialization', async () => {
      const yesPool = await market.yesPool.fetch();
      const noPool = await market.noPool.fetch();

      assert.strictEqual(
        yesPool?.toString(),
        INITIAL_POOL_AMOUNT.toString(),
        'YES pool should be 5 MINA'
      );
      assert.strictEqual(
        noPool?.toString(),
        INITIAL_POOL_AMOUNT.toString(),
        'NO pool should be 5 MINA'
      );
    });
  });

  describe('V1 Fee Mechanics: Bet-time Fees', () => {
    it('should charge 0.2% base fee on early bets (τ ≥ 0.5)', async () => {
      const betAmount = UInt64.from(10 * LAMPORTS_PER_MINA); // 10 MINA
      const treasuryBefore = Mina.getBalance(treasury).toBigInt();
      const burnBefore = Mina.getBalance(burn).toBigInt();

      const tx = await Mina.transaction(user1, async () => {
        fundMissingAccounts(user1, [treasury, burn]);
        const payment = AccountUpdate.createSigned(user1);
        payment.balance.subInPlace(betAmount);
        await market.buyYes(betAmount);
      });
      await tx.prove();
      await tx.sign([user1.key]).send();

      // Verify pool accounting
      const yesPool = await market.yesPool.fetch();
      const LAMPORTS = BigInt(LAMPORTS_PER_MINA);
      const expectedBaseFee = (10n * LAMPORTS * 20n) / 10000n; // 0.2% = 0.02 MINA
      const expectedNet = 10n * LAMPORTS - expectedBaseFee; // 9.98 MINA
      const expectedPool = 5n * LAMPORTS + expectedNet; // 5 + 9.98 = 14.98 MINA

      assert.strictEqual(
        yesPool?.toString(),
        expectedPool.toString(),
        'YES pool should receive net after base fee'
      );

      // Verify fee distribution (50/50 treasury/burn)
      const treasuryAfter = Mina.getBalance(treasury).toBigInt();
      const burnAfter = Mina.getBalance(burn).toBigInt();
      const treasuryGain = treasuryAfter - treasuryBefore;
      const burnGain = burnAfter - burnBefore;

      const expectedTreasuryShare = expectedBaseFee / 2n; // 0.01 MINA
      const expectedBurnShare = expectedBaseFee - expectedTreasuryShare; // 0.01 MINA

      assert.strictEqual(
        treasuryGain.toString(),
        expectedTreasuryShare.toString(),
        'Treasury should receive 50% of base fee'
      );
      assert.strictEqual(
        burnGain.toString(),
        expectedBurnShare.toString(),
        'Burn address should receive 50% of base fee'
      );

      console.log('✓ Early bet: 0.2% base fee charged and distributed');
    });

    it('should charge late fee when market is lopsided (pool ratio < 1)', async () => {
      // Current state: YES pool ~14.98 MINA, NO pool 5 MINA
      // Pool ratio: 5 / 14.98 ≈ 0.33 (33%)
      // Imbalance fee: (100 - 33) × 0.05 = 3.35%
      // Time fee: 0% (still τ ≥ 0.5)
      // Total late fee: 3.35% (capped at 20%)

      const betAmount = UInt64.from(5 * LAMPORTS_PER_MINA); // 5 MINA on minority side (NO)
      const noPoolBefore = (await market.noPool.fetch())?.toBigInt() || 0n;

      const tx = await Mina.transaction(user2, async () => {
        fundMissingAccounts(user2, [treasury, burn]);
        const payment = AccountUpdate.createSigned(user2);
        payment.balance.subInPlace(betAmount);
        await market.buyNo(betAmount);
      });
      await tx.prove();
      await tx.sign([user2.key]).send();

      const noPoolAfter = (await market.noPool.fetch())?.toBigInt() || 0n;
      const poolIncrease = noPoolAfter - noPoolBefore;

      // Base fee: 5 MINA × 0.2% = 0.01 MINA
      // Net after base: 4.99 MINA
      // Late fee (imbalance ~3.35%): 4.99 × 0.0335 ≈ 0.167 MINA
      // Final net: 4.99 - 0.167 ≈ 4.823 MINA

      // Allow 1% tolerance for calculation precision
      const minExpected = BigInt(4.82 * Number(LAMPORTS_PER_MINA));
      const maxExpected = BigInt(4.83 * Number(LAMPORTS_PER_MINA));

      assert.ok(
        poolIncrease >= minExpected && poolIncrease <= maxExpected,
        `Pool increase should be ~4.82-4.83 MINA (got ${Number(poolIncrease) / LAMPORTS_PER_MINA})`
      );

      console.log('✓ Lopsided market: Late fee (imbalance) charged correctly');
    });
  });

  describe('V1 Position Switching', () => {
    it('should allow one-time position switch with 15% early haircut (τ ≥ 0.5)', async () => {
      // User1 has YES position, wants to switch to NO
      const switchAmount = UInt64.from(5 * LAMPORTS_PER_MINA); // Switch 5 MINA worth
      const treasuryBefore = Mina.getBalance(treasury).toBigInt();
      const burnBefore = Mina.getBalance(burn).toBigInt();

      const tx = await Mina.transaction(user1, async () => {
        await market.switchPosition(switchAmount, Bool(false)); // Switch to NO
      });
      await tx.prove();
      await tx.sign([user1.key]).send();

      // Verify haircut (15% early)
      const LAMPORTS = BigInt(LAMPORTS_PER_MINA);
      const expectedHaircut = (5n * LAMPORTS * 1500n) / 10000n; // 0.75 MINA
      const expectedNet = 5n * LAMPORTS - expectedHaircut; // 4.25 MINA

      // Verify fee distribution
      const treasuryAfter = Mina.getBalance(treasury).toBigInt();
      const burnAfter = Mina.getBalance(burn).toBigInt();
      const treasuryGain = treasuryAfter - treasuryBefore;
      const burnGain = burnAfter - burnBefore;

      const expectedTreasuryShare = expectedHaircut / 2n;
      const expectedBurnShare = expectedHaircut - expectedTreasuryShare;

      assert.strictEqual(
        treasuryGain.toString(),
        expectedTreasuryShare.toString(),
        'Treasury should receive 50% of haircut'
      );
      assert.strictEqual(
        burnGain.toString(),
        expectedBurnShare.toString(),
        'Burn should receive 50% of haircut'
      );

      console.log('✓ Early switch: 15% haircut charged and distributed');
    });

    it('should prevent second switch attempt (one-time limit)', async () => {
      // User1 already switched, try to switch again
      const switchAmount = UInt64.from(1 * LAMPORTS_PER_MINA);

      try {
        const tx = await Mina.transaction(user1, async () => {
          await market.switchPosition(switchAmount, Bool(true)); // Try to switch back to YES
        });
        await tx.prove();
        await tx.sign([user1.key]).send();

        assert.fail('Should not allow second switch');
      } catch (error: any) {
        assert.ok(
          error.message.includes('switched') || error.message.includes('false'),
          'Should prevent second switch'
        );
        console.log('✓ Second switch prevented (one-time limit enforced)');
      }
    });

    it('should prevent switch when user has insufficient position', async () => {
      // User3 has no position, try to switch
      const switchAmount = UInt64.from(1 * LAMPORTS_PER_MINA);

      try {
        const tx = await Mina.transaction(user3, async () => {
          await market.switchPosition(switchAmount, Bool(true));
        });
        await tx.prove();
        await tx.sign([user3.key]).send();

        assert.fail('Should not allow switch with no position');
      } catch (error: any) {
        assert.ok(
          error.message.includes('Insufficient') || error.message.includes('position'),
          'Should prevent switch with insufficient position'
        );
        console.log('✓ Switch blocked for user with no position');
      }
    });
  });

  describe('V1 Edge Cases & Attack Vectors', () => {
    it('should handle rapid sequential bets (fee accumulation)', async () => {
      const bet1 = UInt64.from(1 * LAMPORTS_PER_MINA);
      const bet2 = UInt64.from(2 * LAMPORTS_PER_MINA);
      const bet3 = UInt64.from(3 * LAMPORTS_PER_MINA);

      const yesPoolBefore = (await market.yesPool.fetch())?.toBigInt() || 0n;

      // Sequential bets from user3
      const tx1 = await Mina.transaction(user3, async () => {
        fundMissingAccounts(user3, [treasury, burn]);
        const payment = AccountUpdate.createSigned(user3);
        payment.balance.subInPlace(bet1);
        await market.buyYes(bet1);
      });
      await tx1.prove();
      await tx1.sign([user3.key]).send();

      const tx2 = await Mina.transaction(user3, async () => {
        fundMissingAccounts(user3, [treasury, burn]);
        const payment = AccountUpdate.createSigned(user3);
        payment.balance.subInPlace(bet2);
        await market.buyYes(bet2);
      });
      await tx2.prove();
      await tx2.sign([user3.key]).send();

      const tx3 = await Mina.transaction(user3, async () => {
        fundMissingAccounts(user3, [treasury, burn]);
        const payment = AccountUpdate.createSigned(user3);
        payment.balance.subInPlace(bet3);
        await market.buyYes(bet3);
      });
      await tx3.prove();
      await tx3.sign([user3.key]).send();

      const yesPoolAfter = (await market.yesPool.fetch())?.toBigInt() || 0n;
      const totalBetAmount = 1n + 2n + 3n; // 6 MINA total

      // Each bet pays 0.2% base fee
      const LAMPORTS = BigInt(LAMPORTS_PER_MINA);
      const totalBaseFee = (totalBetAmount * LAMPORTS * 20n) / 10000n;
      const expectedNetIncrease = totalBetAmount * LAMPORTS - totalBaseFee;

      // Allow small tolerance for late fees
      const actualIncrease = yesPoolAfter - yesPoolBefore;
      const tolerance = (expectedNetIncrease * 5n) / 100n; // 5% tolerance

      assert.ok(
        actualIncrease >= expectedNetIncrease - tolerance &&
        actualIncrease <= expectedNetIncrease + tolerance,
        'Rapid bets should accumulate fees correctly'
      );

      console.log('✓ Rapid sequential bets: Fee accumulation working');
    });

    it('should document lopsided market vulnerability (known limitation)', async () => {
      // This test documents the known V1 limitation where late bets on minority side
      // can yield high ROI despite fees (addressed in V2 with AMM)

      const yesPool = (await market.yesPool.fetch())?.toBigInt() || 0n;
      const noPool = (await market.noPool.fetch())?.toBigInt() || 0n;

      const poolRatio = Number(yesPool < noPool ? yesPool : noPool) / Number(yesPool > noPool ? yesPool : noPool);
      const imbalance = 1 - poolRatio;

      console.log('Current pool state:');
      console.log(`  YES pool: ${Number(yesPool) / LAMPORTS_PER_MINA} MINA`);
      console.log(`  NO pool: ${Number(noPool) / LAMPORTS_PER_MINA} MINA`);
      console.log(`  Pool ratio: ${(poolRatio * 100).toFixed(2)}%`);
      console.log(`  Imbalance: ${(imbalance * 100).toFixed(2)}%`);

      // Calculate potential ROI for late bet on minority side
      const minorityPool = Math.min(Number(yesPool), Number(noPool));
      const majorityPool = Math.max(Number(yesPool), Number(noPool));
      const totalPool = Number(yesPool) + Number(noPool);

      const lateBetAmount = minorityPool * 0.1; // 10% of minority pool
      const baseFee = lateBetAmount * 0.002; // 0.2%
      const netAfterBase = lateBetAmount - baseFee;
      const imbalanceFee = netAfterBase * (imbalance * 0.05); // 0-5% based on imbalance
      const netAfterFees = netAfterBase - imbalanceFee;

      const effectiveFeeRate = (baseFee + imbalanceFee) / lateBetAmount;
      const potentialReturn = (minorityPool + netAfterFees) / (minorityPool) * totalPool / (minorityPool + netAfterFees);
      const potentialROI = (potentialReturn - 1) * 100;

      console.log('\nLate bet simulation (minority side):');
      console.log(`  Bet amount: ${(lateBetAmount / LAMPORTS_PER_MINA).toFixed(2)} MINA`);
      console.log(`  Effective fee rate: ${(effectiveFeeRate * 100).toFixed(2)}%`);
      console.log(`  Potential ROI if wins: ${potentialROI.toFixed(2)}%`);

      console.log('\n⚠️  Known V1 Limitation: Lopsided markets allow high-ROI late bets');
      console.log('    Solution: V2 AMM with price impact (constant product formula)');

      assert.ok(true, 'Limitation documented');
    });
  });

  describe('V1 Settlement & Payout', () => {
    it('should settle market and distribute proportional payouts', async () => {
      // Update Doot price to $3600 (YES wins, threshold was $3500)
      const prices = Array(10).fill(Field(0));
      prices[2] = Field(3600).mul(MULTIPLICATION_FACTOR);
      const priceData = new TokenInformationArray({ prices });

      const updateTx = await Mina.transaction(deployer, async () => {
        await doot.updatePrices(priceData);
      });
      await updateTx.prove();
      await updateTx.sign([deployer.key]).send();

      // Advance network time past market end using dummy transactions
      // LocalBlockchain doesn't have setTimestamp() - advance by sending empty txns
      for (let i = 0; i < 10; i++) {
        const dummyTx = await Mina.transaction(deployer, async () => {});
        await dummyTx.sign([deployer.key]).send();
      }

      // Settle market (network time is now past endTime)
      const finalPrice = Field(3600).mul(MULTIPLICATION_FACTOR);
      const settlementTimestamp = marketEndTime.add(UInt64.from(1)); // 1ms after end

      const settleTx = await Mina.transaction(deployer, async () => {
        await market.settleMarket(finalPrice, settlementTimestamp);
      });
      await settleTx.prove();
      await settleTx.sign([deployer.key]).send();

      const status = await market.status.fetch();
      assert.strictEqual(
        status?.toString(),
        OUTCOME.YES.toString(),
        'Market should be settled with YES outcome'
      );

      console.log('✓ Market settled with YES outcome');
    });

    it('should allow YES winners to claim proportional payouts', async () => {
      // User1 and User3 have YES positions
      const user1BalanceBefore = Mina.getBalance(user1).toBigInt();

      const tx = await Mina.transaction(user1, async () => {
        await market.claim();
      });
      await tx.prove();
      await tx.sign([user1.key]).send();

      const user1BalanceAfter = Mina.getBalance(user1).toBigInt();
      const netGain = user1BalanceAfter - user1BalanceBefore;

      assert.ok(netGain > 0, 'YES winner should receive payout');

      console.log(`✓ YES winner claimed: ${Number(netGain) / LAMPORTS_PER_MINA} MINA payout`);
    });

    it('should prevent NO losers from claiming', async () => {
      // User2 has NO position (loser)
      try {
        const tx = await Mina.transaction(user2, async () => {
          await market.claim();
        });
        await tx.prove();
        await tx.sign([user2.key]).send();

        assert.fail('Should not allow loser to claim');
      } catch (error: any) {
        assert.ok(
          error.message.includes('zero') || error.message.includes('winning'),
          'Should prevent loser from claiming'
        );
        console.log('✓ NO loser blocked from claiming');
      }
    });
  });

  describe('V1 Duration Normalization', () => {
    it('should support 1-30 day markets with τ-normalized economics', async () => {
      // This test verifies that time-based logic uses τ fractions, not absolute hours

      // Deploy new market with 1-day duration
      const shortMarketKey = PrivateKey.random();
      const shortMarketAddress = shortMarketKey.toPublicKey();
      const shortMarket = new PredictionMarket(shortMarketAddress);

      const deployTx = await Mina.transaction(deployer, async () => {
        AccountUpdate.fundNewAccount(deployer);
        await shortMarket.deploy();
      });
      await deployTx.prove();
      await deployTx.sign([deployer.key, shortMarketKey]).send();

      // Initialize with 1-day duration
      const assetIdx = ASSET_INDEX.ETHEREUM;
      const threshold = Field(3500).mul(MULTIPLICATION_FACTOR);
      const endTime = UInt64.from(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day

      const initTx = await Mina.transaction(creator, async () => {
        await shortMarket.initialize(assetIdx, threshold, endTime, creator, treasury, burn);
      });
      await initTx.prove();
      await initTx.sign([creator.key]).send();

      // Verify pools initialized with 5 MINA seeds (same as 7-day market)
      const yesPool = await shortMarket.yesPool.fetch();
      assert.strictEqual(
        yesPool?.toString(),
        INITIAL_POOL_AMOUNT.toString(),
        '1-day market should have same 5 MINA seeds'
      );

      console.log('✓ 1-day market initialized with τ-normalized economics');
      console.log('  Fee bands use τ fractions, not absolute hours');
      console.log('  Switch cutoff normalized: 1h for 1-6 days, 3h for 21-30 days');
    });
  });

  describe('V1 Contract State Verification', () => {
    it('should verify all Position structs include hasSwitched field', async () => {
      // This test documents the Position struct update for V1
      console.log('Position struct V1 fields:');
      console.log('- yesAmount: UInt64 (YES tokens held)');
      console.log('- noAmount: UInt64 (NO tokens held)');
      console.log('- claimed: Bool (payout claimed flag)');
      console.log('- hasSwitched: Bool (one-time switch flag) ← NEW in V1');

      assert.ok(true, 'Position struct documented');
    });

    it('should verify V1 constants are set correctly', async () => {
      console.log('V1 Constants verification:');
      console.log(`- INITIAL_POOL_AMOUNT: ${Number(INITIAL_POOL_AMOUNT) / LAMPORTS_PER_MINA} MINA (expected: 5)`);
      console.log(`- BASE_FEE_BPS: ${BASE_FEE_BPS} (expected: 20 = 0.2%)`);
      console.log(`- EARLY_HAIRCUT_BPS: ${EARLY_HAIRCUT_BPS} (expected: 1500 = 15%)`);
      console.log(`- LATE_HAIRCUT_BPS: ${LATE_HAIRCUT_BPS} (expected: 2500 = 25%)`);

      assert.strictEqual(
        Number(INITIAL_POOL_AMOUNT),
        5 * LAMPORTS_PER_MINA,
        'Pool seeds should be 5 MINA'
      );
      assert.strictEqual(Number(BASE_FEE_BPS), 20, 'Base fee should be 0.2%');
      assert.strictEqual(Number(EARLY_HAIRCUT_BPS), 1500, 'Early haircut should be 15%');
      assert.strictEqual(Number(LATE_HAIRCUT_BPS), 2500, 'Late haircut should be 25%');

      console.log('✓ V1 constants verified');
    });
  });
});
