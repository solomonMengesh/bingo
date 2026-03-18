const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'bingo-admin-secret-change-in-production';
const SALT_ROUNDS = 10;

/** GET /api/admin/health — verify admin routes are loaded */
router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Admin API is up' });
});

/**
 * POST /api/admin/ensure-first-admin
 * Creates the first admin if none exist. Body: { username?, password? } (defaults: admin, admin123).
 * Use this from Postman when admin was not created on startup.
 */
router.post('/ensure-first-admin', async (req, res) => {
  try {
    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ message: 'An admin already exists. Use /api/admin/login to sign in.' });
    }
    const username = (req.body?.username && String(req.body.username).trim()) || 'admin';
    const password = (req.body?.password && String(req.body.password)) || 'admin123';
    const name = username.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await Admin.create({ username: name, passwordHash });
    return res.status(201).json({
      message: 'First admin created. Use POST /api/admin/login with this username and password.',
      admin: { username: name },
    });
  } catch (err) {
    console.error('ensure-first-admin error', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/admin/seed-from-settings
 * If no admins exist and Settings has adminUsername + adminPasswordHash, create the first admin.
 */
router.post('/seed-from-settings', async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ message: 'An admin already exists. Seed only runs when there are no admins.' });
    }
    const settings = await Settings.findOne().select('adminUsername adminPasswordHash').lean();
    if (!settings?.adminUsername || !settings?.adminPasswordHash) {
      return res.status(400).json({ message: 'Save admin username and password in Settings first.' });
    }
    await Admin.create({
      username: settings.adminUsername,
      passwordHash: settings.adminPasswordHash,
    });
    return res.status(201).json({ message: 'Admin created from Settings.', admin: { username: settings.adminUsername } });
  } catch (err) {
    console.error('Admin seed-from-settings error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/login
 * Body: { username, password }
 * Returns: { token, admin: { username } }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string' || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const name = username.trim().toLowerCase();
    if (!name) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const admin = await Admin.findOne({ username: name }).lean();
    if (!admin) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { sub: admin._id.toString(), role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      admin: { username: admin.username },
    });
  } catch (err) {
    console.error('Admin login error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/admin/me — validate token, return admin info (optional, for frontend)
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    const admin = await Admin.findById(decoded.sub).select('username').lean();
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }
    return res.status(200).json({ admin: { username: admin.username } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    console.error('Admin me error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
