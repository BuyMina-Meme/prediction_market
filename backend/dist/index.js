/**
 * Prediction Market Backend Server
 *
 * Express API server for creating and managing prediction markets
 */
import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import marketsRouter from './routes/markets.js';
import { startImprovedSettlementMonitor } from './services/settlement-monitor-improved.js';
import { startInitMonitor } from './services/init-monitor.js';
import { startPoolSync } from './services/pool-sync.js';
import { startStatusMonitor } from './services/status-monitor.js';
import { initPinata } from './services/pinata-client.js';
import { startOffchainSettler } from './services/offchain-settler.js';
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/markets', marketsRouter);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Root
app.get('/', (req, res) => {
    res.json({
        name: 'Prediction Market API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            markets: '/api/markets',
        },
    });
});
// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
    });
});
// Start server
async function start() {
    console.log(' Starting Prediction Market Backend...\n');
    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
        console.error(' Configuration validation failed:');
        validation.errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }
    // Upstash Redis is serverless - no connection needed
    console.log(' Using Upstash Redis (serverless)');
    // Initialize Pinata for IPFS
    if (config.pinata.jwt) {
        initPinata(config.pinata.jwt);
        console.log(' Pinata IPFS client initialized');
    }
    else {
        console.warn('  PINATA_JWT not set - IPFS pinning disabled');
    }
    // Start HTTP server
    app.listen(config.port, () => {
        console.log(`\n Server running on port ${config.port}`);
        console.log(`   Environment: ${config.nodeEnv}`);
        console.log(`   Network: ${config.zekoNetworkUrl}`);
        console.log(`\n API Endpoints:`);
        console.log(`   GET  http://localhost:${config.port}/health`);
        console.log(`   GET  http://localhost:${config.port}/api/markets`);
        console.log(`   POST http://localhost:${config.port}/api/markets`);
        console.log(`   GET  http://localhost:${config.port}/api/markets/:id\n`);
    });
    // Start initialization monitor (PENDING_INIT → ACTIVE)
    try {
        startInitMonitor();
        console.log(' Initialization monitor started (on-chain verification)');
    }
    catch (e) {
        console.warn('  Init monitor not started:', e?.message || e);
    }
    // Start status monitor (ACTIVE → LOCKED → AWAITING)
    try {
        startStatusMonitor();
        console.log(' Status monitor started (time-based transitions)');
    }
    catch (e) {
        console.warn('  Status monitor not started:', e?.message || e);
    }
    // Start pool sync service (syncs on-chain pools to Redis)
    try {
        startPoolSync();
        console.log(' Pool sync service started (syncs ACTIVE market pools)');
    }
    catch (e) {
        console.warn('  Pool sync not started:', e?.message || e);
    }
    // Start improved settlement monitor (GraphQL Actions-based)
    try {
        startImprovedSettlementMonitor();
        console.log(' Settlement monitor started (Actions API)');
    }
    catch (e) {
        console.warn('  Settlement monitor not started:', e?.message || e);
    }
    // Start offchain settler (periodic OffchainState.settle)
    try {
        startOffchainSettler(120_000); // every 120 seconds
        console.log(' Offchain settler started (periodic OffchainState settlement)');
    }
    catch (e) {
        console.warn('  Offchain settler not started:', e?.message || e);
    }
}
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n Shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n Shutting down gracefully...');
    process.exit(0);
});
// Start the server
start().catch((error) => {
    console.error(' Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map