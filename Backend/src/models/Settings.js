const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    supportContact: {
      type: String,
      default: '@bingosupport',
      trim: true,
    },
    /** Admin login: stored in DB so seed can create first admin from here (optional). Never returned by GET. */
    adminUsername: { type: String, trim: true, default: null },
    adminPasswordHash: { type: String, default: null },
    /** When true, most API routes return 503; GET /api/settings and admin login remain allowed. */
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Single-document collection: we always use the first (and only) doc
const Settings = mongoose.model('Settings', settingsSchema);

async function getSettings() {
  let doc = await Settings.findOne().lean();
  if (!doc) {
    doc = await Settings.create({});
    doc = doc.toObject();
  }
  return doc;
}

module.exports = Settings;
module.exports.getSettings = getSettings;
