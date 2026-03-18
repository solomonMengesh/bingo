const mongoose = require('mongoose');

async function connectDb() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not set in environment variables');
  }

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  console.log('Connected to MongoDB');
}

module.exports = connectDb;

