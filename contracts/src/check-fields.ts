/**
 * Quick Field count verification
 */

import { PredictionMarket, predictionMarketOffchainState } from './contracts/PredictionMarket.js';

console.log('Compiling offchain state...');

predictionMarketOffchainState.compile().then(() => {
  console.log(' Offchain state compiled');
  console.log('Compiling PredictionMarket contract...');

  return PredictionMarket.compile();
}).then(() => {
  console.log(' SUCCESS: PredictionMarket compiled successfully!');
  console.log(' Field count is ≤8 (contract within limits)');
  process.exit(0);
}).catch((error) => {
  console.error(' FAILED:', error.message);
  if (error.message.includes('Found') && error.message.includes('field elements')) {
    console.error('\n CRITICAL: Field count exceeds 8!');
  }
  process.exit(1);
});
