import { Router } from 'express';
import {
  getWooProductTabs,
  listWooProducts,
  saveWooProductTabs,
  validateWooCredentials,
} from '../services/productTabs.js';

const router = Router();

function getErrorStatus(error) {
  return /Thiếu|required|không hợp lệ|Cần nhập/i.test(error?.message || '') ? 400 : 500;
}

function readCredentials(body = {}) {
  return {
    wpUrl: body.wpUrl,
    consumerKey: body.wooConsumerKey,
    consumerSecret: body.wooConsumerSecret,
  };
}

router.post('/products', async (req, res) => {
  try {
    const credentials = readCredentials(req.body);
    validateWooCredentials(credentials);

    const result = await listWooProducts({
      ...credentials,
      search: req.body.search,
      page: req.body.page,
      perPage: req.body.perPage,
      status: req.body.status,
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product scan error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

router.post('/product', async (req, res) => {
  try {
    const credentials = readCredentials(req.body);
    validateWooCredentials(credentials);

    if (!req.body.productId) {
      return res.status(400).json({ error: 'Thiếu productId.' });
    }

    const result = await getWooProductTabs({
      ...credentials,
      productId: req.body.productId,
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab read error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const credentials = readCredentials(req.body);
    validateWooCredentials(credentials);

    const result = await saveWooProductTabs({
      ...credentials,
      productId: req.body.productId,
      tabs: req.body.tabs,
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab save error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

export default router;
