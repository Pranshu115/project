import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import BOQ from '../models/BOQ.js';
import Order from '../models/Order.js';

dotenv.config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await BOQ.deleteMany({});
    await Order.deleteMany({});
    console.log('Cleared existing data');

    // Create sample users
    const users = await User.create([
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'ABC Construction Ltd',
        phone: '+91-9876543210',
        address: {
          street: '123 Construction Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        }
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'BuildMart Supply',
        phone: '+91-9876543211',
        address: {
          street: '456 Supply Avenue',
          city: 'Delhi',
          state: 'Delhi',
          zipCode: '110001',
          country: 'India'
        }
      },
      {
        name: 'Mike Johnson',
        email: 'mike@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'ProConstruct Materials',
        phone: '+91-9876543212',
        address: {
          street: '789 Materials Road',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          country: 'India'
        }
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'Modern Constructions',
        phone: '+91-9876543213',
        address: {
          street: '321 Builder Lane',
          city: 'Chennai',
          state: 'Tamil Nadu',
          zipCode: '600001',
          country: 'India'
        }
      }
    ]);

    console.log('Created sample users');

    // Find suppliers for product creation
    const suppliers = users.filter(u => u.userType === 'supplier');
    const serviceProviders = users.filter(u => u.userType === 'service_provider');

    // Create sample products
    const products = await Product.create([
      {
        name: 'Steel Reinforcement Bar 12mm TMT',
        description: 'High quality TMT bars for construction',
        category: 'steel',
        price: 45,
        unit: 'kg',
        stock: 5000,
        supplier: suppliers[0]._id,
        specifications: {
          grade: 'Fe500',
          brand: 'Tata Steel',
          dimensions: '12mm diameter'
        }
      },
      {
        name: 'Ordinary Portland Cement Grade 53',
        description: 'Premium quality cement for all construction needs',
        category: 'cement',
        price: 280,
        unit: 'bag',
        stock: 2000,
        supplier: suppliers[0]._id,
        specifications: {
          grade: 'Grade 53',
          brand: 'UltraTech',
          weight: 50
        }
      },
      {
        name: 'Fine Aggregate River Sand',
        description: 'Clean river sand for concrete mixing',
        category: 'aggregates',
        price: 25,
        unit: 'cft',
        stock: 10000,
        supplier: suppliers[1]._id,
        specifications: {
          type: 'River Sand',
          grade: 'Fine',
          source: 'Natural'
        }
      },
      {
        name: 'Red Clay Bricks First Class',
        description: 'High quality red clay bricks',
        category: 'masonry',
        price: 8,
        unit: 'nos',
        stock: 50000,
        supplier: suppliers[1]._id,
        specifications: {
          type: 'Clay Brick',
          grade: 'First Class',
          dimensions: '230x110x70mm'
        }
      },
      {
        name: 'Steel Reinforcement Bar 16mm TMT',
        description: 'Heavy duty TMT bars for structural work',
        category: 'steel',
        price: 48,
        unit: 'kg',
        stock: 3000,
        supplier: suppliers[0]._id,
        specifications: {
          grade: 'Fe500',
          brand: 'JSW Steel',
          dimensions: '16mm diameter'
        }
      }
    ]);

    console.log('Created sample products');

    // Create sample BOQs
    const boqs = await BOQ.create([
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
            category: 'steel',
            normalizedProduct: products[0]._id
          },
          {
            description: 'Cement bags Grade 53',
            quantity: 500,
            unit: 'bag',
            rate: 280,
            amount: 140000,
            category: 'cement',
            normalizedProduct: products[1]._id
          }
        ],
        status: 'completed',
        totalValue: 365000,
        normalizedAt: new Date('2024-01-20'),
        completedAt: new Date('2024-01-25')
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
            category: 'aggregates',
            normalizedProduct: products[2]._id
          },
          {
            description: 'Red clay bricks',
            quantity: 10000,
            unit: 'nos',
            rate: 8,
            amount: 80000,
            category: 'masonry',
            normalizedProduct: products[3]._id
          }
        ],
        status: 'processing',
        totalValue: 130000,
        normalizedAt: new Date('2024-02-01')
      },
      {
        name: 'Shopping Mall Infrastructure',
        description: 'Large scale commercial project BOQ',
        serviceProvider: serviceProviders[1]._id,
        project: {
          name: 'City Center Mall',
          location: 'Chennai, Tamil Nadu',
          type: 'Commercial',
          estimatedValue: 8900000
        },
        items: [
          {
            description: 'Heavy duty steel bars 16mm',
            quantity: 8000,
            unit: 'kg',
            rate: 48,
            amount: 384000,
            category: 'steel',
            normalizedProduct: products[4]._id
          }
        ],
        status: 'pending',
        totalValue: 384000
      }
    ]);

    console.log('Created sample BOQs');

    // Create sample orders
    const orders = await Order.create([
      {
        serviceProvider: serviceProviders[0]._id,
        supplier: suppliers[0]._id,
        boq: boqs[0]._id,
        items: [
          {
            product: products[0]._id,
            quantity: 5000,
            unitPrice: 45,
            totalPrice: 225000
          },
          {
            product: products[1]._id,
            quantity: 500,
            unitPrice: 280,
            totalPrice: 140000
          }
        ],
        status: 'delivered',
        totalAmount: 365000,
        paymentStatus: 'paid',
        deliveryAddress: {
          street: '123 Construction Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India',
          contactPerson: 'John Doe',
          contactPhone: '+91-9876543210'
        },
        expectedDeliveryDate: new Date('2024-01-25'),
        actualDeliveryDate: new Date('2024-01-24')
      },
      {
        serviceProvider: serviceProviders[0]._id,
        supplier: suppliers[1]._id,
        boq: boqs[1]._id,
        items: [
          {
            product: products[2]._id,
            quantity: 2000,
            unitPrice: 25,
            totalPrice: 50000
          }
        ],
        status: 'pending',
        totalAmount: 50000,
        paymentStatus: 'pending',
        deliveryAddress: {
          street: '123 Construction Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India',
          contactPerson: 'John Doe',
          contactPhone: '+91-9876543210'
        },
        expectedDeliveryDate: new Date('2024-02-15')
      },
      {
        serviceProvider: serviceProviders[1]._id,
        supplier: suppliers[0]._id,
        items: [
          {
            product: products[4]._id,
            quantity: 3000,
            unitPrice: 48,
            totalPrice: 144000
          }
        ],
        status: 'processing',
        totalAmount: 144000,
        paymentStatus: 'partial',
        deliveryAddress: {
          street: '321 Builder Lane',
          city: 'Chennai',
          state: 'Tamil Nadu',
          zipCode: '600001',
          country: 'India',
          contactPerson: 'Sarah Wilson',
          contactPhone: '+91-9876543213'
        },
        expectedDeliveryDate: new Date('2024-02-20')
      }
    ]);

    console.log('Created sample orders');

    console.log('Sample data seeded successfully!');
    console.log(`Created ${users.length} users`);
    console.log(`Created ${products.length} products`);
    console.log(`Created ${boqs.length} BOQs`);
    console.log(`Created ${orders.length} orders`);

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seeding function
seedData();