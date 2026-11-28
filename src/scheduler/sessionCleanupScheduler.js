// ------------------------------------------------------------
// Scheduler for session expiry (runs hourly)
// ------------------------------------------------------------
const cron = require('node-cron');
const { Session } = require('../models');

// Delete sessions older than 20 hours
async function cleanupSessions() {
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const result = await Session.destroy({ where: { loginTime: { [require('sequelize').Op.lte]: cutoff } } });
  console.log(`[sessionCleanup] Removed ${result} session(s) at ${new Date().toISOString()}`);
}

// Schedule hourly
cron.schedule('0 * * * *', () => {
  cleanupSessions().catch(err => console.error('Session cleanup error:', err));
});

module.exports = { cleanupSessions };

