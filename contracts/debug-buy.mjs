import { Mina, PrivateKey, UInt64, AccountUpdate, Field } from 'o1js';
import { PredictionMarket, predictionMarketOffchainState } from './build/src/contracts/PredictionMarket.js';
import { ASSET_INDEX, MULTIPLICATION_FACTOR, LAMPORTS_PER_MINA } from './build/src/types/Constants.js';

function fundMissingAccounts(sender, addresses) {
  const missingCount = addresses.reduce(
    (count, address) => count + (Mina.hasAccount(address) ? 0 : 1),
    0
  );
  if (missingCount > 0) {
    AccountUpdate.fundNewAccount(sender, missingCount);
  }
}

async function main() {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
  Mina.setActiveInstance(Local);
  const [deployer, creator, user1, , , treasury, burn] = Local.testAccounts;

  const marketKey = PrivateKey.random();
  const marketAddress = marketKey.toPublicKey();
  const market = new PredictionMarket(marketAddress);

  await predictionMarketOffchainState.compile();
  await PredictionMarket.compile();

  // Deploy market
  let tx = await Mina.transaction(deployer, async () => {
    AccountUpdate.fundNewAccount(deployer);
    await market.deploy();
  });
  await tx.prove();
  await tx.sign([deployer.key, marketKey]).send();

  // Initialize market
  const marketEndTime = UInt64.from(Date.now() + 7 * 24 * 60 * 60 * 1000);
  tx = await Mina.transaction(creator, async () => {
    await market.initialize(
      ASSET_INDEX.ETHEREUM,
      Field(3500).mul(MULTIPLICATION_FACTOR),
      marketEndTime,
      creator,
      treasury,
      burn
    );
  });
  await tx.prove();
  await tx.sign([creator.key]).send();

  // Place bet
  const betAmount = UInt64.from(10 * LAMPORTS_PER_MINA);
  const betTx = await Mina.transaction(user1, async () => {
    fundMissingAccounts(user1, [treasury, burn]);
    const payment = AccountUpdate.createSigned(user1);
    payment.balance.subInPlace(betAmount);
    await market.buyYes(betAmount);
  });
  await betTx.prove();
  try {
    await betTx.sign([user1.key]).send();
    console.log('Bet transaction sent successfully');
  } catch (error) {
    console.error('Sending bet transaction failed:', error);
    console.log('Transaction keys:', Object.keys(betTx.transaction));
    if (typeof betTx.toPretty === 'function') {
      console.log('Transaction pretty:', betTx.toPretty());
    }
    if (typeof betTx.toJSON === 'function') {
      console.log('Transaction JSON:', JSON.stringify(betTx.toJSON(), null, 2));
    }
    console.log('Total account updates:', betTx.transaction.accountUpdates.length);
    const updates = betTx.transaction.accountUpdates.map((au) => ({
      pk: au.body.publicKey,
      balanceChange: au.body.balanceChange,
      callDepth: au.body.callDepth,
      authorizationKind: au.body.authorizationKind,
    }));
    console.log('Account updates summary:', JSON.stringify(updates, null, 2));
  }
}

main();
