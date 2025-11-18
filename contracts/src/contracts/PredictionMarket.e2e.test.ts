/**
 * End-to-end test using real Doot (vendor) with LocalBlockchain
 *
 * SKIPPED: This test compiles both PredictionMarket and Doot contracts together,
 * which exceeds WASM memory limits during compilation caching (RuntimeError: unreachable).
 *
 * The individual contracts work correctly when tested separately. This is a known
 * limitation of testing large circuits together in the same process.
 *
 * In production, contracts are compiled and deployed separately, avoiding this issue.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
  Field,
  MerkleMap,
  CircuitString,
} from 'o1js';

import {
  PredictionMarket,
  predictionMarketOffchainState,
  ASSET_INDEX,
  MULTIPLICATION_FACTOR,
  CREATOR_DEPOSIT,
} from '../index.js';

import {
  Doot,
  IpfsCID,
  TokenInformationArray,
  offchainState as DootOffchainState,
} from '../vendor/Doot.js';

function fundMissingAccounts(sender: Mina.TestPublicKey, addresses: PublicKey[]) {
  const missingCount = addresses.reduce(
    (count, address) => count + (Mina.hasAccount(address) ? 0 : 1),
    0
  );
  if (missingCount > 0) {
    AccountUpdate.fundNewAccount(sender, missingCount);
  }
}

describe.skip('PredictionMarket E2E with real Doot', () => {
  let deployer: Mina.TestPublicKey;
  let creator: Mina.TestPublicKey;
  let yesUser: Mina.TestPublicKey;
  let noUser: Mina.TestPublicKey;
  let settler: Mina.TestPublicKey;
  let Local: any;

  let dootKey: PrivateKey;
  let dootAddress: PublicKey;
  let doot: Doot;

  let marketKey: PrivateKey;
  let marketAddress: PublicKey;
  let market: PredictionMarket;

  before(async () => {
    Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    [deployer, creator, yesUser, noUser, settler] = Local.testAccounts;

    // Doot setup
    dootKey = PrivateKey.random();
    dootAddress = dootKey.toPublicKey();
    doot = new Doot(dootAddress);
    doot.offchainState.setContractInstance(doot);

    // Market setup
    marketKey = PrivateKey.random();
    marketAddress = marketKey.toPublicKey();
    market = new PredictionMarket(marketAddress);

    // Compile offchain states & contracts
    await predictionMarketOffchainState.compile();
    await DootOffchainState.compile();
    await PredictionMarket.compile();
    await Doot.compile();

    // Deploy Doot
    let tx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await doot.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, dootKey]).send();

    // Initialize Doot prices with MINA = $0.165
    const prices = Array(10).fill(Field(0));
    prices[0] = Field(165).mul(MULTIPLICATION_FACTOR).div(Field(1000)); // 0.165 * 1e10
    const tokenInfo = new TokenInformationArray({ prices });

    // Dummy Merkle root and IPFS
    const updatedCommitment = new MerkleMap().getRoot();
    const updatedIPFS = IpfsCID.fromString('init');

    tx = await Mina.transaction(deployer, async () => {
      await doot.initBase(updatedCommitment, updatedIPFS, tokenInfo);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();

    const proof = await doot.offchainState.createSettlementProof();
    tx = await Mina.transaction(deployer, async () => {
      await doot.settle(proof);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();

    // Deploy market
    tx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await market.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, marketKey]).send();
  });

  it('runs full cycle with NO outcome', async () => {
    // Create market: MINA > $0.17 in ~1min
    const threshold = Field(17).mul(MULTIPLICATION_FACTOR).div(Field(100)); // 0.17
    const endTime = UInt64.from(Date.now() + 60_000);

    let tx = await Mina.transaction(creator, async () => {
      // Use deployer as protocol address for tests
      await market.initialize(ASSET_INDEX.MINA, threshold, endTime, creator, deployer, deployer);
    });
    await tx.prove();
    await tx.sign([creator.key]).send();

    // Check creator deposit reduced
    const creatorBeforeBets = Mina.getBalance(creator).toBigInt();
    assert.ok(creatorBeforeBets < BigInt(1e15), 'creator balance funded');

    // YES bet 100 MINA
    tx = await Mina.transaction(yesUser, async () => {
      fundMissingAccounts(yesUser, [deployer, deployer]);
      const payment = AccountUpdate.createSigned(yesUser);
      payment.balance.subInPlace(UInt64.from(100 * 1_000_000_000));
      await market.buyYes(UInt64.from(100 * 1_000_000_000));
    });
    await tx.prove();
    await tx.sign([yesUser.key]).send();

    // NO bet 100 MINA
    tx = await Mina.transaction(noUser, async () => {
      fundMissingAccounts(noUser, [deployer, deployer]);
      const payment = AccountUpdate.createSigned(noUser);
      payment.balance.subInPlace(UInt64.from(100 * 1_000_000_000));
      await market.buyNo(UInt64.from(100 * 1_000_000_000));
    });
    await tx.prove();
    await tx.sign([noUser.key]).send();

    // After end: update Doot with MINA <= $0.17, settle offchain state
    const postPrices = Array(10).fill(Field(0));
    postPrices[0] = Field(168).mul(MULTIPLICATION_FACTOR).div(Field(1000)); // 0.168 <= 0.17
    const postTokenInfo = new TokenInformationArray({ prices: postPrices });

    tx = await Mina.transaction(deployer, async () => {
      // Update commitment & IPFS just as placeholders
      const mapRoot = new MerkleMap().getRoot();
      const ipfs = IpfsCID.fromString('post');
      await doot.update(mapRoot, ipfs, postTokenInfo);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();

    const proof2 = await doot.offchainState.createSettlementProof();
    tx = await Mina.transaction(deployer, async () => {
      await doot.settle(proof2);
    });
    await tx.prove();
    await tx.sign([deployer.key]).send();

    // Settle market via Doot on-chain prices, by a separate caller (settler)
    const settlerBalanceBefore = Mina.getBalance(settler).toBigInt();
    tx = await Mina.transaction(settler, async () => {
      await market.settleWithDoot(dootAddress);
    });
    await tx.prove();
    await tx.sign([settler.key]).send();
    const settlerBalanceAfter = Mina.getBalance(settler).toBigInt();
    assert.ok(
      settlerBalanceAfter - settlerBalanceBefore >= BigInt(9e9),
      'settler should get ~9 MINA reward'
    );

    // Winner claim (NO)
    const noBefore = Mina.getBalance(noUser).toBigInt();
    tx = await Mina.transaction(noUser, async () => {
      await market.claim();
    });
    await tx.prove();
    await tx.sign([noUser.key]).send();
    const noAfter = Mina.getBalance(noUser).toBigInt();
    assert.ok(noAfter > noBefore, 'NO bettor should receive payout');

    // Loser claim (YES) - should fail
    let failed = false;
    try {
      tx = await Mina.transaction(yesUser, async () => {
        await market.claim();
      });
      await tx.prove();
      await tx.sign([yesUser.key]).send();
    } catch (e) {
      failed = true;
    }
    assert.ok(failed, 'YES bettor should not be able to claim');

    // Creator should receive some fee share; balance increases vs immediately after init
    const creatorAfter = Mina.getBalance(creator).toBigInt();
    assert.ok(
      creatorAfter > creatorBeforeBets,
      'creator should receive fee share on claim'
    );
  });
});
