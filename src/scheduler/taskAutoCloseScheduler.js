// ------------------------------------------------------------
// Scheduler for auto‑close tasks (runs every 5 min)
// ------------------------------------------------------------
const cron = require('node-cron');
const { Task, TaskComment } = require('../models');
const { Op } = require('sequelize');

// Auto‑close job – selects tasks not completed and started >8 h ago
async function autoCloseTasks() {
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const tasks = await Task.findAll({
    where: {
      status: { [Op.ne]: 'completed' },
      startDate: { [Op.lte]: cutoff }
    }
  });
  for (const task of tasks) {
    await task.update({ status: 'auto-closed', actualEndTime: new Date() });
    await TaskComment.create({
      taskId: task.id,
      userId: null, // system comment
      comment: 'Task auto‑closed after 8 h – awaiting employee update.'
    });
  }
  console.log(`[autoClose] Processed ${tasks.length} task(s) at ${new Date().toISOString()}`);
}

// Schedule: every 5 minutes
cron.schedule('*/5 * * * *', () => {
  autoCloseTasks().catch(err => console.error('Auto‑close error:', err));
});

module.exports = { autoCloseTasks };

