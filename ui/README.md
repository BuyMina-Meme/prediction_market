## Prediction Market UI (Next.js)

Minimal developer notes for running the app locally.

### Prerequisites

- Node.js ≥ 18.14.0
- Auro Wallet in your browser (required to sign zkApp transactions)

### Env Vars

- `NEXT_PUBLIC_API_BASE` (optional): Backend API base, default `http://localhost:3001`
- `NEXT_PUBLIC_DOOT_API_KEY` (optional): API key for fetching current price from Doot HTTP API

### Run

```bash
npm install
npm run dev
```

Open http://localhost:3000
