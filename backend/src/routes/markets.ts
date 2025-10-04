/**
 * Markets API Routes
 */

import express from 'express';
import {
  deployMarket,
  validateMarketRequest,
  getAllMarkets,
  getMarket,
  getActiveMarkets,
} from '../services/market-deployer.js';

const router = express.Router();

/**
 * GET /api/markets
 * Get all markets
 */
router.get('/', async (req, res) => {
  try {
    const markets = await getAllMarkets();
    res.json({
      success: true,
      count: markets.length,
      markets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/markets/active
 * Get active markets only
 */
router.get('/active', async (req, res) => {
  try {
    const markets = await getActiveMarkets();
    res.json({
      success: true,
      count: markets.length,
      markets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/markets/:id
 * Get specific market
 */
router.get('/:id', async (req, res) => {
  try {
    const marketId = parseInt(req.params.id);
    if (isNaN(marketId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid market ID',
      });
    }

    const market = await getMarket(marketId);
    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found',
      });
    }

    res.json({
      success: true,
      market,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/markets
 * Create new market
 */
router.post('/', async (req, res) => {
  try {
    const request = req.body;

    // Validate request
    const validation = validateMarketRequest(request);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    // Deploy market
    const result = await deployMarket(request);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
