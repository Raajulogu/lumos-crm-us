import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User, ServiceCategory, Settings } from './models/index.js';
import { dbConnection } from './db.js';
import { logger } from './utils/logger.js';

dotenv.config();

const INITIAL_USERS = [
  {
    fullName: 'Rajesh Sharma',
    email: 'admin@lumos.in',
    password: 'AdminPassword@123',
    phone: '+91 98200 11223',
    role: 'admin',
    designation: 'Agency Director & Head',
    payType: 'salary',
    payRate: 150000,
    status: 'active',
    mustChangePassword: false,
    notes: 'Primary agency administrator',
  },
  {
    fullName: 'Priya Sharma',
    email: 'priya@lumos.in',
    password: 'PriyaPassword@123',
    phone: '+91 98765 43210',
    role: 'employee',
    designation: 'Senior SEO & Content Lead',
    payType: 'salary',
    payRate: 65000,
    status: 'active',
    mustChangePassword: false,
    notes: 'Handles high-tier clients and organic search campaigns',
  },
  {
    fullName: 'Arjun Mehta',
    email: 'arjun@lumos.in',
    password: 'ArjunPassword@123',
    phone: '+91 98112 33445',
    role: 'employee',
    designation: 'Performance Marketing Specialist',
    payType: 'salary',
    payRate: 55000,
    status: 'active',
    mustChangePassword: false,
    notes: 'Specializes in Meta and Google Ads performance funnels',
  },
];

const DEFAULT_CATEGORIES = [
  { name: 'SEO', color: '#3b82f6', isDefault: true },
  { name: 'Social Media Marketing', color: '#8b5cf6', isDefault: true },
  { name: 'PPC & Google Ads', color: '#10b981', isDefault: true },
  { name: 'Content Writing', color: '#f59e0b', isDefault: true },
  { name: 'Web Design & Dev', color: '#06b6d4', isDefault: true },
  { name: 'Email Marketing', color: '#ec4899', isDefault: true },
];

async function seedDatabase() {
  try {
    logger.info('🌱 Starting database seeding...');
    await dbConnection();

    // 1. Seed or update Initial Accounts (1 Admin, 2 Employees)
    for (const userData of INITIAL_USERS) {
      let user = await User.findOne({ email: userData.email.toLowerCase() });

      if (!user) {
        user = await User.create(userData);
        logger.info(`✅ Created account: [${user.role.toUpperCase()}] ${user.fullName} (${user.email})`);
      } else {
        // Update credentials and ensure active status
        user.password = userData.password;
        user.status = 'active';
        user.mustChangePassword = false;
        user.role = userData.role;
        user.designation = userData.designation;
        user.phone = userData.phone;
        await user.save();
        logger.info(`🔄 Updated credentials for: [${user.role.toUpperCase()}] ${user.fullName} (${user.email})`);
      }
    }

    // 2. Seed Default Service Categories
    for (const cat of DEFAULT_CATEGORIES) {
      const exists = await ServiceCategory.findOne({ name: cat.name });
      if (!exists) {
        await ServiceCategory.create(cat);
        logger.info(`✅ Created category: ${cat.name}`);
      }
    }

    // 3. Seed Default Agency Settings
    const settings = await Settings.getSettings();
    logger.info(`✅ Agency settings verified with ${settings.reminders.length} reminder points`);

    logger.info('🎉 Seeding successfully finished!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
