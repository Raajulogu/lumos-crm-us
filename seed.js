import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User, ServiceCategory, Settings } from './models/index.js';
import { dbConnection } from './db.js';
import { logger } from './utils/logger.js';

dotenv.config();

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

    // 1. Seed or update Admin Account
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@markcrm.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminSecretPassword123';

    let admin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!admin) {
      admin = await User.create({
        fullName: 'Rajesh Sharma',
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        phone: '+91 98000 00000',
        role: 'admin',
        designation: 'Agency Director & Head',
        payType: 'salary',
        payRate: 0,
        status: 'active',
        mustChangePassword: false,
      });
      logger.info(`✅ Admin user seeded: ${adminEmail}`);
    } else {
      logger.info(`ℹ️ Admin user already exists: ${adminEmail}`);
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
    logger.info(`✅ Agency settings initialized with ${settings.reminders.length} reminder points`);

    logger.info('🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
