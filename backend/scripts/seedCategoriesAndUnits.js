import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';
import Unit from '../models/Unit.js';

dotenv.config();

const seedCategoriesAndUnits = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tatva');
    console.log('Connected to MongoDB');

    // Default categories
    const defaultCategories = [
      { name: 'steel', displayName: 'Steel & Metal' },
      { name: 'cement', displayName: 'Cement & Concrete' },
      { name: 'aggregates', displayName: 'Aggregates' },
      { name: 'masonry', displayName: 'Masonry' },
      { name: 'electrical', displayName: 'Electrical' },
      { name: 'plumbing', displayName: 'Plumbing' },
      { name: 'hardware', displayName: 'Hardware' },
      { name: 'other', displayName: 'Other' }
    ];

    // Default units
    const defaultUnits = [
      { name: 'kg', displayName: 'Kilogram' },
      { name: 'ton', displayName: 'Ton' },
      { name: 'bag', displayName: 'Bag' },
      { name: 'cft', displayName: 'Cubic Feet' },
      { name: 'nos', displayName: 'Numbers' },
      { name: 'sqft', displayName: 'Square Feet' },
      { name: 'meter', displayName: 'Meter' },
      { name: 'liter', displayName: 'Liter' }
    ];

    // Insert categories (skip if already exists)
    for (const cat of defaultCategories) {
      const existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        await Category.create(cat);
        console.log(`✅ Created category: ${cat.displayName}`);
      } else {
        console.log(`ℹ️  Category already exists: ${cat.displayName}`);
      }
    }

    // Insert units (skip if already exists)
    for (const unit of defaultUnits) {
      const existing = await Unit.findOne({ name: unit.name });
      if (!existing) {
        await Unit.create(unit);
        console.log(`✅ Created unit: ${unit.displayName}`);
      } else {
        console.log(`ℹ️  Unit already exists: ${unit.displayName}`);
      }
    }

    console.log('✅ Categories and units seeding completed');
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error seeding categories and units:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seeding function
seedCategoriesAndUnits();
