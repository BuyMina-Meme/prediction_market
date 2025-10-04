/**
 * Doot Settlement Detector
 *
 * Uses Zeko GraphQL Actions API to detect when Doot Oracle
 * completes an off-chain state update (update() + settle()).
 *
 * This is THE CORRECT WAY to monitor Doot settlements on Zeko.
 */

const ZEKO_GRAPHQL = 'https://devnet.zeko.io/graphql';

interface ActionState {
  actionStateOne: string;
  actionStateTwo: string;
}

interface ActionData {
  accountUpdateId: string;
  data: string[];  // Array of Field elements
}

interface ZekoAction {
  blockInfo: {
    stateHash: string;
    height: number;
  };
  actionState: ActionState;
  actionData: ActionData[];
}

interface DootSettlement {
  actionStateOne: string;
  actionStateTwo: string;
  priceData: string[];  // The 10 token prices
  timestamp: number;
  detectedAt: number;
}

/**
 * Query Doot actions from Zeko GraphQL
 */
async function queryDootActions(
  dootAddress: string,
  fromActionState?: string
): Promise<ZekoAction[]> {

  const query = `
    query DootActions($input: ActionFilterOptionsInput!) {
      actions(input: $input) {
        blockInfo {
          stateHash
          height
        }
        actionState {
          actionStateOne
          actionStateTwo
        }
        actionData {
          accountUpdateId
          data
        }
      }
    }
  `;

  const variables: any = {
    input: {
      address: dootAddress,
    },
  };

  // Filter to only get actions AFTER a specific action state
  if (fromActionState) {
    variables.input.fromActionState = fromActionState;
  }

  try {
    const response = await fetch(ZEKO_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data?.actions || [];

  } catch (error) {
    console.error('Failed to query Doot actions:', error);
    throw error;
  }
}

/**
 * Parse Doot action data to extract price information
 *
 * Doot action data structure (from updateDootZeko.ts):
 * [0]: timestamp (Field)
 * [1-10]: 10 token prices (Fields)
 * [11]: decimals (Field)
 * [12-13]: IPFS CID parts (Fields)
 * [14]: commitment (Field)
 */
function parseDootActionData(actionData: ActionData[]): string[] | null {
  if (!actionData || actionData.length === 0) {
    return null;
  }

  const data = actionData[0].data;

  // Expect at least 14 fields (timestamp + 10 prices + decimals + 2 IPFS + commitment)
  if (data.length < 14) {
    console.warn(`Unexpected action data length: ${data.length}`);
    return null;
  }

  // Extract the 10 token prices (indices 0-9 in the prices array, but 1-10 in action data)
  const prices = data.slice(1, 11);  // Elements [1] through [10]

  return prices;
}

/**
 * Wait for a new Doot settlement after a specific time
 *
 * @param marketEndTimestamp - Market end time in milliseconds
 * @param dootAddress - Doot contract address
 * @param currentActionState - Current action state to compare against
 * @returns DootSettlement if found, null if not yet settled
 */
export async function detectDootSettlementAfterTime(
  marketEndTimestamp: number,
  dootAddress: string,
  currentActionState?: string
): Promise<DootSettlement | null> {

  console.log(` Checking for Doot settlement after ${new Date(marketEndTimestamp).toISOString()}...`);

  try {
    // Query Doot actions, optionally filtering from baseline state
    const actions = await queryDootActions(dootAddress, currentActionState);

    if (actions.length === 0) {
      console.log('     No Doot actions found');
      return null;
    }

    console.log(`   Found ${actions.length} Doot actions`);

    // Get the most recent action (latest settlement)
    const latestAction = actions[0];  // Actions are returned newest first

    // If we have a baseline action state, check if it changed
    if (currentActionState && latestAction.actionState.actionStateOne === currentActionState) {
      console.log(`    Action state unchanged (${currentActionState.slice(0, 20)}...)`);
      return null;
    }

    // Parse price data from the action
    const prices = parseDootActionData(latestAction.actionData);

    if (!prices) {
      console.log('     Could not parse price data from action');
      return null;
    }

    // CRITICAL: Parse timestamp from action data and verify it's after market end
    const actionTimestamp = parseInt(latestAction.actionData[0]?.data[0] || '0') * 1000; // Convert to ms
    const marketEndSeconds = Math.floor(marketEndTimestamp / 1000);

    if (actionTimestamp && actionTimestamp < marketEndTimestamp) {
      console.log(`    Action timestamp ${new Date(actionTimestamp).toISOString()} is before market end`);
      console.log(`      Market ended: ${new Date(marketEndTimestamp).toISOString()}`);
      return null; // This action is before market end, wait for next one
    }

    console.log(`    New Doot settlement detected AFTER market end!`);
    console.log(`      Action state: ${latestAction.actionState.actionStateOne.slice(0, 20)}...`);
    console.log(`      Action timestamp: ${new Date(actionTimestamp).toISOString()}`);
    console.log(`      Prices parsed: ${prices.length} tokens`);

    return {
      actionStateOne: latestAction.actionState.actionStateOne,
      actionStateTwo: latestAction.actionState.actionStateTwo,
      priceData: prices,
      timestamp: actionTimestamp, // Use actual action timestamp
      detectedAt: Date.now(),
    };

  } catch (error) {
    console.error('Error detecting Doot settlement:', error);
    return null;
  }
}

/**
 * Continuous monitoring for Doot settlement
 *
 * Polls Zeko GraphQL until a new settlement is detected after market end time.
 *
 * @param marketEndTimestamp - Market end time in milliseconds
 * @param dootAddress - Doot contract address
 * @param maxAttempts - Maximum polling attempts (default: 60)
 * @param intervalMs - Polling interval in milliseconds (default: 30000 = 30s)
 * @returns Promise<DootSettlement>
 */
export async function waitForDootSettlement(
  marketEndTimestamp: number,
  dootAddress: string,
  maxAttempts: number = 60,
  intervalMs: number = 30000
): Promise<DootSettlement> {

  console.log(`\n Waiting for Doot settlement after market end: ${new Date(marketEndTimestamp).toISOString()}`);
  console.log(`   Max attempts: ${maxAttempts}`);
  console.log(`   Polling interval: ${intervalMs / 1000}s`);

  // Get baseline action state (current state before waiting)
  let baselineActionState: string | undefined;

  try {
    const initialActions = await queryDootActions(dootAddress);
    if (initialActions.length > 0) {
      baselineActionState = initialActions[0].actionState.actionStateOne;
      console.log(`   Baseline action state: ${baselineActionState.slice(0, 20)}...`);
    }
  } catch (error) {
    console.warn('     Could not get baseline action state:', error);
  }

  // Start polling
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n[${attempt}/${maxAttempts}] Polling for Doot settlement...`);

    const settlement = await detectDootSettlementAfterTime(
      marketEndTimestamp,
      dootAddress,
      baselineActionState
    );

    if (settlement) {
      console.log(`\n Doot settlement confirmed after ${attempt} attempts!`);
      return settlement;
    }

    if (attempt < maxAttempts) {
      console.log(`   Waiting ${intervalMs / 1000}s before next check...`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Timeout: No Doot settlement detected after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 60000} minutes)`);
}

/**
 * Get the latest Doot settlement (for immediate check)
 */
export async function getLatestDootSettlement(
  dootAddress: string
): Promise<DootSettlement | null> {

  try {
    const actions = await queryDootActions(dootAddress);

    if (actions.length === 0) {
      return null;
    }

    const latestAction = actions[0];
    const prices = parseDootActionData(latestAction.actionData);

    if (!prices) {
      return null;
    }

    return {
      actionStateOne: latestAction.actionState.actionStateOne,
      actionStateTwo: latestAction.actionState.actionStateTwo,
      priceData: prices,
      timestamp: Date.now(),
      detectedAt: Date.now(),
    };

  } catch (error) {
    console.error('Failed to get latest Doot settlement:', error);
    return null;
  }
}

export type { DootSettlement, ZekoAction };
