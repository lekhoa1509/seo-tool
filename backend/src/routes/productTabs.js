import { Router } from 'express';
import {
  getWooProductTabs,
  listWooProducts,
  markMissingProductsInSheet,
  previewProductTabSync,
  saveWooProductTabs,
  syncProductTabs,
  validateProductTabCredentials,
  validateWooCredentials,
} from '../services/productTabs.js';
import {
  getAuthenticatedGoogleClient,
  getGoogleAuthStatus,
  getGoogleAuthUrl,
  isGoogleConfigured,
} from '../services/googleAuth.js';

const router = Router();

function getErrorStatus(error) {
  return /Thiếu|required|không hợp lệ|Cần nhập|Chưa kết nối/i.test(error?.message || '') ? 400 : 500;
}

function readCredentials(body = {}) {
  return {
    wpUrl: body.wpUrl,
    consumerKey: body.wooConsumerKey,
    consumerSecret: body.wooConsumerSecret,
  };
}

function readBarn2TabKeys(body = {}) {
  return {
    usage: body.barn2TabKeys?.usage || body.barn2UsageTabKey,
    storage: body.barn2TabKeys?.storage || body.barn2StorageTabKey,
  };
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
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
      barn2TabKeys: readBarn2TabKeys(req.body),
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
      barn2TabKeys: readBarn2TabKeys(req.body),
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab save error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const credentials = readCredentials(req.body);
    validateProductTabCredentials({
      ...credentials,
      sheetUrl: req.body.sheetUrl,
    });

    const result = await previewProductTabSync({
      ...credentials,
      sheetUrl: req.body.sheetUrl,
      minConfidence: req.body.minConfidence,
      barn2TabKeys: readBarn2TabKeys(req.body),
      scanAllSheets: readBoolean(req.body.scanAllSheets),
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab sheet preview error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const credentials = readCredentials(req.body);
    validateProductTabCredentials({
      ...credentials,
      sheetUrl: req.body.sheetUrl,
    });

    const result = await syncProductTabs({
      ...credentials,
      sheetUrl: req.body.sheetUrl,
      minConfidence: req.body.minConfidence,
      barn2TabKeys: readBarn2TabKeys(req.body),
      scanAllSheets: readBoolean(req.body.scanAllSheets),
      syncTarget: req.body.syncTarget,
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab sheet sync error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

router.get('/google/status', (req, res) => {
  res.json(getGoogleAuthStatus());
});

router.get('/google/auth', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(400).json({
      error: 'Google OAuth chưa được cấu hình. Cần GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trong backend/.env.',
    });
  }

  res.json({
    authUrl: getGoogleAuthUrl({ returnTo: '/product-tabs' }),
  });
});

router.post('/mark-missing', async (req, res) => {
  try {
    const credentials = readCredentials(req.body);
    validateProductTabCredentials({
      ...credentials,
      sheetUrl: req.body.sheetUrl,
    });

    const result = await markMissingProductsInSheet({
      ...credentials,
      sheetUrl: req.body.sheetUrl,
      minConfidence: req.body.minConfidence,
      scanAllSheets: readBoolean(req.body.scanAllSheets),
      googleAuth: getAuthenticatedGoogleClient(),
    });

    res.json(result);
  } catch (err) {
    console.error('Google Sheet missing product mark error:', err);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
});

export default router;
