import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import BOQ from '../models/BOQ.js';
import Order from '../models/Order.js';

dotenv.config();

const fixData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get existing data
    const users = await User.find();
    const products = await Product.find();
    const suppliers = users.filter(u => u.userType === 'supplier');
    const serviceProviders = users.filter(u => u.userType === 'service_provider');

    console.log(`Found ${users.length} users, ${products.length} products`);
    console.log(`Suppliers: ${suppliers.length}, Service Providers: ${serviceProviders.length}`);

    // Create simple BOQs without the problematic project field structure
    if (serviceProviders.length > 0) {
      const simpleBOQs = [
        {
          name: 'Office Building Construction',
          description: 'Complete BOQ for 5-story office building',
          serviceProvider: serviceProviders[0]._id,
          items: [
            {
              description: 'Steel reinforcement bars 12mm',
              quantity: 5000,
              unit: 'kg',
              rate: 45,
              amount: 225000,
              category: 'steel'
            },
            {
              description: 'Cement bags Grade 53',
              quantity: 500,
              unit: 'bag',
              rate: 280,
              amount: 140000,
              category: 'cement'
            }
          ],
          status: 'completed',
          totalValue: 365000
        },
        {
          name: 'Residential Complex Phase 1',
          description: 'BOQ for residential apartment complex',
          serviceProvider: serviceProviders[0]._id,
          items: [
            {
              description: 'River sand for concrete',
              quantity: 2000,
              unit: 'cft',
              rate: 25,
              amount: 50000,
              category: 'aggregates'
            },
            {
              description: 'Red clay bricks',
              quantity: 10000,
              unit: 'nos',
              rate: 8,
              amount: 80000,
              category: 'masonry'
            }
          ],
          status: 'processing',
          totalValue: 130000
        }
      ];

      if (serviceProviders.length > 1) {
        simpleBOQs.push({
          name: 'Shopping Mall Infrastructure',
          description: 'Large scale commercial project BOQ',
          serviceProvider: serviceProviders[1]._id,
          items: [
            {
              description: 'Heavy duty steel bars',
              quantity: 8000,
              unit: 'kg',
              rate: 48,
              amount: 384000,
              category: 'steel'
            }
          ],
          status: 'pending',
          totalValue: 384000
        });
      }

      for (const boqData of simpleBOQs) {
        try {
          const existingBOQ = await BOQ.findOne({ name: boqData.name });
          if (!existingBOQ) {
            await BOQ.create(boqData);
            console.log(`✅ Created BOQ: ${boqData.name}`);
          } else {
            console.log(`ℹ️  BOQ already exists: ${boqData.name}`);
          }
        } catch (error) {
          console.log(`⚠️  BOQ ${boqData.name} creation failed:`, error.message);
        }
      }
    }

    // Create simple orders
    if (suppliers.length > 0 && serviceProviders.length > 0 && products.length > 0) {
      const simpleOrders = [
        {
          orderNumber: 'ORD001',
          serviceProvider: serviceProviders[0]._id,
          supplier: suppliers[0]._id,
          items: [
            {
              product: products[0]._id,
              quantity: 1000,
              unitPrice: products[0].price,
              totalPrice: 1000 * products[0].price
            }
          ],
          status: 'delivered',
          totalAmount: 1000 * products[0].price,
          paymentStatus: 'paid'
        },
        {
          orderNumber: 'ORD002',
          serviceProvider: serviceProviders[0]._id,
          supplier: suppliers.length > 1 ? suppliers[1]._id : suppliers[0]._id,
          items: [
            {
              product: products.length > 2 ? products[2]._id : products[0]._id,
              quantity: 500,
              unitPrice: products.length > 2 ? products[2].price : products[0].price,
              totalPrice: 500 * (products.length > 2 ? products[2].price : products[0].price)
            }
          ],
          status: 'pending',
          totalAmount: 500 * (products.length > 2 ? products[2].price : products[0].price),
          paymentStatus: 'pending'
        }
      ];

      if (serviceProviders.length > 1) {
        simpleOrders.push({
          orderNumber: 'ORD003',
          serviceProvider: serviceProviders[1]._id,
          supplier: suppliers[0]._id,
          items: [
            {
              product: products.length > 1 ? products[1]._id : products[0]._id,
              quantity: 300,
              unitPrice: products.length > 1 ? products[1].price : products[0].price,
              totalPrice: 300 * (products.length > 1 ? products[1].price : products[0].price)
            }
          ],
          status: 'processing',
          totalAmount: 300 * (products.length > 1 ? products[1].price : products[0].price),
          paymentStatus: 'partial'
        });
      }

      for (const orderData of simpleOrders) {
        try {
          const existingOrder = await Order.findOne({ orderNumber: orderData.orderNumber });
          if (!existingOrder) {
            await Order.create(orderData);
            console.log(`✅ Created Order: ${orderData.orderNumber}`);
          } else {
            console.log(`ℹ️  Order already exists: ${orderData.orderNumber}`);
          }
        } catch (error) {
          console.log(`⚠️  Order ${orderData.orderNumber} creation failed:`, error.message);
        }
      }
    }

    // Final count
    const finalUsers = await User.find();
    const finalProducts = await Product.find();
    const finalBOQs = await BOQ.find();
    const finalOrders = await Order.find();

    console.log('\n=== FINAL DATA COUNT ===');
    console.log(`👥 Total Users: ${finalUsers.length}`);
    console.log(`📦 Total Products: ${finalProducts.length}`);
    console.log(`📋 Total BOQs: ${finalBOQs.length}`);
    console.log(`🛒 Total Orders: ${finalOrders.length}`);

    console.log('\n✅ Data fix completed successfully!');
    console.log('Your application now has sample data for testing.');

  } catch (error) {
    console.error('Error fixing data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the function
fixData();