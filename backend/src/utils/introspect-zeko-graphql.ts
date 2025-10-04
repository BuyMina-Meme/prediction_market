/**
 * Zeko GraphQL Schema Introspection Tool
 *
 * This script explores the Zeko GraphQL endpoint to find available queries
 * for monitoring Doot settlement transactions.
 *
 * Usage:
 *   npx tsx src/utils/introspect-zeko-graphql.ts
 */

// Use Node.js built-in fetch (available in Node 18+)
const ZEKO_GRAPHQL = 'https://devnet.zeko.io/graphql';

interface GraphQLResponse {
  data?: any;
  errors?: Array<{ message: string; locations?: any; path?: any }>;
}

/**
 * Execute a GraphQL query
 */
async function executeQuery(query: string, variables?: any): Promise<GraphQLResponse> {
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
    return result;
  } catch (error) {
    console.error('Failed to execute query:', error);
    throw error;
  }
}

/**
 * Get all root query fields (available queries)
 */
async function introspectRootQueries() {
  console.log('\n📋 INTROSPECTING ROOT QUERY FIELDS...\n');

  const query = `
    query IntrospectQueries {
      __schema {
        queryType {
          name
          fields {
            name
            description
            args {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  `;

  const result = await executeQuery(query);

  if (result.errors) {
    console.error(' Introspection failed:', JSON.stringify(result.errors, null, 2));
    return;
  }

  const fields = result.data?.__schema?.queryType?.fields || [];

  console.log(`Found ${fields.length} root query fields:\n`);

  // Look for transaction-related queries
  const txRelated = fields.filter((f: any) =>
    f.name.toLowerCase().includes('transaction') ||
    f.name.toLowerCase().includes('command') ||
    f.name.toLowerCase().includes('zkapp') ||
    f.name.toLowerCase().includes('block') ||
    f.name.toLowerCase().includes('account')
  );

  console.log(' TRANSACTION/ACCOUNT RELATED QUERIES:\n');
  txRelated.forEach((field: any) => {
    console.log(`  ${field.name}${field.args.length > 0 ? '(...)' : ''}: ${field.type.name || field.type.ofType?.name}`);
    if (field.description) {
      console.log(`    Description: ${field.description}`);
    }
    if (field.args.length > 0) {
      console.log(`    Arguments:`);
      field.args.forEach((arg: any) => {
        console.log(`      - ${arg.name}: ${arg.type.name || arg.type.ofType?.name}`);
      });
    }
    console.log('');
  });

  return fields;
}

/**
 * Get detailed information about a specific type
 */
async function introspectType(typeName: string) {
  console.log(`\n INTROSPECTING TYPE: ${typeName}\n`);

  const query = `
    query IntrospectType($name: String!) {
      __type(name: $name) {
        name
        kind
        description
        fields {
          name
          description
          type {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  `;

  const result = await executeQuery(query, { name: typeName });

  if (result.errors) {
    console.error(` Failed to introspect ${typeName}:`, result.errors);
    return;
  }

  const typeInfo = result.data?.__type;

  if (!typeInfo) {
    console.log(`  Type "${typeName}" not found`);
    return;
  }

  console.log(`Type: ${typeInfo.name} (${typeInfo.kind})`);
  if (typeInfo.description) {
    console.log(`Description: ${typeInfo.description}`);
  }

  if (typeInfo.fields) {
    console.log(`\nFields (${typeInfo.fields.length}):\n`);
    typeInfo.fields.forEach((field: any) => {
      const typeName = field.type.name ||
                       field.type.ofType?.name ||
                       field.type.ofType?.ofType?.name ||
                       'Unknown';
      console.log(`  ${field.name}: ${typeName}`);
      if (field.description) {
        console.log(`    → ${field.description}`);
      }
    });
  }

  return typeInfo;
}

/**
 * Test a transaction query with actual data
 */
async function testTransactionQuery() {
  console.log('\n🧪 TESTING TRANSACTION QUERY...\n');

  // Try the most common Mina/Zeko pattern
  const query = `
    query TestTransactions {
      transactions(limit: 5, sortBy: BLOCKHEIGHT_DESC) {
        hash
        memo
        blockHeight
        dateTime
        failureReason
        kind
      }
    }
  `;

  const result = await executeQuery(query);

  if (result.errors) {
    console.log(' Query "transactions" failed');
    console.log('Errors:', JSON.stringify(result.errors, null, 2));

    // Try alternative query names
    console.log('\n Trying alternative query names...\n');

    const alternatives = [
      'zkappCommands',
      'userCommands',
      'commands',
      'signedCommands'
    ];

    for (const altQuery of alternatives) {
      console.log(`Testing: ${altQuery}...`);
      const altResult = await executeQuery(`
        query Test {
          ${altQuery}(limit: 1) {
            hash
          }
        }
      `);

      if (!altResult.errors) {
        console.log(` ${altQuery} works!`);
        return altQuery;
      }
    }
  } else {
    console.log(' "transactions" query works!');
    console.log('\nSample transactions:');
    console.log(JSON.stringify(result.data?.transactions, null, 2));
    return 'transactions';
  }
}

/**
 * Test filtering transactions by receiver (Doot contract)
 */
async function testDootTransactionQuery(dootAddress: string) {
  console.log('\n TESTING DOOT-SPECIFIC TRANSACTION QUERY...\n');
  console.log(`Doot Address: ${dootAddress}\n`);

  const query = `
    query DootTransactions($dootAddr: String!) {
      transactions(
        limit: 20
        sortBy: BLOCKHEIGHT_DESC
        query: {
          canonical: true
          receiver: { publicKey: $dootAddr }
        }
      ) {
        hash
        memo
        blockHeight
        dateTime
        failureReason
        receiver {
          publicKey
        }
        source {
          publicKey
        }
      }
    }
  `;

  const result = await executeQuery(query, { dootAddr: dootAddress });

  if (result.errors) {
    console.log(' Filtered query failed');
    console.log('Errors:', JSON.stringify(result.errors, null, 2));

    // Try simpler version
    console.log('\n Trying simpler filter...\n');
    const simpleQuery = `
      query SimpleDootQuery {
        transactions(limit: 10) {
          hash
          memo
          receiver {
            publicKey
          }
        }
      }
    `;

    const simpleResult = await executeQuery(simpleQuery);
    if (!simpleResult.errors) {
      console.log(' Simple query works!');
      console.log('Sample data:', JSON.stringify(simpleResult.data?.transactions?.slice(0, 2), null, 2));

      // Filter manually
      const txs = simpleResult.data?.transactions || [];
      const dootTxs = txs.filter((tx: any) => tx.receiver?.publicKey === dootAddress);
      console.log(`\nFound ${dootTxs.length} transactions to Doot address`);
      if (dootTxs.length > 0) {
        console.log('\nDoot transactions:');
        console.log(JSON.stringify(dootTxs, null, 2));
      }
    }
  } else {
    console.log(' Filtered Doot query works!');
    const txs = result.data?.transactions || [];
    console.log(`\nFound ${txs.length} transactions to Doot contract:`);

    // Look for settlement-related memos
    const updateTxs = txs.filter((tx: any) => tx.memo?.includes('Update'));
    const settleTxs = txs.filter((tx: any) => tx.memo?.includes('Settl'));

    console.log(`  - Update transactions: ${updateTxs.length}`);
    console.log(`  - Settlement transactions: ${settleTxs.length}`);

    if (txs.length > 0) {
      console.log('\nRecent Doot transactions:');
      console.log(JSON.stringify(txs.slice(0, 3), null, 2));
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   ZEKO GRAPHQL SCHEMA INTROSPECTION TOOL');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Endpoint: ${ZEKO_GRAPHQL}`);
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Get all available queries
    const rootFields = await introspectRootQueries();

    // Step 2: Introspect common transaction types
    const typesToCheck = [
      'Transaction',
      'UserCommand',
      'ZkappCommand',
      'SignedCommand',
      'Block',
      'Account'
    ];

    for (const typeName of typesToCheck) {
      await introspectType(typeName);
    }

    // Step 3: Test actual queries
    const workingQueryName = await testTransactionQuery();

    // Step 4: Test Doot-specific filtering
    const DOOT_ADDRESS = process.env.NEXT_PUBLIC_ZEKO_DOOT_PUBLIC_KEY ||
                         'B62qrbDCjDYEypocUpG3m6eL62zcvexsaRjhSJp5JWUQeny1qVEKbyP';

    await testDootTransactionQuery(DOOT_ADDRESS);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(' INTROSPECTION COMPLETE');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n INTROSPECTION FAILED:', error);
    process.exit(1);
  }
}

// Run main function
main().catch(console.error);

export {
  introspectRootQueries,
  introspectType,
  testTransactionQuery,
  testDootTransactionQuery,
  executeQuery,
};
