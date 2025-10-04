/**
 * Deploy MarketRegistry to Zeko L2 Devnet
 */
import { Mina, PrivateKey, AccountUpdate, fetchAccount, } from 'o1js';
import { MarketRegistry, marketRegistryOffchainState } from '../contracts/MarketRegistry.js';
import fs from 'fs';
import path from 'path';
// Zeko L2 Devnet configuration
const ZEKO_DEVNET_URL = 'https://devnet.zeko.io/graphql';
const ZEKO_ARCHIVE_URL = 'https://devnet.zeko.io/graphql';
// Deployment configuration
const DEPLOY_FEE = 0.1 * 1e9; // 0.1 MINA
async function main() {
    console.log('🚀 Deploying MarketRegistry to Zeko L2 Devnet...\n');
    // Setup network
    const Network = Mina.Network({
        mina: ZEKO_DEVNET_URL,
        archive: ZEKO_ARCHIVE_URL,
    });
    Mina.setActiveInstance(Network);
    // Load or generate deployer key
    let deployerKey;
    let deployer;
    const keyPath = path.join(process.cwd(), 'keys', 'deployer.json');
    if (fs.existsSync(keyPath)) {
        console.log('📂 Loading existing deployer key...');
        const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
        deployerKey = PrivateKey.fromBase58(keyData.privateKey);
        deployer = deployerKey.toPublicKey();
        console.log(`   Deployer address: ${deployer.toBase58()}\n`);
    }
    else {
        console.log('🔑 Generating new deployer key...');
        deployerKey = PrivateKey.random();
        deployer = deployerKey.toPublicKey();
        // Save key
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
        fs.writeFileSync(keyPath, JSON.stringify({
            privateKey: deployerKey.toBase58(),
            publicKey: deployer.toBase58(),
        }, null, 2));
        console.log(`   Deployer address: ${deployer.toBase58()}`);
        console.log(`   🚨 Fund this address before deploying!\n`);
        console.log(`   Get funds from: https://zeko.io/faucet\n`);
        process.exit(0);
    }
    // Check balance
    console.log('💰 Checking deployer balance...');
    await fetchAccount({ publicKey: deployer });
    const balance = Mina.getBalance(deployer).toBigInt();
    console.log(`   Balance: ${Number(balance) / 1e9} MINA\n`);
    if (balance < BigInt(1e9)) {
        console.error('❌ Insufficient balance. Need at least 1 MINA.');
        console.log('   Get funds from: https://zeko.io/faucet\n');
        process.exit(1);
    }
    // Generate registry contract keypair
    const registryKey = PrivateKey.random();
    const registryAddress = registryKey.toPublicKey();
    console.log(`📝 Registry address: ${registryAddress.toBase58()}\n`);
    // Compile contracts
    console.log('⚙️  Compiling offchain state...');
    const startOffchain = Date.now();
    await marketRegistryOffchainState.compile();
    console.log(`   ✅ Compiled in ${((Date.now() - startOffchain) / 1000).toFixed(2)}s\n`);
    console.log('⚙️  Compiling MarketRegistry contract...');
    const startCompile = Date.now();
    const { verificationKey } = await MarketRegistry.compile();
    console.log(`   ✅ Compiled in ${((Date.now() - startCompile) / 1000).toFixed(2)}s\n`);
    // Deploy contract
    console.log('📤 Deploying MarketRegistry...');
    const registry = new MarketRegistry(registryAddress);
    const deployTx = await Mina.transaction({ sender: deployer, fee: DEPLOY_FEE }, async () => {
        AccountUpdate.fundNewAccount(deployer);
        await registry.deploy();
    });
    console.log('   Proving transaction...');
    await deployTx.prove();
    console.log('   Signing and sending...');
    await deployTx.sign([deployerKey, registryKey]).send();
    console.log('   ✅ Deployment transaction sent!\n');
    // Initialize registry
    console.log('🔧 Initializing registry...');
    const initTx = await Mina.transaction({ sender: deployer, fee: DEPLOY_FEE }, async () => {
        await registry.initialize();
    });
    console.log('   Proving transaction...');
    await initTx.prove();
    console.log('   Signing and sending...');
    const txHash = await initTx.sign([deployerKey]).send();
    console.log('   ✅ Initialization transaction sent!\n');
    console.log(`   Transaction hash: ${txHash.hash}\n`);
    // Save deployment info
    const deploymentPath = path.join(process.cwd(), 'deployments', 'zeko-devnet-registry.json');
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: 'zeko-devnet',
        contract: 'MarketRegistry',
        address: registryAddress.toBase58(),
        owner: deployer.toBase58(),
        deployedAt: new Date().toISOString(),
        txHash: txHash.hash,
    }, null, 2));
    console.log('✅ Deployment complete!\n');
    console.log(`📋 Registry address: ${registryAddress.toBase58()}`);
    console.log(`🔍 Explorer: https://zekoscan.io/devnet/account/${registryAddress.toBase58()}\n`);
    console.log(`💾 Deployment info saved to: ${deploymentPath}\n`);
}
main().catch((err) => {
    console.error('❌ Deployment failed:', err);
    process.exit(1);
});
//# sourceMappingURL=deploy-registry-zeko.js.map