import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import BOQ from '../models/BOQ.js';
import Order from '../models/Order.js';

dotenv.config();

const addMissingData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check existing data
    const existingUsers = await User.find();
    const existingProducts = await Product.find();
    const existingBOQs = await BOQ.find();
    const existingOrders = await Order.find();

    console.log(`Found ${existingUsers.length} existing users`);
    console.log(`Found ${existingProducts.length} existing products`);
    console.log(`Found ${existingBOQs.length} existing BOQs`);
    console.log(`Found ${existingOrders.length} existing orders`);

    // Create users only if they don't exist
    const usersToCreate = [
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'ABC Construction Ltd',
        phone: '9876543210'
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'BuildMart Supply',
        phone: '9876543211'
      },
      {
        name: 'Mike Johnson',
        email: 'mike@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'ProConstruct Materials',
        phone: '9876543212'
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'Modern Constructions',
        phone: '9876543213'
      }
    ];

    const newUsers = [];
    for (const userData of usersToCreate) {
      const existingUser = existingUsers.find(u => u.email === userData.email);
      if (!existingUser) {
        try {
          const newUser = await User.create(userData);
          newUsers.push(newUser);
          console.log(`✅ Created user: ${userData.name} (${userData.email})`);
        } catch (error) {
          console.log(`⚠️  User ${userData.email} might already exist or validation failed`);
        }
      } else {
        newUsers.push(existingUser);
        console.log(`ℹ️  User already exists: ${userData.name} (${userData.email})`);
      }
    }

    // Ensure admin user exists
    const adminUser = existingUsers.find(u => u.email === 'admin@tatvadirect.com');
    if (!adminUser) {
      try {
        await User.create({
          name: 'Admin User',
          email: 'admin@tatvadirect.com',
          password: 'TatvaAdmin@2024',
          userType: 'admin',
          company: 'Tatva Direct',
          emailVerified: true
        });
        console.log('✅ Created admin user');
      } catch (error) {
        console.log('⚠️  Admin user might already exist');
      }
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Get suppliers and service providers
    const allUsers = await User.find();
    const suppliers = allUsers.filter(u => u.userType === 'supplier');
    const serviceProviders = allUsers.filter(u => u.userType === 'service_provider');

    console.log(`Found ${suppliers.length} suppliers and ${serviceProviders.length} service providers`);

    // Create products only if we have suppliers and they don't exist
    if (suppliers.length > 0) {
      const productsToCreate = [
        {
          name: 'Steel Reinforcement Bar 12mm TMT',
          description: 'High quality TMT bars for construction',
          category: 'steel',
          price: 45,
          unit: 'kg',
          stock: 5000,
          supplier: suppliers[0]._id
        },
        {
          name: 'Ordinary Portland Cement Grade 53',
          description: 'Premium quality cement for all construction needs',
          category: 'cement',
          price: 280,
          unit: 'bag',
          stock: 2000,
          supplier: suppliers[0]._id
        },
        {
          name: 'Fine Aggregate River Sand',
          description: 'Clean river sand for concrete mixing',
          category: 'aggregates',
          price: 25,
          unit: 'cft',
          stock: 10000,
          supplier: suppliers.length > 1 ? suppliers[1]._id : suppliers[0]._id
        },
        {
          name: 'Red Clay Bricks First Class',
          description: 'High quality red clay bricks',
          category: 'masonry',
          price: 8,
          unit: 'nos',
          stock: 50000,
          supplier: suppliers.length > 1 ? suppliers[1]._id : suppliers[0]._id
        }
      ];

      for (const productData of productsToCreate) {
        const existingProduct = existingProducts.find(p => p.name === productData.name);
        if (!existingProduct) {
          try {
            await Product.create(productData);
            console.log(`✅ Created product: ${productData.name}`);
          } catch (error) {
            console.log(`⚠️  Product ${productData.name} creation failed:`, error.message);
          }
        } else {
          console.log(`ℹ️  Product already exists: ${productData.name}`);
        }
      }
    }

    // Create BOQs only if we have service providers and they don't exist
    if (serviceProviders.length > 0) {
      const boqsToCreate = [
        {
          name: 'Office Building Construction',
          description: 'Complete BOQ for 5-story office building',
          serviceProvider: serviceProviders[0]._id,
          project: {
            name: 'Corporate Tower',
            location: 'Mumbai, Maharashtra',
            type: 'Commercial',
            estimatedValue: 2500000
          },
          items: [
            {
              description: 'Steel reinforcement bars 12mm',
              quantity: 5000,
              unit: 'kg',
              rate: 45,
              amount: 225000,
              category: 'steel'
            }
          ],
          status: 'completed',
          totalValue: 225000
        },
        {
          name: 'Residential Complex Phase 1',
          description: 'BOQ for residential apartment complex',
          serviceProvider: serviceProviders[0]._id,
          project: {
            name: 'Green Valley Apartments',
            location: 'Mumbai, Maharashtra',
            type: 'Residential',
            estimatedValue: 4200000
          },
          items: [
            {
              description: 'River sand for concrete',
              quantity: 2000,
              unit: 'cft',
              rate: 25,
              amount: 50000,
              category: 'aggregates'
            }
          ],
          status: 'processing',
          totalValue: 50000
        }
      ];

      for (const boqData of boqsToCreate) {
        const existingBOQ = existingBOQs.find(b => b.name === boqData.name);
        if (!existingBOQ) {
          try {
            await BOQ.create(boqData);
            console.log(`✅ Created BOQ: ${boqData.name}`);
          } catch (error) {
            console.log(`⚠️  BOQ ${boqData.name} creation failed:`, error.message);
          }
        } else {
          console.log(`ℹ️  BOQ already exists: ${boqData.name}`);
        }
      }
    }

    // Create sample orders if we have both suppliers and service providers
    if (suppliers.length > 0 && serviceProviders.length > 0) {
      const products = await Product.find();
      if (products.length > 0) {
        const ordersToCreate = [
          {
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
          }
        ];

        for (const orderData of ordersToCreate) {
          try {
            await Order.create(orderData);
            console.log(`✅ Created sample order`);
          } catch (error) {
            console.log(`⚠️  Order creation failed:`, error.message);
          }
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

    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('Admin: admin@tatvadirect.com / TatvaAdmin@2024');
    console.log('Service Provider: john@example.com / password123');
    console.log('Service Provider: sarah@example.com / password123');
    console.log('Supplier: jane@example.com / password123');
    console.log('Supplier: mike@example.com / password123');

    console.log('\n✅ Data restoration completed successfully!');

  } catch (error) {
    console.error('Error adding missing data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the function
addMissingData();