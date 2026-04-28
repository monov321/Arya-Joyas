require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const Product = require('./models/Product');
const Settings = require('./models/Settings');
const Order = require('./models/Order');
const {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus
} = require('transbank-sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = 'arya_admin';
const ADMIN_SESSION_HOURS = 8;

const requiredEnv = ['MONGODB_URI', 'ADMIN_PASSWORD', 'COOKIE_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`Falta variable de entorno ${key}. Revisa tu archivo .env`);
  }
}

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://webpay3gint.transbank.cl', 'https://webpay3g.transbank.cl'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    }
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function sign(payload) {
  return crypto.createHmac('sha256', process.env.COOKIE_SECRET || 'dev-secret').update(payload).digest('base64url');
}

function createAdminToken() {
  const expires = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `admin.${expires}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function readAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [role, expires, signature] = decoded.split('.');
    const payload = `${role}.${expires}`;
    if (role !== 'admin') return false;
    if (Number(expires) < Date.now()) return false;
    const expected = sign(payload);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (error) {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!readAdminToken(req.cookies[COOKIE_NAME])) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  next();
}

function pick(source, allowed) {
  return allowed.reduce((clean, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) clean[key] = source[key];
    return clean;
  }, {});
}

function normalizeNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function getWebpayTransaction() {
  const isProduction = process.env.WEBPAY_ENV === 'production';
  const commerceCode = process.env.WEBPAY_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = process.env.WEBPAY_API_KEY || IntegrationApiKeys.WEBPAY;
  const environment = isProduction ? Environment.Production : Environment.Integration;
  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
}

function makeBuyOrder() {
  return `A${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`.slice(0, 26);
}

function makeSessionId() {
  return `S${crypto.randomBytes(12).toString('hex')}`.slice(0, 61);
}

function isAuthorizedWebpayResponse(response) {
  return response?.status === 'AUTHORIZED' && Number(response?.response_code) === 0;
}

async function getSettings() {
  const settings = await Settings.findOneAndUpdate(
    { key: 'site' },
    { $setOnInsert: { key: 'site' } },
    { upsert: true, new: true }
  );
  return settings;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'Arya Joyas API' });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Clave incorrecta' });
  }

  res.cookie(COOKIE_NAME, createAdminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_SESSION_HOURS * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ authenticated: readAdminToken(req.cookies[COOKIE_NAME]) });
});

app.get('/api/settings', async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings', requireAdmin, async (req, res, next) => {
  try {
    const allowed = [
      'topBarText',
      'heroTitle',
      'heroSubtitle',
      'heroText',
      'heroImageUrl',
      'aboutTitle',
      'aboutText',
      'ctaTitle',
      'ctaText',
      'whatsappNumber',
      'instagramUrl',
      'email'
    ];
    const update = pick(req.body || {}, allowed);
    const settings = await Settings.findOneAndUpdate({ key: 'site' }, update, { new: true, upsert: true });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.active = true;
    if (req.query.featured === 'true') filter.featured = true;
    const products = await Product.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', requireAdmin, async (req, res, next) => {
  try {
    const allowed = [
      'name',
      'description',
      'price',
      'compareAtPrice',
      'category',
      'material',
      'imageUrl',
      'stock',
      'active',
      'featured',
      'order'
    ];
    const body = pick(req.body || {}, allowed);
    body.price = normalizeNumber(body.price, 0);
    body.compareAtPrice = body.compareAtPrice ? normalizeNumber(body.compareAtPrice, null) : null;
    body.stock = Math.max(0, normalizeNumber(body.stock, 0));
    body.order = normalizeNumber(body.order, 0);
    const product = await Product.create(body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const allowed = [
      'name',
      'description',
      'price',
      'compareAtPrice',
      'category',
      'material',
      'imageUrl',
      'stock',
      'active',
      'featured',
      'order'
    ];
    const body = pick(req.body || {}, allowed);
    if (Object.prototype.hasOwnProperty.call(body, 'price')) body.price = normalizeNumber(body.price, 0);
    if (Object.prototype.hasOwnProperty.call(body, 'compareAtPrice')) {
      body.compareAtPrice = body.compareAtPrice ? normalizeNumber(body.compareAtPrice, null) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'stock')) {
      body.stock = Math.max(0, normalizeNumber(body.stock, 0));
    }
    if (Object.prototype.hasOwnProperty.call(body, 'order')) body.order = normalizeNumber(body.order, 0);

    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/webpay/create', async (req, res, next) => {
  try {
    const { productId } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Producto inválido.' });
    }

    const requestedQuantity = Math.max(1, Math.min(10, normalizeNumber(req.body?.quantity, 1)));
    const product = await Product.findOne({ _id: productId, active: true });

    if (!product) return res.status(404).json({ message: 'Producto no encontrado o no visible.' });
    if (!product.price || product.price < 1) {
      return res.status(400).json({ message: 'Este producto no tiene un precio válido para pagar.' });
    }
    if (product.stock <= 0) {
      return res.status(400).json({ message: 'Este producto está agotado.' });
    }
    if (requestedQuantity > product.stock) {
      return res.status(400).json({ message: `Solo quedan ${product.stock} unidades disponibles.` });
    }

    const amount = Math.round(product.price * requestedQuantity);
    const buyOrder = makeBuyOrder();
    const sessionId = makeSessionId();
    const returnUrl = `${getBaseUrl(req)}/webpay/return`;

    const order = await Order.create({
      buyOrder,
      sessionId,
      product: product._id,
      productSnapshot: {
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        material: product.material,
        imageUrl: product.imageUrl
      },
      quantity: requestedQuantity,
      amount,
      status: 'created'
    });

    const tx = getWebpayTransaction();
    const createResponse = await tx.create(buyOrder, sessionId, amount, returnUrl);
    order.token = createResponse.token;
    await order.save();

    res.json({
      buyOrder,
      amount,
      token: createResponse.token,
      url: createResponse.url
    });
  } catch (error) {
    next(error);
  }
});

app.all('/webpay/return', async (req, res) => {
  const token = req.body?.token_ws || req.query?.token_ws;
  const cancelledBuyOrder = req.body?.TBK_ORDEN_COMPRA || req.query?.TBK_ORDEN_COMPRA;

  try {
    if (!token) {
      if (cancelledBuyOrder) {
        await Order.findOneAndUpdate(
          { buyOrder: cancelledBuyOrder },
          { status: 'cancelled', webpayResponse: { ...req.body, ...req.query } }
        );
      }
      return res.redirect(`/pago.html?status=cancelled${cancelledBuyOrder ? `&order=${encodeURIComponent(cancelledBuyOrder)}` : ''}`);
    }

    const tx = getWebpayTransaction();
    const commitResponse = await tx.commit(token);
    const authorized = isAuthorizedWebpayResponse(commitResponse);

    const existingOrder = await Order.findOne({ token });
    if (!existingOrder) {
      return res.redirect('/pago.html?status=error');
    }

    let finalStatus = authorized ? 'authorized' : 'failed';
    let extraResponse = commitResponse;

    if (authorized && existingOrder.status !== 'authorized') {
      const product = await Product.findOneAndUpdate(
        { _id: existingOrder.product, stock: { $gte: existingOrder.quantity } },
        { $inc: { stock: -existingOrder.quantity } },
        { new: true }
      );

      if (!product) {
        finalStatus = 'failed';
        extraResponse = {
          ...commitResponse,
          stockError: 'No había stock suficiente al confirmar el pago.'
        };
      }
    }

    const order = await Order.findOneAndUpdate(
      { token },
      { status: finalStatus, webpayResponse: extraResponse },
      { new: true }
    );

    const orderQuery = order?.buyOrder ? `&order=${encodeURIComponent(order.buyOrder)}` : '';
    return res.redirect(`/pago.html?status=${finalStatus === 'authorized' ? 'success' : 'failed'}${orderQuery}`);
  } catch (error) {
    console.error('Error confirmando Webpay:', error);
    if (token) {
      await Order.findOneAndUpdate(
        { token },
        { status: 'error', webpayResponse: { message: error.message } }
      ).catch(() => {});
    }
    return res.redirect('/pago.html?status=error');
  }
});

app.get('/api/webpay/order/:buyOrder', async (req, res, next) => {
  try {
    const order = await Order.findOne({ buyOrder: req.params.buyOrder }).select('-token -sessionId -__v');
    if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  res.status(500).json({ message: 'Error del servidor' });
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB conectado');
    const migration = await Product.updateMany({ stock: { $exists: false } }, { $set: { stock: 5 } });
    if (migration.modifiedCount) console.log(`Se actualizó stock por defecto en ${migration.modifiedCount} productos.`);
    app.listen(PORT, () => console.log(`Arya Joyas listo en http://localhost:${PORT}`));
  } catch (error) {
    console.error('No se pudo iniciar la app:', error.message);
    process.exit(1);
  }
}

start();
