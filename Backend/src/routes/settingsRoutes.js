const express = require('express');
const bcrypt = require('bcrypt');
const Settings = require('../models/Settings');
const getSettings = Settings.getSettings;

const router = express.Router();
const SALT_ROUNDS = 10;

// GET /api/settings — return config (adminPasswordHash never returned)
router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    const { adminPasswordHash, ...safe } = settings;
    return res.json(safe);
  } catch (err) {
    console.error('Error fetching settings', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/settings — update settings (admin). Can set adminUsername + adminPassword to store in DB.
router.patch('/', async (req, res) => {
  try {
    const {
      supportContact,
      adminUsername,
      adminPassword,
      maintenanceMode,
      welcomeBonusEnabled,
      welcomeBonusAmount,
    } = req.body || {};
    let doc = await Settings.findOne();
    if (!doc) doc = await Settings.create({});
    if (typeof supportContact === 'string') {
      doc.supportContact = supportContact.trim() || doc.supportContact;
    }
    if (typeof adminUsername === 'string' && adminUsername.trim()) {
      doc.adminUsername = adminUsername.trim().toLowerCase();
    }
    if (typeof adminPassword === 'string' && adminPassword.length > 0) {
      doc.adminPasswordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    }
    if (typeof maintenanceMode === 'boolean') {
      doc.maintenanceMode = maintenanceMode;
    }

    if (typeof welcomeBonusEnabled === 'boolean') {
      doc.welcomeBonusEnabled = welcomeBonusEnabled;
    }
    if (welcomeBonusAmount != null) {
      const amt = Number(welcomeBonusAmount);
      if (Number.isFinite(amt) && amt >= 0) {
        doc.welcomeBonusAmount = amt;
      }
    }
    await doc.save();
    const out = doc.toObject ? doc.toObject() : doc;
    delete out.adminPasswordHash;
    return res.json(out);
  } catch (err) {
    console.error('Error updating settings', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
