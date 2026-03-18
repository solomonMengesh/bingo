/**
 * Seed the first admin user from env ADMIN_USERNAME and ADMIN_PASSWORD.
 * Run: node src/scripts/seedAdmin.js
 * Or require and run from index after connectDb if you want auto-seed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');

const SALT_ROUNDS = 10;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/bingo';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const existing = await Admin.countDocuments();
  if (existing > 0) {
    console.log('Admin(s) already exist. Skip seed.');
    await mongoose.disconnect();
    return;
  }
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  if (!username) {
    console.error('Set ADMIN_USERNAME in .env');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await Admin.create({ username, passwordHash });
  console.log(`Admin created: username="${username}". Change password after first login if using default.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
