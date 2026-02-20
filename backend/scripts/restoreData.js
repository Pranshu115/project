import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import BOQ from '../models/BOQ.js';
import Order from '../models/Order.js';

dotenv.config();

const restoreData = async () => {
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

    // Create the original users that were in the system
    const users = await User.create([
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'ABC Construction Ltd',
        phone: '9876543210',
        address: {
          street: '123 Construction Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        },
        profile: {
          gstin: 'GST123456789',
          panNumber: 'ABCDE1234F',
          projects: [
            {
              name: 'Office Building Construction',
              location: 'Mumbai, Maharashtra',
              value: 2500000,
              status: 'active'
            },
            {
              name: 'Residential Complex Phase 1',
              location: 'Mumbai, Maharashtra',
              value: 4200000,
              status: 'active'
            }
          ]
        }
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'BuildMart Supply',
        phone: '9876543211',
        address: {
          street: '456 Supply Avenue',
          city: 'Delhi',
          state: 'Delhi',
          zipCode: '110001',
          country: 'India'
        },
        profile: {
          businessType: 'Wholesale Supplier',
          categories: ['steel', 'cement'],
          branches: [
            {
              name: 'Delhi Main Branch',
              address: '456 Supply Avenue, Delhi',
              contactPerson: 'Jane Smith',
              phone: '9876543211'
            }
          ]
        }
      },
      {
        name: 'Mike Johnson',
        email: 'mike@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'ProConstruct Materials',
        phone: '9876543212',
        address: {
          street: '789 Materials Road',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          country: 'India'
        },
        profile: {
          businessType: 'Construction Materials',
          categories: ['aggregates', 'masonry'],
          branches: [
            {
              name: 'Bangalore Branch',
              address: '789 Materials Road, Bangalore',
              contactPerson: 'Mike Johnson',
              phone: '9876543212'
            }
          ]
        }
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'Modern Constructions',
        phone: '9876543213',
        address: {
          street: '321 Builder Lane',
          city: 'Chennai',
          state: 'Tamil Nadu',
          zipCode: '600001',
          country: 'India'
        },
        profile: {
          gstin: 'GST987654321',
          panNumber: 'FGHIJ5678K',
          projects: [
            {
              name: 'Shopping Mall Infrastructure',
              location: 'Chennai, Tamil Nadu',
              value: 8900000,
              status: 'active'
            }
          ]
        }
      },
      {
        name: 'David Brown',
        email: 'david@example.com',
        password: 'password123',
        userType: 'service_provider',
        company: 'Elite Builders',
        phone: '9876543214',
        address: {
          street: '654 Elite Street',
          city: 'Pune',
          state: 'Maharashtra',
          zipCode: '411001',
          country: 'India'
        }
      },
      {
        name: 'Lisa Anderson',
        email: 'lisa@example.com',
        password: 'password123',
        userType: 'supplier',
        company: 'Premium Materials Co',
        phone: '9876543215',
        address: {
          street: '987 Premium Avenue',
          city: 'Hyderabad',
          state: 'Telangana',
          zipCode: '500001',
          country: 'India'
        }
      }
    ]);

    console.log('Created sample users');

    // Find suppliers and service providers for data relationships
    const suppliers = users.filter(u => u.userType === 'supplier');
    const serviceProviders = users.filter(u => u.userType === 'service_provider');

    // Create the exact products that were in the original system
    const products = await Product.create([
      {
        name: 'Steel Reinforcement Bar 12mm TMT',
        description: 'High quality TMT bars for construction',
        category: 'steel',
        price: 45,
        unit: 'kg',
        stock: 5000,
        supplier: suppliers[0]._id, // Jane Smith - BuildMart Supply
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
        supplier: suppliers[0]._id, // Jane Smith - BuildMart Supply
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
        supplier: suppliers[1]._id, // Mike Johnson - ProConstruct Materials
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
        supplier: suppliers[1]._id, // Mike Johnson - ProConstruct Materials
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
        supplier: suppliers[0]._id, // Jane Smith - BuildMart Supply
        specifications: {
          grade: 'Fe500',
          brand: 'JSW Steel',
          dimensions: '16mm diameter'
        }
      },
      {
        name: 'Coarse Aggregate 20mm',
        description: 'High quality coarse aggregate for concrete',
        category: 'aggregates',
        price: 30,
        unit: 'cft',
        stock: 8000,
        supplier: suppliers[1]._id, // Mike Johnson - ProConstruct Materials
        specifications: {
          size: '20mm',
          type: 'Crushed Stone',
          grade: 'Premium'
        }
      }
    ]);

    console.log('Created sample products');

    // Create BOQs that match the original dashboard data
    const boqs = await BOQ.create([
      {
        name: 'Office Building Construction',
        description: 'Complete BOQ for 5-story office building',
        serviceProvider: serviceProviders[0]._id, // John Doe - ABC Construction Ltd
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
        serviceProvider: serviceProviders[0]._id, // John Doe - ABC Construction Ltd
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
        serviceProvider: serviceProviders[1]._id, // Sarah Wilson - Modern Constructions
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
          },
          {
            description: 'Coarse aggregate 20mm',
            quantity: 3000,
            unit: 'cft',
            rate: 30,
            amount: 90000,
            category: 'aggregates',
            normalizedProduct: products[5]._id
          }
        ],
        status: 'pending',
        totalValue: 474000
      }
    ]);

    console.log('Created sample BOQs');

    // Create orders that match the original dashboard data
    const orders = await Order.create([
      {
        serviceProvider: serviceProviders[0]._id, // John Doe - ABC Construction Ltd
        supplier: suppliers[0]._id, // Jane Smith - BuildMart Supply
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
          contactPhone: '9876543210'
        },
        expectedDeliveryDate: new Date('2024-01-25'),
        actualDeliveryDate: new Date('2024-01-24')
      },
      {
        serviceProvider: serviceProviders[0]._id, // John Doe - ABC Construction Ltd
        supplier: suppliers[1]._id, // Mike Johnson - ProConstruct Materials
        boq: boqs[1]._id,
        items: [
          {
            product: products[2]._id,
            quantity: 2000,
            unitPrice: 25,
            totalPrice: 50000
          },
          {
            product: products[3]._id,
            quantity: 10000,
            unitPrice: 8,
            totalPrice: 80000
          }
        ],
        status: 'pending',
        totalAmount: 130000,
        paymentStatus: 'pending',
        deliveryAddress: {
          street: '123 Construction Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India',
          contactPerson: 'John Doe',
          contactPhone: '9876543210'
        },
        expectedDeliveryDate: new Date('2024-02-15')
      },
      {
        serviceProvider: serviceProviders[1]._id, // Sarah Wilson - Modern Constructions
        supplier: suppliers[0]._id, // Jane Smith - BuildMart Supply
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
          contactPhone: '9876543213'
        },
        expectedDeliveryDate: new Date('2024-02-20')
      },
      {
        serviceProvider: serviceProviders[1]._id, // Sarah Wilson - Modern Constructions
        supplier: suppliers[1]._id, // Mike Johnson - ProConstruct Materials
        items: [
          {
            product: products[5]._id,
            quantity: 2000,
            unitPrice: 30,
            totalPrice: 60000
          }
        ],
        status: 'delivered',
        totalAmount: 60000,
        paymentStatus: 'paid',
        deliveryAddress: {
          street: '321 Builder Lane',
          city: 'Chennai',
          state: 'Tamil Nadu',
          zipCode: '600001',
          country: 'India',
          contactPerson: 'Sarah Wilson',
          contactPhone: '9876543213'
        },
        expectedDeliveryDate: new Date('2024-02-10'),
        actualDeliveryDate: new Date('2024-02-09')
      }
    ]);

    console.log('Created sample orders');

    // Create admin user
    await User.create({
      name: 'Admin User',
      email: 'admin@tatvadirect.com',
      password: 'TatvaAdmin@2024',
      userType: 'admin',
      company: 'Tatva Direct',
      emailVerified: true
    });

    console.log('Created admin user');

    console.log('\n=== DATA RESTORATION COMPLETE ===');
    console.log(`✅ Created ${users.length + 1} users (including admin)`);
    console.log(`✅ Created ${products.length} products`);
    console.log(`✅ Created ${boqs.length} BOQs`);
    console.log(`✅ Created ${orders.length} orders`);
    
    console.log('\n=== SUMMARY ===');
    console.log('Service Providers:');
    serviceProviders.forEach(sp => {
      console.log(`  - ${sp.name} (${sp.company})`);
    });
    
    console.log('\nSuppliers:');
    suppliers.forEach(supplier => {
      console.log(`  - ${supplier.name} (${supplier.company})`);
    });
    
    console.log('\nProducts by Supplier:');
    suppliers.forEach(supplier => {
      const supplierProducts = products.filter(p => p.supplier.toString() === supplier._id.toString());
      console.log(`  ${supplier.company}:`);
      supplierProducts.forEach(product => {
        console.log(`    - ${product.name} (₹${product.price}/${product.unit})`);
      });
    });

    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('Admin: admin@tatvadirect.com / TatvaAdmin@2024');
    console.log('Service Provider: john@example.com / password123');
    console.log('Service Provider: sarah@example.com / password123');
    console.log('Supplier: jane@example.com / password123');
    console.log('Supplier: mike@example.com / password123');

  } catch (error) {
    console.error('Error restoring data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the restoration function
restoreData();