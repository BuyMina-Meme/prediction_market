# Prediction Market Backend

Express.js backend service for the Prediction Market platform.

## Features

- **Market Deployment**: Programmatic deployment of prediction market contracts
- **Market Registry**: Track all deployed markets
- **Redis Integration**: Fast data caching and retrieval
- **Settlement Monitoring**: Automated market settlement with Doot Oracle
- **REST API**: Simple endpoints for market creation and retrieval

## Setup

### Prerequisites

- Node.js >= 18.14.0
- Upstash Redis account (serverless, no local Redis server needed)
- Funded Zeko L2 deployer account

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key environment variables:

- `DEPLOYER_PRIVATE_KEY`: Your funded deployer private key
- `REGISTRY_ADDRESS`: Deployed MarketRegistry contract address
- `DOOT_ORACLE_ADDRESS`: Doot Oracle contract public key on Zeko L2
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST endpoint URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis authentication token
- `ZEKO_NETWORK_URL`: Zeko L2 network endpoint

### Build

```bash
npm run build
```

### Run

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### Quick Start

1) Fill `.env` (required)
- `DEPLOYER_PRIVATE_KEY`, `REGISTRY_ADDRESS`, `DOOT_ORACLE_ADDRESS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

2) Install and run
```bash
npm install
npm run build
npm run dev
```

3) Verify
- Health: `GET http://localhost:3001/health`
- Markets: `GET http://localhost:3001/api/markets`

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T12:00:00.000Z"
}
```

### GET /api/markets
Get all markets.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "markets": [...]
}
```

### GET /api/markets/active
Get only active markets.

### GET /api/markets/:id
Get specific market by ID.

**Response:**
```json
{
  "success": true,
  "market": {
    "marketId": 0,
    "marketAddress": "B62q...",
    "creator": "B62q...",
    "assetIndex": 2,
    "assetName": "ETH",
    "priceThreshold": "34000000000000",
    "endTimestamp": 1735689600000,
    "status": "ACTIVE",
    "createdAt": "2025-10-02T12:00:00.000Z"
  }
}
```

### POST /api/markets
Create new market.

**Request:**
```json
{
  "assetIndex": 2,
  "priceThreshold": "34000000000000",
  "endTimestamp": 1735689600000,
  "creator": "B62qod2DugDjy9Jxhzd56gFS7npN8pWhanxxb36MLPzDDqtzzDyBy5z"
}
```

**Response:**
```json
{
  "success": true,
  "marketId": 0,
  "marketAddress": "B62q...",
  "txHash": "5Ju..."
}
```

## Monitors

- `init-monitor.ts` (PENDING_INIT → ACTIVE)
  - Reads on-chain state to verify initialize():
    - `yesPool/noPool == 0.5 MINA`, valid future `endTime` (optional balance ≥ 10 MINA)
  - Updates Redis to `ACTIVE` and syncs pools

- `settlement-monitor-improved.ts` (Actions API)
  - Uses Zeko GraphQL `actions(input)` to detect Doot updates
  - Settles immediately on the first post‑end action; updates registry to `SETTLED` and Redis outcome

- `pool-sync.ts` (ACTIVE markets)
  - Periodically reads `yesPool/noPool` and persists to Redis for UI display

## Architecture

```
backend/
├── src/
│   ├── index.ts                  # Express server (wires monitors)
│   ├── config.ts                 # Configuration management
│   ├── routes/
│   │   └── markets.ts            # Market API routes
│   └── services/
│       ├── redis-client.ts       # Upstash Redis integration
│       ├── market-deployer.ts    # Market deployment + registry registration
│       ├── init-monitor.ts       # PENDING_INIT → ACTIVE automation (on-chain checks)
│       ├── pool-sync.ts          # On-chain pool synchronization for ACTIVE markets
│       ├── settlement-monitor-improved.ts  # Doot Actions API settlement
│       ├── doot-settlement-detector.ts     # GraphQL Actions detection
│       └── pinata-client.ts      # IPFS pinning service (optional)
├── dist/                         # Compiled output
├── .env                          # Environment variables
└── package.json
```

## Development

### Adding New Routes

1. Create route file in `src/routes/`
2. Import and use in `src/index.ts`
3. Update this README with endpoint documentation

### Upstash Redis Data Structure

All data stored as JSON strings using Upstash Redis REST API.

**Markets:** `market:{id}` → JSON MarketData
- marketId, marketAddress, creator, assetIndex, status, etc.

**Markets List:** `markets:all` → JSON array of market IDs

**Doot Action States:** `doot:actionStateAtEnd:{id}` → action state string
- Used by settlement monitor to track Doot updates

**Doot Prices:** `doot:latest:{assetIndex}` → JSON DootPriceUpdate
- asset, price, timestamp, etc.

## Notes

- `DOOT_ORACLE_ADDRESS` must be set for the settlement monitor to run. If missing, the monitor is skipped and a warning is logged.

## Lifecycle Overview (Happy Path)

1) UI calls `POST /api/markets` → backend deploys market zkApp and registers it in `MarketRegistry`, stores `PENDING_INIT` entry in Redis with `initParams`.
2) Creator initializes from UI (Auro Wallet) → contract seeds pools (0.5/0.5 MINA) and sets `endTime`.
3) `init-monitor` promotes market to `ACTIVE` after on-chain verification, and `pool-sync` begins tracking pools.
4) Users bet until lockout (30m before end; enforced by contract).
5) After end, `settlement-monitor-improved` detects the first post‑end Doot action and calls `settleWithDoot()`.
6) Registry is marked `SETTLED`, Redis updated with outcome, winners can claim.

## Scripts

- `npm run dev` — start server with watchers
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled server
- `npm run e2e:local` — local E2E test (LocalBlockchain) for flows

## TODO

- [ ] Add IPFS integration for metadata (optional)
- [ ] Implement rate limiting
- [ ] Add API authentication
- [ ] Setup monitoring/logging
