import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Product from '../models/Product.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: join(__dirname, '..', '.env') });

const approveExistingProducts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all products that are pending or don't have a status set
    const pendingProducts = await Product.find({
      $or: [
        { status: 'pending' },
        { status: { $exists: false } },
        { status: null }
      ]
    });

    console.log(`📦 Found ${pendingProducts.length} products to approve`);

    if (pendingProducts.length === 0) {
      console.log('✅ No pending products found. All products are already approved.');
      await mongoose.disconnect();
      return;
    }

    // Get admin user ID for approvedBy field
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tatvadirect.com';
    const admin = await User.findOne({
      $or: [
        { email: adminEmail.toLowerCase() },
        { userType: 'admin' }
      ]
    });

    const adminId = admin ? admin._id : null;
    const approvedAt = new Date();

    // Update all pending products to approved
    const result = await Product.updateMany(
      {
        $or: [
          { status: 'pending' },
          { status: { $exists: false } },
          { status: null }
        ]
      },
      {
        $set: {
          status: 'approved',
          isActive: true,
          approvedBy: adminId,
          approvedAt: approvedAt
        }
      }
    );

    console.log(`✅ Successfully approved ${result.modifiedCount} products`);
    console.log(`📋 Products updated:`);
    
    // List the approved products
    const approvedProducts = await Product.find({
      status: 'approved',
      approvedAt: approvedAt
    }).select('name category supplier').populate('supplier', 'name email');

    approvedProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (${product.category}) - Supplier: ${product.supplier?.name || 'Unknown'}`);
    });

    console.log('\n✅ Migration completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error approving products:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

approveExistingProducts();
