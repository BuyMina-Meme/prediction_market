/**
 * Prediction Market Backend Server
 *
 * Express API server for creating and managing prediction markets
 */
import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import marketsRouter from './routes/markets.js';
import { startSettlementMonitor } from './services/settlement-monitor.js';
import { initPinata } from './services/pinata-client.js';
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
    console.log('🚀 Starting Prediction Market Backend...\n');
    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }
    // Upstash Redis is serverless - no connection needed
    console.log('✅ Using Upstash Redis (serverless)');
    // Initialize Pinata for IPFS
    if (config.pinata.jwt) {
        initPinata(config.pinata.jwt);
        console.log('✅ Pinata IPFS client initialized');
    }
    else {
        console.warn('⚠️  PINATA_JWT not set - IPFS pinning disabled');
    }
    // Start HTTP server
    app.listen(config.port, () => {
        console.log(`\n✅ Server running on port ${config.port}`);
        console.log(`   Environment: ${config.nodeEnv}`);
        console.log(`   Network: ${config.zekoNetworkUrl}`);
        console.log(`\n📡 API Endpoints:`);
        console.log(`   GET  http://localhost:${config.port}/health`);
        console.log(`   GET  http://localhost:${config.port}/api/markets`);
        console.log(`   POST http://localhost:${config.port}/api/markets`);
        console.log(`   GET  http://localhost:${config.port}/api/markets/:id\n`);
    });
    // Start background settlement monitor
    try {
        startSettlementMonitor();
        console.log('🕒 Settlement monitor started');
    }
    catch (e) {
        console.warn('⚠️  Settlement monitor not started:', e?.message || e);
    }
}
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});
// Start the server
start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map