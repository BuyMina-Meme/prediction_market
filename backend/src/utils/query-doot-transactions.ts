/**
 * Doot Transaction Query Tool
 *
 * Uses Zeko GraphQL to fetch transactions to/from Doot contract
 * Based on introspection results showing account-based queries only
 */

const ZEKO_GRAPHQL = 'https://devnet.zeko.io/graphql';

interface UserCommand {
  id: string;
  hash: string;
  kind: string;
  nonce: number;
  memo: string;
  fee: string;
  amount: string;
  source: {
    publicKey: string;
  };
  receiver: {
    publicKey: string;
  };
  failureReason?: string;
}

interface AccountQueryResult {
  data?: {
    account: {
      publicKey: string;
      balance: {
        total: string;
      };
      // Note: Need to determine the correct field name for transactions
      // Could be: transactions, commands, userCommands, etc.
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Query Doot account to get recent transactions
 */
async function queryDootAccount(dootAddress: string): Promise<any> {
  console.log(`\n Querying Doot account: ${dootAddress}\n`);

  // Try different possible field names for transaction history
  const queryVariants = [
    // Variant 1: transactions field
    `
      query DootAccount($pubkey: PublicKey!) {
        account(publicKey: $pubkey) {
          publicKey
          balance {
            total
          }
          transactions {
            hash
            memo
            kind
            nonce
            fee
            amount
            failureReason
            source {
              publicKey
            }
            receiver {
              publicKey
            }
          }
        }
      }
    `,
    // Variant 2: userCommands field
    `
      query DootAccount($pubkey: PublicKey!) {
        account(publicKey: $pubkey) {
          publicKey
          balance {
            total
          }
          userCommands {
            hash
            memo
            kind
            nonce
            fee
            amount
            failureReason
            source {
              publicKey
            }
            receiver {
              publicKey
            }
          }
        }
      }
    `,
    // Variant 3: commands field
    `
      query DootAccount($pubkey: PublicKey!) {
        account(publicKey: $pubkey) {
          publicKey
          balance {
            total
          }
          commands {
            hash
            memo
            kind
            nonce
          }
        }
      }
    `,
  ];

  for (let i = 0; i < queryVariants.length; i++) {
    console.log(`Testing query variant ${i + 1}/${queryVariants.length}...`);

    try {
      const response = await fetch(ZEKO_GRAPHQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: queryVariants[i],
          variables: { pubkey: dootAddress },
        }),
      });

      const result: AccountQueryResult = await response.json();

      if (result.errors) {
        console.log(`   Variant ${i + 1} failed: ${result.errors[0].message}`);
        continue;
      }

      console.log(`   Variant ${i + 1} succeeded!`);
      console.log('\nAccount data:');
      console.log(JSON.stringify(result.data, null, 2));
      return result.data;

    } catch (error) {
      console.log(`   Variant ${i + 1} error:`, error);
    }
  }

  console.log('\n  All query variants failed. Account query might not support transaction history.');
  return null;
}

/**
 * Try to introspect what fields are available on Account type
 */
async function introspectAccountFields(): Promise<void> {
  console.log('\n📋 INTROSPECTING ACCOUNT FIELDS...\n');

  const query = `
    query IntrospectAccount {
      __type(name: "Account") {
        name
        fields {
          name
          description
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
  `;

  try {
    const response = await fetch(ZEKO_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error('Introspection failed:', result.errors);
      return;
    }

    const fields = result.data?.__type?.fields || [];

    console.log(`Account type has ${fields.length} fields:\n`);

    // Look for transaction-related fields
    const txFields = fields.filter((f: any) =>
      f.name.toLowerCase().includes('transaction') ||
      f.name.toLowerCase().includes('command') ||
      f.name.toLowerCase().includes('action') ||
      f.name.toLowerCase().includes('history')
    );

    if (txFields.length > 0) {
      console.log(' TRANSACTION-RELATED FIELDS:\n');
      txFields.forEach((field: any) => {
        console.log(`  ${field.name}: ${field.type.name || field.type.ofType?.name}`);
        if (field.description) {
          console.log(`    → ${field.description}`);
        }
      });
    } else {
      console.log('  No transaction-related fields found on Account type');
      console.log('\nAll Account fields:');
      fields.forEach((field: any) => {
        console.log(`  - ${field.name}`);
      });
    }

  } catch (error) {
    console.error('Failed to introspect Account:', error);
  }
}

/**
 * Alternative: Try to find transactions via archive node query
 */
async function tryArchiveQuery(dootAddress: string): Promise<void> {
  console.log('\n🗄️  TRYING ARCHIVE NODE QUERY PATTERN...\n');

  // Archive nodes often have different query patterns
  const archiveQuery = `
    query ArchiveTransactions($receiver: PublicKey!, $limit: Int) {
      bestChain(maxLength: $limit) {
        transactions {
          userCommands {
            hash
            memo
            receiver {
              publicKey
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(ZEKO_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: archiveQuery,
        variables: {
          receiver: dootAddress,
          limit: 20,
        },
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.log(' Archive query failed:', result.errors[0].message);
    } else {
      console.log(' Archive query succeeded!');
      console.log(JSON.stringify(result.data, null, 2));
    }

  } catch (error) {
    console.log(' Archive query error:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   DOOT TRANSACTION QUERY TOOL');
  console.log('═══════════════════════════════════════════════════════');

  const DOOT_ADDRESS = process.env.NEXT_PUBLIC_ZEKO_DOOT_PUBLIC_KEY ||
                       'B62qrbDCjDYEypocUpG3m6eL62zcvexsaRjhSJp5JWUQeny1qVEKbyP';

  console.log(`\nDoot Contract: ${DOOT_ADDRESS}`);
  console.log(`GraphQL Endpoint: ${ZEKO_GRAPHQL}\n`);

  // Step 1: Introspect Account type fields
  await introspectAccountFields();

  // Step 2: Try querying Doot account
  await queryDootAccount(DOOT_ADDRESS);

  // Step 3: Try archive query pattern
  await tryArchiveQuery(DOOT_ADDRESS);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' QUERY EXPLORATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);

export { queryDootAccount, introspectAccountFields };
