import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

// Load environment variables (same way as server.js)
dotenv.config();

const approveAllProducts = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Find ALL products that are NOT approved or rejected
    const query = {
      $or: [
        { 
          $and: [
            { status: { $ne: 'approved' } },
            { status: { $ne: 'rejected' } }
          ]
        },
        { status: { $exists: false } }
      ]
    };

    const pendingProducts = await Product.find(query);
    console.log(`\n📦 Found ${pendingProducts.length} products to approve`);

    if (pendingProducts.length === 0) {
      console.log('✅ No pending products found. All products are already approved.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // List products that will be approved
    console.log('\n📋 Products to be approved:');
    pendingProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (${product.category}) - Status: ${product.status || 'null/undefined'}`);
    });

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

    console.log('\n🔄 Approving products...');
    
    // Update all pending products to approved
    const result = await Product.updateMany(
      query,
      {
        $set: {
          status: 'approved',
          isActive: true,
          approvedBy: adminId,
          approvedAt: approvedAt
        }
      }
    );

    console.log(`\n✅ Successfully approved ${result.modifiedCount} products`);
    
    // Verify the update
    const approvedProducts = await Product.find({
      status: 'approved',
      approvedAt: approvedAt
    }).select('name status isActive').populate('supplier', 'name email').limit(10);

    console.log('\n📋 Sample of approved products:');
    approvedProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - Status: ${product.status}, Active: ${product.isActive}`);
    });

    console.log('\n✅ All products have been approved successfully!');
    console.log('🔄 Please refresh the supplier portal to see the updated status.');
    
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error approving products:', error);
    if (error.message.includes('MONGODB_URI') || error.message.includes('connection')) {
      console.error('\n💡 Tip: Make sure .env file exists in backend directory with MONGODB_URI');
      console.error('💡 Or make sure your MongoDB connection string is correct');
    }
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

approveAllProducts();
