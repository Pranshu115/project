import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const quickApprove = async () => {
  try {
    // Try to get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found');
      console.log('💡 Trying to connect with default localhost...');
      // Try localhost as fallback
      await mongoose.connect('mongodb://localhost:27017/tatva');
    } else {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
    }
    
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
        { status: { $exists: false } },
        { status: null }
      ]
    };

    const pendingProducts = await Product.find(query);
    console.log(`\n📦 Found ${pendingProducts.length} products to approve`);

    if (pendingProducts.length === 0) {
      console.log('✅ No pending products found.');
      await mongoose.disconnect();
      return;
    }

    console.log('\n📋 Products to approve:');
    pendingProducts.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.category}) - Current status: ${p.status || 'null/undefined'}`);
    });

    // Get admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tatvadirect.com';
    const admin = await User.findOne({
      $or: [
        { email: adminEmail.toLowerCase() },
        { userType: 'admin' }
      ]
    });

    const adminId = admin ? admin._id : null;
    const approvedAt = new Date();

    console.log('\n🔄 Approving all products...');
    
    // Update all products
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

    console.log(`\n✅ Successfully approved ${result.modifiedCount} products!`);
    
    // Verify
    const verified = await Product.find({
      status: 'approved',
      approvedAt: approvedAt
    }).select('name status').limit(5);
    
    console.log('\n📋 Verified approved products:');
    verified.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - Status: ${p.status}`);
    });

    console.log('\n✅ Done! All products are now approved.');
    console.log('🔄 Please refresh the supplier portal to see the changes.');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('connect')) {
      console.log('\n💡 Make sure:');
      console.log('   1. MongoDB is running');
      console.log('   2. .env file has MONGODB_URI');
      console.log('   3. Or use the Admin Dashboard "Approve All" button instead');
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

quickApprove();
