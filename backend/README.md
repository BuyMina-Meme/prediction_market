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
- `BURN_ADDRESS`: Burn address for 40% fee share (default: `B62qiburnzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzmp7r7UN6X`)
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

## Architecture

```
backend/
├── src/
│   ├── index.ts              # Express server
│   ├── config.ts             # Configuration management
│   ├── routes/
│   │   └── markets.ts        # Market API routes
│   └── services/
│       ├── redis-client.ts   # Upstash Redis integration
│       ├── market-deployer.ts # Market deployment
│       ├── init-monitor.ts   # PENDING_INIT → ACTIVE automation
│       ├── status-monitor.ts # ACTIVE → LOCKED → AWAITING transitions
│       ├── pool-sync.ts      # On-chain pool synchronization
│       ├── settlement-monitor-improved.ts # Doot Actions API settlement
│       ├── doot-settlement-detector.ts # GraphQL Actions detection
│       └── pinata-client.ts  # IPFS pinning service
├── dist/                      # Compiled output
├── .env                       # Environment variables
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

## TODO

- [ ] Implement actual contract deployment integration
- [ ] Build settlement monitoring service
- [ ] Add IPFS integration for metadata
- [ ] Implement rate limiting
- [ ] Add API authentication
- [ ] Setup monitoring/logging
