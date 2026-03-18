const Settings = require('../models/Settings');

/** Paths that remain allowed when maintenance mode is on (so admin can log in and turn it off) */
const ALLOWED_WHEN_MAINTENANCE = [
  { method: 'GET', path: '/api/settings' },
  { method: 'PATCH', path: '/api/settings' },
  { method: 'POST', path: '/api/admin/login' },
  { method: 'GET', path: '/api/admin/me' },
  { method: 'GET', path: '/api/admin/health' },
  { method: 'POST', path: '/api/broadcast' },
];

function isAllowed(method, path) {
  const normPath = (path || '').split('?')[0];
  return ALLOWED_WHEN_MAINTENANCE.some(
    (a) => a.method === method && (a.path === normPath || normPath.startsWith(a.path + '/'))
  );
}

async function maintenanceMode(req, res, next) {
  const path = req.originalUrl || req.url || req.path;
  if (!path.startsWith('/api')) return next();
  if (isAllowed(req.method, path)) return next();
  try {
    const settings = await Settings.findOne().select('maintenanceMode').lean();
    if (settings?.maintenanceMode) {
      return res.status(503).json({
        maintenance: true,
        message: 'Service is temporarily under maintenance. Please try again later.',
      });
    }
  } catch (err) {
    console.error('Maintenance middleware error', err);
  }
  next();
}

module.exports = maintenanceMode;
