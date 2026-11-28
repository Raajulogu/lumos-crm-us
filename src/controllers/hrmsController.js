// ------------------------------------------------------------
// HRMS Controller (Express) – Mongoose version
// ------------------------------------------------------------
const { AttendanceRecord, Leave, Permission, User } = require('../models');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer'); // SMTP config via env vars

// ---------- Attendance ----------
async function getAttendance(req, res) {
  const { userId } = req.query;
  const filter = userId ? { employeeId: userId } : {};
  const records = await AttendanceRecord.find(filter).sort({ clockInTime: -1 });
  return res.json({ success: true, data: records });
}

async function postAttendance(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  }
  const { type, timestamp } = req.body;
  const record = await AttendanceRecord.create({ employeeId: req.user._id, clockInTime: timestamp || new Date(), status: type || 'clocked_in', date: new Date().toISOString().split('T')[0] });
  return res.status(201).json({ success: true, data: record });
}

// ---------- Leaves ----------
async function getLeaves(req, res) {
  const { userId } = req.query;
  const filter = userId ? { userId } : {};
  const leaves = await Leave.find(filter).sort({ start: -1 });
  return res.json({ success: true, data: leaves });
}

async function postLeave(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  }
  const { startDate, endDate, type, reason } = req.body;
  const leave = await Leave.create({ userId: req.user._id, start: startDate, end: endDate, type, reason, status: 'pending' });
  return res.status(201).json({ success: true, data: leave });
}

// ---------- Permissions ----------
async function postPermission(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  }
  const { date, type, reason } = req.body;
  const perm = await Permission.create({ userId: req.user._id, date, type, reason, status: 'pending' });
  return res.status(201).json({ success: true, data: perm });
}

// ---------- Send Mail ----------
async function postMail(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  }
  const { to, subject, html } = req.body;
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
  return res.json({ success: true, messageId: info.messageId });
}

module.exports = {
  getAttendance,
  postAttendance,
  getLeaves,
  postLeave,
  postPermission,
  postMail,
};
