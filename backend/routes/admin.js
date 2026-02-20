import express from 'express';
import { authenticateToken } from './auth.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import BOQ from '../models/BOQ.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Admin credentials from environment variables
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@tatvadirect.com',
  password: process.env.ADMIN_PASSWORD || '' // Should be set in production
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tatvadirect.com';
    
    if (user && (user.email.toLowerCase() === adminEmail.toLowerCase() || user.userType === 'admin')) {
      next();
    } else {
      res.status(403).json({ 
        status: 'error',
        message: 'Access denied. Admin privileges required.' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Error checking admin privileges' 
    });
  }
};

// Diagnostic endpoint to check products and suppliers
router.get('/diagnostics/products-suppliers', authenticateToken, isAdmin, async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const Product = (await import('../models/Product.js')).default;
    
    // Get all suppliers
    const suppliers = await User.find({ userType: 'supplier' }).select('_id name email company');
    
    // Get all products
    const products = await Product.find().select('name supplier');
    
    // Group products by supplier
    const supplierProductMap = {};
    suppliers.forEach(supplier => {
      supplierProductMap[supplier._id.toString()] = {
        supplier: {
          id: supplier._id.toString(),
          name: supplier.name,
          email: supplier.email,
          company: supplier.company
        },
        products: []
      };
    });
    
    // Map products to suppliers
    products.forEach(product => {
      if (product.supplier) {
        const supplierId = product.supplier.toString ? product.supplier.toString() : String(product.supplier);
        if (supplierProductMap[supplierId]) {
          supplierProductMap[supplierId].products.push({
            id: product._id.toString(),
            name: product.name
          });
        } else {
          // Product has supplier ID that doesn't exist in suppliers list
          if (!supplierProductMap['_orphaned']) {
            supplierProductMap['_orphaned'] = {
              supplier: { id: 'ORPHANED', name: 'Orphaned Products', email: '', company: '' },
              products: []
            };
          }
          supplierProductMap['_orphaned'].products.push({
            id: product._id.toString(),
            name: product.name,
            supplierId: supplierId
          });
        }
      } else {
        // Product has no supplier
        if (!supplierProductMap['_no_supplier']) {
          supplierProductMap['_no_supplier'] = {
            supplier: { id: 'NO_SUPPLIER', name: 'Products Without Supplier', email: '', company: '' },
            products: []
          };
        }
        supplierProductMap['_no_supplier'].products.push({
          id: product._id.toString(),
          name: product.name
        });
      }
    });
    
    const result = Object.values(supplierProductMap);
    
    res.json({
      status: 'success',
      totalSuppliers: suppliers.length,
      totalProducts: products.length,
      suppliersWithProducts: result.filter(s => s.products.length > 0 && !s.supplier.id.startsWith('_')).length,
      data: result
    });
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Generate comprehensive admin data
const generateAdminData = async () => {
  try {
    // Get all users
    const allUsers = await User.find().select('-password');
    const serviceProviders = allUsers.filter(u => u.userType === 'service_provider');
    // Filter out "Naina Mahajan" from suppliers
    const suppliers = allUsers.filter(u => 
      u.userType === 'supplier' && 
      u.name?.toLowerCase() !== 'naina mahajan'
    );

    // Get all products without populating
    const products = await Product.find();
    
    // Debug: Log product counts and supplier associations
    console.log(`📦 [ADMIN DATA] Total products found: ${products.length}`);
    console.log(`📦 [ADMIN DATA] Total suppliers found: ${suppliers.length}`);
    
    if (products.length > 0) {
      const productsWithSupplier = products.filter(p => p.supplier).length;
      console.log(`📦 [ADMIN DATA] Products with supplier field: ${productsWithSupplier}`);
      
      // Get all unique supplier IDs from products
      const supplierIdsFromProducts = [...new Set(products.filter(p => p.supplier).map(p => p.supplier.toString()))];
      console.log(`📦 [ADMIN DATA] Unique supplier IDs from products: ${supplierIdsFromProducts.length}`);
      console.log(`📦 [ADMIN DATA] Supplier IDs from products:`, supplierIdsFromProducts.slice(0, 5));
      
      // Get all supplier IDs
      const supplierIds = suppliers.map(s => s._id.toString());
      console.log(`📦 [ADMIN DATA] Supplier IDs from users:`, supplierIds.slice(0, 5));
      
      // Check for mismatches
      const missingSuppliers = supplierIdsFromProducts.filter(id => !supplierIds.includes(id));
      if (missingSuppliers.length > 0) {
        console.log(`⚠️ [ADMIN DATA] Products reference suppliers not in supplier list:`, missingSuppliers);
      }
      
      // Log sample products with their suppliers
      products.slice(0, 10).forEach((p, idx) => {
        const supplierId = p.supplier ? (p.supplier.toString ? p.supplier.toString() : String(p.supplier)) : 'NO SUPPLIER';
        const supplierName = suppliers.find(s => s._id.toString() === supplierId)?.name || 'UNKNOWN';
        console.log(`📦 [ADMIN DATA] Product ${idx + 1}: "${p.name}" - supplier ID: ${supplierId} (${supplierName})`);
      });
      
      // Count products per supplier
      console.log(`\n📊 [ADMIN DATA] Products per supplier breakdown:`);
      suppliers.forEach(supplier => {
        const count = products.filter(p => {
          if (!p.supplier) return false;
          const pid = p.supplier.toString ? p.supplier.toString() : String(p.supplier);
          return pid === supplier._id.toString();
        }).length;
        console.log(`📊 [ADMIN DATA]   - ${supplier.name}: ${count} products`);
      });
      console.log(`\n`);
    }
    
    // Get all BOQs without populating
    const boqs = await BOQ.find();
    
    // Get all orders with full population - ensure all fields are populated
    const orders = await Order.find()
      .populate({
        path: 'items.product',
        select: 'name category',
        model: 'Product'
      })
      .populate({
        path: 'serviceProvider',
        select: 'name company email',
        model: 'User'
      })
      .populate({
        path: 'supplier',
        select: 'name company email',
        model: 'User'
      })
      .populate({
        path: 'boq',
        select: 'name description',
        model: 'BOQ'
      });

    // Generate supplier data with their products and orders
    const supplierData = await Promise.all(suppliers.map(async (supplier) => {
      const supplierId = supplier._id;
      const supplierIdString = supplierId.toString();
      
      // Use MongoDB query with ObjectId - this is the most reliable method
      const supplierProducts = await Product.find({ 
        supplier: supplierId 
      });
      
      // Convert to plain objects for consistency
      const supplierProductsArray = supplierProducts.map(p => p.toObject ? p.toObject() : p);
      
      // Also check the in-memory filter as fallback/double-check
      const supplierProductsFiltered = products.filter(p => {
        if (!p.supplier) return false;
        // Handle both ObjectId and string comparisons
        let productSupplierId;
        if (p.supplier.toString) {
          productSupplierId = p.supplier.toString();
        } else if (p.supplier._id) {
          productSupplierId = p.supplier._id.toString();
        } else {
          productSupplierId = String(p.supplier);
        }
        return productSupplierId === supplierIdString;
      });
      
      // Use MongoDB query result (most reliable), but use filter if it finds more
      let finalSupplierProducts = supplierProductsArray;
      if (supplierProductsFiltered.length > supplierProductsArray.length) {
        console.log(`⚠️ [ADMIN DATA] Filter found more products (${supplierProductsFiltered.length}) than MongoDB query (${supplierProductsArray.length}) for supplier "${supplier.name}"`);
        finalSupplierProducts = supplierProductsFiltered.map(p => {
          // Convert Mongoose document to plain object
          if (p.toObject && typeof p.toObject === 'function') {
            return p.toObject();
          } else if (p._doc) {
            return p._doc;
          } else {
            return p;
          }
        });
      }
      
      // Debug logging for ALL suppliers to see what's happening
      console.log(`🔍 [ADMIN DATA] Supplier "${supplier.name}" (ID: ${supplierIdString})`);
      console.log(`🔍 [ADMIN DATA]   - Products via MongoDB query: ${supplierProducts.length}`);
      console.log(`🔍 [ADMIN DATA]   - Products via filter: ${supplierProductsFiltered.length}`);
      console.log(`🔍 [ADMIN DATA]   - Final products count (before fallback): ${finalSupplierProducts.length}`);
      
      // If no products found, check why and use fallback
      if (finalSupplierProducts.length === 0) {
        // Check if any products in database have this supplier ID using a more thorough check
        const testProducts = products.filter(p => {
          if (!p.supplier) return false;
          let productSupplierId;
          if (p.supplier.toString) {
            productSupplierId = p.supplier.toString();
          } else if (p.supplier._id) {
            productSupplierId = p.supplier._id.toString();
          } else {
            productSupplierId = String(p.supplier);
          }
          return productSupplierId === supplierIdString;
        });
        console.log(`⚠️ [ADMIN DATA]   - No products found! Test filter found: ${testProducts.length} products`);
        if (testProducts.length > 0) {
          console.log(`⚠️ [ADMIN DATA]   - Test products found, using them:`, testProducts.slice(0, 3).map(p => ({ name: p.name, supplier: p.supplier })));
          // Use test products if MongoDB query failed but filter found them
          finalSupplierProducts = testProducts.map(p => p.toObject ? p.toObject() : p);
          console.log(`✅ [ADMIN DATA]   - Updated final products count: ${finalSupplierProducts.length}`);
        }
      } else {
        console.log(`✅ [ADMIN DATA]   - Product names:`, finalSupplierProducts.slice(0, 3).map(p => p.name || p._id));
      }
      const supplierOrders = orders.filter(o => 
        o.supplier && o.supplier.toString() === supplier._id.toString()
      );
      const totalInventoryValue = finalSupplierProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
      const totalRevenue = supplierOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.totalAmount, 0);
      
      // Get service providers this supplier has worked with
      const serviceProviderIds = [...new Set(supplierOrders.map(o => o.serviceProvider?._id?.toString()).filter(Boolean))];
      const serviceProvidersWorkedWith = serviceProviderIds.length;
      
      // Ensure products is always an array
      const productsArray = Array.isArray(finalSupplierProducts) ? finalSupplierProducts : [];
      
      return {
        ...supplier.toObject(),
        products: productsArray, // Always return an array, even if empty
        orders: supplierOrders.map(order => ({
          orderNumber: order.orderNumber,
          serviceProvider: order.serviceProvider ? {
            name: order.serviceProvider.name,
            company: order.serviceProvider.company,
            email: order.serviceProvider.email
          } : null,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
          items: order.items?.length || 0
        })),
        totalProducts: productsArray.length, // Use productsArray.length for consistency
        totalInventoryValue: totalInventoryValue,
        totalRevenue: totalRevenue,
        activeOrders: supplierOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
        completedOrders: supplierOrders.filter(o => o.status === 'delivered').length,
        categories: [...new Set(finalSupplierProducts.map(p => p.category))],
        serviceProvidersWorkedWith: serviceProvidersWorkedWith,
        averageOrderValue: supplierOrders.length > 0 ? totalRevenue / supplierOrders.length : 0
      };
    }));

    // Generate service provider data with their BOQs and orders
    const allServiceProviderData = await Promise.all(serviceProviders.map(async (sp) => {
      const spBOQs = boqs.filter(boq => 
        boq.serviceProvider && boq.serviceProvider.toString() === sp._id.toString()
      );
      const spOrders = orders.filter(o => 
        o.serviceProvider && o.serviceProvider.toString() === sp._id.toString()
      );
      const totalBOQValue = spBOQs.reduce((sum, boq) => sum + (boq.totalValue || 0), 0);
      const totalSpent = spOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.totalAmount, 0);
      
      // Get suppliers this service provider has worked with
      const supplierIds = [...new Set(spOrders.map(o => o.supplier?._id?.toString()).filter(Boolean))];
      const suppliersWorkedWith = supplierIds.length;
      
      return {
        ...sp.toObject(),
        boqs: spBOQs.map(boq => ({
          name: boq.name,
          description: boq.description,
          itemCount: boq.items?.length || 0,
          totalValue: boq.totalValue || 0,
          status: boq.status,
          createdAt: boq.createdAt
        })),
        orders: spOrders.map(order => ({
          orderNumber: order.orderNumber,
          supplier: order.supplier ? {
            name: order.supplier.name,
            company: order.supplier.company,
            email: order.supplier.email
          } : null,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
          items: order.items?.length || 0
        })),
        totalBOQs: spBOQs.length,
        totalBOQValue: totalBOQValue,
        totalSpent: totalSpent,
        activeOrders: spOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
        completedOrders: spOrders.filter(o => o.status === 'delivered').length,
        activeBOQs: spBOQs.filter(boq => boq.status !== 'completed').length,
        suppliersWorkedWith: suppliersWorkedWith,
        averageOrderValue: spOrders.length > 0 ? totalSpent / spOrders.length : 0
      };
    }));
    
    // Filter out service providers with no activity (0 BOQs, 0 orders, ₹0 spent)
    const serviceProviderData = allServiceProviderData.filter(sp => {
      const hasBOQs = (sp.totalBOQs || 0) > 0;
      const hasOrders = (sp.orders?.length || 0) > 0;
      const hasSpent = (sp.totalSpent || 0) > 0;
      return hasBOQs || hasOrders || hasSpent;
    });

    // Generate transactions from actual orders with populated information
    const transactions = await Promise.all(orders.map(async (order) => {
      // Handle serviceProvider - check if populated or needs manual fetch
      let serviceProviderData = null;
      if (order.serviceProvider) {
        if (typeof order.serviceProvider === 'object' && order.serviceProvider.name) {
          // Already populated
          serviceProviderData = {
            name: order.serviceProvider.name || '',
            company: order.serviceProvider.company || '',
            email: order.serviceProvider.email || ''
          };
        } else if (order.serviceProvider.toString) {
          // Not populated, fetch manually
          try {
            const spId = order.serviceProvider.toString();
            const sp = await User.findById(spId).select('name company email').lean();
            if (sp) {
              serviceProviderData = {
                name: sp.name || '',
                company: sp.company || '',
                email: sp.email || ''
              };
            }
          } catch (err) {
            console.error(`Error populating serviceProvider for order ${order.orderNumber}:`, err.message);
          }
        }
      }
      
      // Handle supplier - check if populated or needs manual fetch
      let supplierData = null;
      if (order.supplier) {
        if (typeof order.supplier === 'object' && order.supplier.name) {
          // Already populated
          supplierData = {
            name: order.supplier.name || '',
            company: order.supplier.company || '',
            email: order.supplier.email || ''
          };
        } else if (order.supplier.toString) {
          // Not populated, fetch manually
          try {
            const supId = order.supplier.toString();
            const sup = await User.findById(supId).select('name company email').lean();
            if (sup) {
              supplierData = {
                name: sup.name || '',
                company: sup.company || '',
                email: sup.email || ''
              };
            }
          } catch (err) {
            console.error(`Error populating supplier for order ${order.orderNumber}:`, err.message);
          }
        }
      }
      
      const itemCount = order.items ? order.items.length : 0;
      const productNames = order.items && order.items.length > 0
        ? order.items.slice(0, 3).map(item => {
            // Try to get product name if populated
            if (item.product && typeof item.product === 'object' && item.product.name) {
              return item.product.name;
            }
            return 'Product';
          }).join(', ') + (itemCount > 3 ? ` +${itemCount - 3} more` : '')
        : 'No items';
      
      return {
        id: order.orderNumber || order._id.toString(),
        orderId: order._id.toString(),
        type: 'order',
        serviceProvider: serviceProviderData,
        supplier: supplierData,
        boq: order.boq ? {
          name: order.boq.name || '',
          description: order.boq.description || ''
        } : null,
        amount: order.totalAmount || 0,
        date: order.createdAt ? order.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        createdAt: order.createdAt || new Date(),
        status: order.status || 'pending',
        paymentStatus: order.paymentStatus || 'pending',
        products: productNames,
        productCount: itemCount,
        items: order.items?.map(item => ({
          product: (item.product && typeof item.product === 'object' && item.product.name) ? item.product.name : 'Product',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || 0
        })) || []
      };
    }));

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate total revenue (sum of completed transactions)
    const totalRevenue = transactions
      .filter(t => t.status === 'delivered')
      .reduce((sum, t) => sum + t.amount, 0);

    // Generate user list with proper formatting (excluding Naina Mahajan)
    const userList = allUsers
      .filter(user => user.name?.toLowerCase() !== 'naina mahajan')
      .map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company || 'Individual',
        userType: user.userType || 'general',
        joinedDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
        status: user.isActive ? 'active' : 'inactive'
      }));

    return {
      stats: {
        totalUsers: allUsers.length,
        serviceProviders: serviceProviderData.length, // Only count service providers with activity
        suppliers: suppliers.length,
        totalTransactions: transactions.length,
        totalRevenue: totalRevenue,
        activeBOQs: boqs.filter(boq => boq.status !== 'completed').length,
        totalProducts: products.length,
        totalInventoryValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0),
        activeOrders: orders.filter(o => o.status !== 'delivered').length,
        totalBOQs: boqs.length
      },
      users: userList,
      transactions: transactions.slice(0, 20),
      supplierData: supplierData,
      serviceProviderData: serviceProviderData,
      products: products,
      boqs: boqs,
      orders: orders
    };
  } catch (error) {
    console.error('Error generating admin data:', error);
    throw error;
  }
};

// Test endpoint to verify admin routes are working
router.get('/test', authenticateToken, isAdmin, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: 'Admin route is working correctly',
      userId: req.userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test endpoint error',
      error: error.message
    });
  }
});

// Diagnostic endpoint to check products
router.get('/products/debug', authenticateToken, isAdmin, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    const approvedProducts = await Product.countDocuments({ status: 'approved' });
    const rejectedProducts = await Product.countDocuments({ status: 'rejected' });
    const nullStatusProducts = await Product.countDocuments({ 
      $or: [
        { status: { $exists: false } },
        { status: null },
        { status: '' }
      ]
    });
    
    const sampleProducts = await Product.find().limit(5).select('name status supplier createdAt');
    
    res.json({
      status: 'success',
      counts: {
        total: totalProducts,
        pending: pendingProducts,
        approved: approvedProducts,
        rejected: rejectedProducts,
        nullOrEmpty: nullStatusProducts
      },
      sampleProducts: sampleProducts.map(p => ({
        name: p.name,
        status: p.status,
        supplier: p.supplier,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    console.error('Products debug error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Debug endpoint error',
      error: error.message
    });
  }
});

// Admin dashboard data
router.get('/dashboard', authenticateToken, isAdmin, async (req, res) => {
  try {
    const adminData = await generateAdminData();
    res.json({
      status: 'success',
      data: adminData
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const userList = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      company: user.company || 'Individual',
      userType: user.userType || 'general',
      joinedDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
      status: user.isActive ? 'active' : 'inactive'
    }));
    
    res.json({ 
      status: 'success',
      users: userList 
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get user details (admin only)
router.get('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }
    
    res.json({ 
      status: 'success',
      user 
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get all transactions (admin only)
router.get('/transactions', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product', 'name category')
      .populate('serviceProvider', 'name company email')
      .populate('supplier', 'name company email')
      .populate('boq', 'name description')
      .sort({ createdAt: -1 });

    const transactions = orders.map(order => {
      const itemCount = order.items ? order.items.length : 0;
      const productNames = order.items && order.items.length > 0
        ? order.items.slice(0, 3).map(item => {
            if (item.product && typeof item.product === 'object') {
              return item.product.name || 'Product';
            }
            return 'Product';
          }).join(', ') + (itemCount > 3 ? ` +${itemCount - 3} more` : '')
        : 'No items';
      
      return {
        id: order.orderNumber || order._id,
        orderId: order._id,
        type: 'order',
        serviceProvider: order.serviceProvider ? {
          name: order.serviceProvider.name,
          company: order.serviceProvider.company,
          email: order.serviceProvider.email
        } : null,
        supplier: order.supplier ? {
          name: order.supplier.name,
          company: order.supplier.company,
          email: order.supplier.email
        } : null,
        boq: order.boq ? {
          name: order.boq.name,
          description: order.boq.description
        } : null,
        amount: order.totalAmount,
        date: order.createdAt.toISOString().split('T')[0],
        createdAt: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        products: productNames,
        productCount: itemCount,
        items: order.items?.map(item => ({
          product: item.product?.name || 'Product',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        })) || []
      };
    });
    
    res.json({ 
      status: 'success',
      transactions 
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get detailed supplier information (admin only)
router.get('/suppliers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const supplier = await User.findById(req.params.id).select('-password');
    
    if (!supplier || supplier.userType !== 'supplier') {
      return res.status(404).json({ 
        status: 'error',
        message: 'Supplier not found' 
      });
    }

    const products = await Product.find({ supplier: req.params.id });
    const orders = await Order.find({ supplier: req.params.id })
      .populate('serviceProvider', 'name company email')
      .populate('items.product', 'name category')
      .sort({ createdAt: -1 });

    const supplierData = {
      ...supplier.toObject(),
      products: products,
      orders: orders,
      stats: {
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0),
        activeOrders: orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
        totalInventoryValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0)
      }
    };
    
    res.json({ 
      status: 'success',
      supplier: supplierData 
    });
  } catch (error) {
    console.error('Get supplier details error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get detailed service provider information (admin only)
router.get('/service-providers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const serviceProvider = await User.findById(req.params.id).select('-password');
    
    if (!serviceProvider || serviceProvider.userType !== 'service_provider') {
      return res.status(404).json({ 
        status: 'error',
        message: 'Service provider not found' 
      });
    }

    const boqs = await BOQ.find({ serviceProvider: req.params.id }).sort({ createdAt: -1 });
    const orders = await Order.find({ serviceProvider: req.params.id })
      .populate('supplier', 'name company email')
      .populate('items.product', 'name category')
      .populate('boq', 'name description')
      .sort({ createdAt: -1 });

    const serviceProviderData = {
      ...serviceProvider.toObject(),
      boqs: boqs,
      orders: orders,
      stats: {
        totalBOQs: boqs.length,
        totalOrders: orders.length,
        totalSpent: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0),
        activeOrders: orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
        activeBOQs: boqs.filter(boq => boq.status !== 'completed').length,
        totalBOQValue: boqs.reduce((sum, boq) => sum + (boq.totalValue || 0), 0)
      }
    };
    
    res.json({ 
      status: 'success',
      serviceProvider: serviceProviderData 
    });
  } catch (error) {
    console.error('Get service provider details error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Update user status (admin only)
router.put('/users/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const isActive = status === 'active';
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: '-password' }
    );
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }
    
    res.json({ 
      status: 'success',
      message: 'User status updated successfully',
      user 
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Update product (admin only)
// Get all products with status filtering (admin only)
// IMPORTANT: This route must be BEFORE /products/:id to avoid route conflicts
router.get('/products/all', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    // First, get ALL products (simple query - no filtering)
    const allProducts = await Product.find()
      .populate('supplier', 'name email company')
      .sort({ createdAt: -1 });
    
    console.log(`📦 Found ${allProducts.length} total products in database`);
    
    // Filter by status in JavaScript (more reliable)
    let products = allProducts;
    if (status && status !== 'all') {
      if (status === 'pending') {
        // Pending: anything that's not approved or rejected
        products = allProducts.filter(p => {
          const s = p.status;
          return !s || s === 'pending' || s === '' || (s !== 'approved' && s !== 'rejected');
        });
        console.log(`📋 Filtered to ${products.length} pending products`);
      } else if (status === 'approved') {
        products = allProducts.filter(p => p.status === 'approved');
        console.log(`✅ Filtered to ${products.length} approved products`);
      } else if (status === 'rejected') {
        products = allProducts.filter(p => p.status === 'rejected');
        console.log(`❌ Filtered to ${products.length} rejected products`);
      }
    }
    
    // Log product statuses for debugging
    if (allProducts.length > 0) {
      const statusCounts = {};
      allProducts.forEach(p => {
        const s = p.status || 'null/undefined';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
      console.log('Product status breakdown:', statusCounts);
    }
    
    res.json({ 
      status: 'success',
      products: products || [],
      count: products ? products.length : 0
    });
  } catch (error) {
    console.error('Get all products error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Return empty array on error so page doesn't break
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      products: [],
      count: 0
    });
  }
});

// Get single product by ID (admin only)
router.get('/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('supplier', 'name email company');
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    res.json({ 
      status: 'success',
      product,
      supplier: product.supplier
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

router.put('/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('📥 [ADMIN UPDATE] Received update request for product:', req.params.id);
    console.log('📥 [ADMIN UPDATE] Request body category:', req.body.category);
    console.log('📥 [ADMIN UPDATE] Request body specifications:', req.body.specifications);
    console.log('📥 [ADMIN UPDATE] Request body specs keys count:', req.body.specifications ? Object.keys(req.body.specifications).length : 0);
    
    // Preserve specifications, including null values (null represents keys that need values)
    const updateData = { ...req.body };
    
    // Ensure specifications object is preserved as-is (including null values)
    if (updateData.specifications && typeof updateData.specifications === 'object') {
      // Keep all keys, even with null values - they represent specification keys that need values
      // Only remove undefined values, but keep null
      Object.keys(updateData.specifications).forEach(key => {
        if (updateData.specifications[key] === undefined) {
          delete updateData.specifications[key];
        }
        // Keep null values - they're placeholders for keys
      });
    }
    
    console.log('📥 [ADMIN UPDATE] After cleanup - updateData.category:', updateData.category);
    console.log('📥 [ADMIN UPDATE] After cleanup - updateData.specifications keys:', updateData.specifications ? Object.keys(updateData.specifications) : 'none');
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    // Ensure specifications are included in response
    const productResponse = product.toObject();
    if (!productResponse.specifications) {
      productResponse.specifications = {};
    }

    console.log('✅ [ADMIN UPDATE] Product saved successfully');
    console.log('✅ [ADMIN UPDATE] Product category:', productResponse.category);
    console.log('✅ [ADMIN UPDATE] Product specifications:', productResponse.specifications);
    console.log('✅ [ADMIN UPDATE] Product specs keys count:', Object.keys(productResponse.specifications).length);
    console.log('✅ [ADMIN UPDATE] Product specs keys:', Object.keys(productResponse.specifications));

    // If admin has set specifications for this product, sync them as
    // default specifications template for this category so suppliers
    // can automatically get these keys when they choose the category.
    try {
      const hasCategory = !!productResponse.category;
      const hasSpecs = !!productResponse.specifications;
      const hasSpecKeys = productResponse.specifications && Object.keys(productResponse.specifications).length > 0;
      
      console.log('🔄 [ADMIN SYNC] Checking sync conditions:');
      console.log('🔄 [ADMIN SYNC] - Has category?', hasCategory);
      console.log('🔄 [ADMIN SYNC] - Has specs object?', hasSpecs);
      console.log('🔄 [ADMIN SYNC] - Has spec keys?', hasSpecKeys);
      
      if (hasCategory && hasSpecs && hasSpecKeys) {
        const categoryName = String(productResponse.category).trim().toLowerCase();
        console.log(`🔄 [ADMIN SYNC] Syncing specs to category: "${categoryName}"`);
        console.log(`📦 [ADMIN SYNC] Product specs:`, productResponse.specifications);
        
        // Find or create the category
        let category = await Category.findOne({ name: categoryName });
        
        if (!category) {
          // Category doesn't exist - create it
          console.log(`⚠️ [ADMIN SYNC] Category "${categoryName}" not found, creating it...`);
          category = await Category.create({
            name: categoryName,
            displayName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
            isActive: true,
            createdBy: req.userId
          });
          console.log(`✅ [ADMIN SYNC] Created category "${categoryName}"`);
        }
        
        // Build template specs from product specifications
        const templateSpecs = {};
        const productSpecKeys = Object.keys(productResponse.specifications || {});
        console.log(`📋 [ADMIN SYNC] Product has ${productSpecKeys.length} specification keys:`, productSpecKeys);
        
        productSpecKeys.forEach((key) => {
          if (key && key.trim() !== '') {
            // Store only the key with null value so each supplier can
            // provide their own values for these admin-defined keys.
            templateSpecs[key] = null;
          }
        });

        // Only update if we actually have some keys
        if (Object.keys(templateSpecs).length > 0) {
          category.defaultSpecifications = templateSpecs;
          await category.save();
          console.log(`✅ [ADMIN SYNC] Updated defaultSpecifications for category "${category.name}"`);
          console.log(`📋 [ADMIN SYNC] Saved template specs:`, JSON.stringify(templateSpecs, null, 2));
          console.log(`🔑 [ADMIN SYNC] Total keys saved: ${Object.keys(templateSpecs).length}`);
          
          // Verify the save worked by fetching fresh from database
          const verifyCategory = await Category.findOne({ name: categoryName }).lean();
          if (verifyCategory && verifyCategory.defaultSpecifications) {
            const verifyKeys = Object.keys(verifyCategory.defaultSpecifications);
            console.log(`✅ [ADMIN SYNC] Verified: Category "${categoryName}" now has ${verifyKeys.length} default specs`);
            console.log(`✅ [ADMIN SYNC] Verified keys:`, verifyKeys);
            console.log(`✅ [ADMIN SYNC] Verified specs object:`, JSON.stringify(verifyCategory.defaultSpecifications, null, 2));
          } else {
            console.error(`❌ [ADMIN SYNC] Verification failed: Category "${categoryName}" defaultSpecifications not found after save`);
            console.error(`❌ [ADMIN SYNC] Verify category object:`, verifyCategory);
          }
        } else {
          console.log(`ℹ️ [ADMIN SYNC] No valid keys to save for category "${categoryName}"`);
          console.log(`ℹ️ [ADMIN SYNC] Product specs keys:`, productSpecKeys);
          console.log(`ℹ️ [ADMIN SYNC] Template specs built:`, templateSpecs);
        }
      } else {
        console.log(`ℹ️ [ADMIN SYNC] Skipping sync - category: ${!!productResponse.category}, specs: ${!!productResponse.specifications}, keys: ${productResponse.specifications ? Object.keys(productResponse.specifications).length : 0}`);
      }
    } catch (syncError) {
      // Do not block the main response if syncing category template fails
      console.error('❌ [ADMIN SYNC] Failed to sync category defaultSpecifications from admin product update:', syncError);
    }
    
    res.json({ 
      status: 'success',
      message: 'Product updated successfully',
      product: productResponse
    });
  } catch (error) {
    console.error('Update product error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        status: 'error',
        message: 'Validation Error',
        errors
      });
    }
    
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Approve product (admin only)
router.post('/products/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy: req.userId,
        approvedAt: new Date(),
        isActive: true,
        rejectionReason: undefined
      },
      { new: true, runValidators: true }
    ).populate('supplier', 'name email');
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    // Create notification for supplier about product approval
    if (product.supplier) {
      await Notification.create({
        user: product.supplier._id,
        type: 'product_approval',
        title: `Product Approved: ${product.name}`,
        message: `Your product "${product.name}" has been approved by admin and is now active in the marketplace.`,
        relatedProduct: product._id,
        metadata: {
          productName: product.name,
          status: 'approved'
        }
      });
      console.log(`Created notification for supplier ${product.supplier._id} about product approval`);
    }
    
    res.json({ 
      status: 'success',
      message: 'Product approved successfully',
      product 
    });
  } catch (error) {
    console.error('Approve product error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Reject product (admin only)
router.post('/products/:id/reject', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        rejectionReason: reason || 'Product rejected by admin',
        isActive: false
      },
      { new: true, runValidators: true }
    ).populate('supplier', 'name email');
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    // Create notification for supplier about product rejection
    if (product.supplier) {
      await Notification.create({
        user: product.supplier._id,
        type: 'product_approval',
        title: `Product Rejected: ${product.name}`,
        message: `Your product "${product.name}" has been rejected by admin. Reason: ${product.rejectionReason || 'No reason provided'}`,
        relatedProduct: product._id,
        metadata: {
          productName: product.name,
          status: 'rejected',
          rejectionReason: product.rejectionReason
        }
      });
      console.log(`Created notification for supplier ${product.supplier._id} about product rejection`);
    }
    
    res.json({ 
      status: 'success',
      message: 'Product rejected successfully',
      product 
    });
  } catch (error) {
    console.error('Reject product error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Delete a rejected product (admin only)
// Safety: only allows deletion if product.status === 'rejected'
router.delete('/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    if ((product.status || 'pending') !== 'rejected') {
      return res.status(400).json({
        status: 'error',
        message: 'Only rejected products can be deleted'
      });
    }

    // Remove notifications referencing this product to avoid broken references
    await Notification.deleteMany({ relatedProduct: product._id });

    await product.deleteOne();

    return res.json({
      status: 'success',
      message: 'Rejected product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get pending products for approval (admin only)
router.get('/products/pending', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Find all products that are NOT approved or rejected
    // This includes products with: 'pending', null, undefined, empty string, or missing status field
    const query = {
      $or: [
        { 
          $and: [
            { status: { $ne: 'approved' } },
            { status: { $ne: 'rejected' } }
          ]
        },
        { status: { $exists: false } },
        { status: null },
        { status: '' }
      ]
    };
    
    const pendingProducts = await Product.find(query)
      .populate('supplier', 'name email company')
      .sort({ createdAt: -1 });
    
    console.log(`📦 Found ${pendingProducts.length} pending products`);
    
    // Log first few products for debugging
    if (pendingProducts.length > 0) {
      console.log('Sample pending products:', pendingProducts.slice(0, 3).map(p => ({
        name: p.name,
        status: p.status,
        supplier: p.supplier?.name || 'Unknown',
        hasSpecifications: !!p.specifications,
        specifications: p.specifications,
        specificationsKeys: p.specifications ? Object.keys(p.specifications) : []
      })));
    }
    
    res.json({ 
      status: 'success',
      products: pendingProducts,
      count: pendingProducts.length
    });
  } catch (error) {
    console.error('Get pending products error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Diagnostic endpoint to check product statuses (admin only)
router.get('/products/status-check', authenticateToken, isAdmin, async (req, res) => {
  try {
    const allProducts = await Product.find().select('name status isActive');
    const statusCounts = {
      approved: 0,
      pending: 0,
      rejected: 0,
      null: 0,
      undefined: 0,
      empty: 0,
      other: 0
    };
    
    allProducts.forEach(product => {
      const status = product.status;
      if (status === 'approved') statusCounts.approved++;
      else if (status === 'pending') statusCounts.pending++;
      else if (status === 'rejected') statusCounts.rejected++;
      else if (status === null) statusCounts.null++;
      else if (status === undefined) statusCounts.undefined++;
      else if (status === '') statusCounts.empty++;
      else statusCounts.other++;
    });
    
    res.json({ 
      status: 'success',
      totalProducts: allProducts.length,
      statusCounts,
      products: allProducts.map(p => ({ name: p.name, status: p.status, isActive: p.isActive }))
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Approve all existing pending products (admin only) - for migrating old products
router.post('/products/approve-all', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Find ALL products that are NOT already approved or rejected
    // This catches: pending, null, undefined, empty string, missing field, or any other value
    const query = {
      $and: [
        { status: { $ne: 'approved' } },
        { status: { $ne: 'rejected' } }
      ]
    };
    
    // Also include products where status doesn't exist
    const queryWithMissing = {
      $or: [
        query,
        { status: { $exists: false } }
      ]
    };

    const pendingProducts = await Product.find(queryWithMissing);
    console.log(`Found ${pendingProducts.length} products to approve`);
    console.log('Product names:', pendingProducts.map(p => p.name));

    if (pendingProducts.length === 0) {
      return res.json({ 
        status: 'success',
        message: 'No pending products found',
        approvedCount: 0
      });
    }

    // Update all pending products to approved
    const result = await Product.updateMany(
      queryWithMissing,
      {
        $set: {
          status: 'approved',
          isActive: true,
          approvedBy: req.userId,
          approvedAt: new Date()
        }
      }
    );

    console.log(`Admin ${req.userId} approved ${result.modifiedCount} existing products`);

    // Verify the update - get recently approved products
    const updatedProducts = await Product.find({
      approvedAt: { $exists: true, $gte: new Date(Date.now() - 60000) } // Approved in last minute
    }).select('name status isActive').limit(10);
    
    console.log('Recently approved products:', updatedProducts.map(p => ({ 
      name: p.name, 
      status: p.status, 
      isActive: p.isActive 
    })));

    res.json({ 
      status: 'success',
      message: `Successfully approved ${result.modifiedCount} product(s)`,
      approvedCount: result.modifiedCount,
      products: updatedProducts
    });
  } catch (error) {
    console.error('Approve all products error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Get admin notifications
router.get('/notifications', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    
    const query = { 
      user: req.userId,
      type: { $in: ['supplier_edit', 'product_update', 'product_approval'] }
    };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .populate('relatedProduct', 'name description category price stock unit location minOrderQuantity specifications status isActive')
      .populate('relatedSupplier', 'name email company')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    const unreadCount = await Notification.countDocuments({ 
      user: req.userId, 
      isRead: false,
      type: { $in: ['supplier_edit', 'product_update', 'product_approval'] }
    });
    
    res.json({ 
      status: 'success',
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateToken, isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Notification not found' 
      });
    }
    
    res.json({ 
      status: 'success',
      message: 'Notification marked as read',
      notification 
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', authenticateToken, isAdmin, async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        user: req.userId, 
        isRead: false,
        type: { $in: ['supplier_edit', 'product_update', 'product_approval'] }
      },
      { isRead: true, readAt: new Date() }
    );
    
    res.json({ 
      status: 'success',
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// AI Fetch endpoint - Fetch product description and attributes from AI platforms (ChatGPT, Gemini, Claude)
// Same as supplier endpoint but for admin use
router.post('/products/ai-enhance', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { productName, category, description, provider = 'auto' } = req.body;
    
    if (!productName) {
      return res.status(400).json({
        status: 'error',
        message: 'Product name is required'
      });
    }

    // Get API keys from environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || claudeApiKey;

    // Debug: Log which API keys are available (without exposing the actual keys)
    console.log('AI API Keys Status:', {
      hasOpenAI: !!openaiApiKey,
      hasGemini: !!geminiApiKey,
      hasClaude: !!anthropicApiKey,
      geminiKeyLength: geminiApiKey ? geminiApiKey.length : 0
    });

    // Determine which provider to use
    let selectedProvider = provider;
    let geminiApiKeyValue = geminiApiKey; // Store for error messages
    if (provider === 'auto') {
      // Auto-select: prioritize Gemini > OpenAI > Claude (Gemini is fast and cost-effective)
      if (geminiApiKey) selectedProvider = 'gemini';
      else if (openaiApiKey) selectedProvider = 'openai';
      else if (anthropicApiKey) selectedProvider = 'claude';
      else {
        return res.status(400).json({
          status: 'error',
          message: 'No AI API keys configured. Please set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in environment variables.'
        });
      }
    }

    // Validate API key for selected provider
    if (selectedProvider === 'openai' && !openaiApiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'OpenAI API key not configured. Please set OPENAI_API_KEY in environment variables.'
      });
    }
    if (selectedProvider === 'gemini' && !geminiApiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Gemini API key not configured. Please set GEMINI_API_KEY in environment variables.'
      });
    }
    if (selectedProvider === 'claude' && !anthropicApiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Claude API key not configured. Please set ANTHROPIC_API_KEY in environment variables.'
      });
    }

    // Initialize fetch
    let fetch;
    try {
      if (typeof globalThis.fetch === 'function') {
        fetch = globalThis.fetch;
      } else {
        const nodeFetch = await import('node-fetch');
        fetch = nodeFetch.default;
      }
    } catch (error) {
      console.error('Failed to load fetch:', error);
      throw new Error('Fetch API not available');
    }
    
    // Common construction material brands by category
    const brandDatabase = {
      cement: ['UltraTech', 'ACC', 'Ambuja', 'Shree Cement', 'Ramco', 'Birla', 'JK Cement', 'Dalmia', 'India Cements', 'Lafarge', 'Heidelberg'],
      steel: ['Tata Steel', 'JSW Steel', 'SAIL', 'Essar Steel', 'Jindal Steel', 'ArcelorMittal', 'Bhushan Steel', 'RINL', 'Vizag Steel', 'Kalyani Steel'],
      iron: ['Tata Steel', 'JSW Steel', 'SAIL', 'Essar Steel', 'Jindal Steel', 'Bhushan Steel', 'RINL', 'Kalyani Steel', 'Godrej', 'Hindalco'],
      bricks: ['Wienerberger', 'Clay Craft', 'Bharat Bricks', 'Magicrete', 'Brickwell', 'Fly Ash Bricks', 'Clay Brick', 'Red Bricks'],
      sand: ['M-Sand', 'River Sand', 'Pit Sand', 'Manufactured Sand', 'Crushed Sand', 'Silica Sand'],
      aggregate: ['Crushed Stone', 'Gravel', 'Coarse Aggregate', 'Fine Aggregate', 'Stone Aggregate'],
      steel_bar: ['Tata Tiscon', 'JSW Neosteel', 'SAIL', 'Kamdhenu', 'Shyam Steel', 'SRMB', 'Prime Gold', 'Meenakshi'],
      tmt: ['Tata Tiscon', 'JSW Neosteel', 'SAIL TMT', 'Kamdhenu', 'Shyam Steel', 'SRMB', 'Prime Gold', 'Meenakshi', 'Vizag TMT'],
      rebar: ['Tata Tiscon', 'JSW Neosteel', 'SAIL', 'Kamdhenu', 'Shyam Steel', 'SRMB', 'Prime Gold'],
      electrical: ['Havells', 'Legrand', 'Schneider Electric', 'Siemens', 'ABB', 'Anchor', 'Polycab', 'Finolex', 'RR Kabel'],
      plumbing: ['Jaguar', 'Parryware', 'Cera', 'Kohler', 'Hindware', 'Roca', 'Jaquar', 'Toto', 'American Standard'],
      hardware: ['Godrej', 'Yale', 'Dormakaba', 'Onida', 'Hafele', 'Blum', 'Hettich', 'Assa Abloy'],
      paint: ['Asian Paints', 'Berger', 'Nerolac', 'Dulux', 'Indigo Paints', 'JSW Paints', 'Kansai Nerolac'],
      tiles: ['Kajaria', 'Somany', 'Hindware', 'Johnson', 'Orient Bell', 'NITCO', 'Regency', 'Rak Ceramics']
    };

    // Get relevant brands for the category
    const categoryLower = (category || '').toLowerCase();
    let relevantBrands = [];
    
    for (const [key, brands] of Object.entries(brandDatabase)) {
      if (categoryLower.includes(key) || key.includes(categoryLower) || 
          productName.toLowerCase().includes(key) || key.includes(productName.toLowerCase())) {
        relevantBrands = [...relevantBrands, ...brands];
      }
    }
    
    if (relevantBrands.length === 0) {
      relevantBrands = [
        ...brandDatabase.cement,
        ...brandDatabase.steel,
        ...brandDatabase.iron,
        ...brandDatabase.electrical,
        ...brandDatabase.plumbing
      ];
    }
    
    const brandsList = [...new Set(relevantBrands)].slice(0, 15).join(', ');

    // Validate category and description match
    let categoryMismatchWarning = null;
    if (category && description && description.trim().length > 0) {
      const categoryLower = (category || '').trim().toLowerCase();
      const descriptionLower = (description || '').trim().toLowerCase();
      
      // Common category keywords
      const categoryKeywords = {
        'cement': ['cement', 'concrete', 'portland', 'opc', 'ppc', 'pcc'],
        'steel': ['steel', 'iron', 'metal', 'alloy', 'carbon steel', 'stainless'],
        'iron': ['iron', 'steel', 'metal', 'cast iron', 'wrought iron'],
        'bricks': ['brick', 'clay', 'fly ash', 'red brick', 'hollow brick'],
        'sand': ['sand', 'm-sand', 'river sand', 'silica'],
        'aggregate': ['aggregate', 'gravel', 'stone', 'crushed stone'],
        'tiles': ['tile', 'ceramic', 'vitrified', 'porcelain'],
        'paint': ['paint', 'coating', 'primer', 'enamel'],
        'electrical': ['electrical', 'wire', 'cable', 'switch', 'socket', 'fixture'],
        'plumbing': ['plumbing', 'pipe', 'faucet', 'tap', 'fixture', 'fitting']
      };
      
      // Get keywords for the category
      const keywords = categoryKeywords[categoryLower] || [categoryLower];
      
      // Check if description contains category-related keywords
      const hasCategoryMatch = keywords.some(keyword => descriptionLower.includes(keyword));
      
      // Also check if description mentions other categories (mismatch)
      const otherCategories = Object.keys(categoryKeywords).filter(cat => cat !== categoryLower);
      const mentionsOtherCategory = otherCategories.some(cat => {
        const otherKeywords = categoryKeywords[cat] || [cat];
        return otherKeywords.some(keyword => descriptionLower.includes(keyword));
      });
      
      if (!hasCategoryMatch && mentionsOtherCategory) {
        categoryMismatchWarning = `Warning: The category "${category}" does not match the description. The description seems to be about a different category. Please verify that the category and description are aligned.`;
        console.log('⚠️ [CATEGORY MISMATCH]', categoryMismatchWarning);
      } else if (!hasCategoryMatch) {
        categoryMismatchWarning = `Warning: The category "${category}" may not match the description. Please verify that the category and description are aligned.`;
        console.log('⚠️ [CATEGORY MISMATCH]', categoryMismatchWarning);
      }
    }

    // Build a prompt that returns structured specifications (key-value pairs)
    // Like Gemini Chat - return specifications in a structured format
    let prompt;
    
    // Extract number from description if user specified one (e.g., "top 10", "best 10", "first 10")
    // Only extract if it's in specific contexts like "top X", "best X", "first X", etc.
    let requestedCount = null;
    if (description && description.trim().length > 0) {
      // Look for patterns like "top 10", "best 10", "first 10", "only 10", "exactly 10"
      // Case-insensitive matching
      const patterns = [
        /\b(top|best|first|only|exactly|just|give|provide|extract|show|list|generate|create)\s+(\d+)\b/i,
        /\b(\d+)\s+(specifications?|specs?|keys?|items?|fields?|attributes?)\b/i
      ];
      
      let numberMatch = null;
      let matchedPattern = null;
      for (const pattern of patterns) {
        numberMatch = description.match(pattern);
        if (numberMatch) {
          matchedPattern = numberMatch[0];
          // Extract the number (could be in group 1 or 2 depending on pattern)
          const numberStr = numberMatch[2] || numberMatch[1];
          requestedCount = parseInt(numberStr, 10);
          console.log(`🔍 Found number "${numberStr}" in description pattern "${matchedPattern}", parsed as: ${requestedCount}`);
          break; // Use first match found
        }
      }
      
      // If no specific pattern found, don't extract any number
      // This ensures we only use numbers when explicitly requested with keywords
      if (requestedCount !== null) {
        // Limit to reasonable range (1-20)
        if (requestedCount > 0 && requestedCount <= 20) {
          console.log(`✅ User requested exactly ${requestedCount} specification keys (detected from: "${matchedPattern}")`);
        } else {
          console.log(`⚠️  Number ${requestedCount} is out of range (1-20), ignoring...`);
          requestedCount = null; // Ignore if out of range
        }
      } else {
        console.log(`ℹ️  No number found in description with keywords like "top X", "best X", "first X", "X specifications": "${description.substring(0, 100)}..."`);
      }
    }
    
    // Default to 10 if no specific number requested
    const keyCount = requestedCount || 10;
    const countText = requestedCount ? `EXACTLY ${keyCount}` : `${keyCount}`;

    if (description && description.trim().length > 0) {
      // Check if user specified a number - if so, use it; otherwise use product name, category, and description
      if (requestedCount) {
        prompt = `You are generating specification keys for an ecommerce product page.

Product Name: ${productName}
Product Category: ${category || 'Not specified'}
Product Description: ${description}

CRITICAL: You MUST generate EXACTLY ${keyCount} specification keys. NOT ${keyCount + 1}, NOT ${keyCount - 1}, NOT ${keyCount + 2}. EXACTLY ${keyCount}.

Use BOTH the category "${category || 'Not specified'}" AND the description to determine the most relevant specification keys.

ABSOLUTE REQUIREMENTS:
1. Generate EXACTLY ${keyCount} specification keys - NO MORE, NO LESS
2. Generate specification KEY NAMES only (e.g., "Material Grade", "Core Dimensions", "Weight", "Tensile Strength")
3. All values must be null - we only want the key names
4. Use proper, professional specification key names relevant to this product type
5. Consider BOTH the category "${category || 'Not specified'}" AND the description when generating keys
6. Return keys that would be appropriate for an ecommerce product page
7. No descriptions, no explanations, no examples, no additional text
8. COUNT YOUR KEYS BEFORE RETURNING: The specifications object MUST have exactly ${keyCount} keys

Return ONLY this JSON structure with EXACTLY ${keyCount} keys (count them!):
{
  "specifications": {
    "Key 1": null,
    "Key 2": null,
    "Key 3": null,
    ...
    "Key ${keyCount}": null
  }
}

VERIFICATION: Before returning, count the keys in your specifications object. It must be exactly ${keyCount}. If you have more than ${keyCount}, remove the extras. If you have fewer than ${keyCount}, add more. The final count MUST be ${keyCount}.`;
      } else {
        // No specific number requested - use default behavior with category and description
        prompt = `You are generating specification keys for an ecommerce product page.

Product Name: ${productName}
Product Category: ${category || 'Not specified'}
Product Description: ${description}

IMPORTANT: Generate the top ${keyCount} core specification KEY NAMES ONLY for this product.
Use BOTH the category "${category || 'Not specified'}" AND the description to determine the most relevant specification keys.

CRITICAL REQUIREMENTS:
1. Generate specification KEY NAMES only (e.g., "Material Grade", "Core Dimensions", "Weight", "Tensile Strength")
2. All values must be null - we only want the key names
3. Use proper, professional specification key names relevant to this product type
4. Consider BOTH the category "${category || 'Not specified'}" AND the description when generating keys
5. Return keys that would be appropriate for an ecommerce product page
6. No descriptions, no explanations, no examples, no additional text

Return ONLY this JSON structure:
{
  "specifications": {
    "Material Grade": null,
    "Core Dimensions": null,
    "Weight": null,
    "Tensile Strength": null,
    "Thermal Conductivity": null,
    "Coating/Finish": null,
    "Corrosion Resistance": null,
    "Heat Treatment": null,
    "Magnetic Permeability": null,
    "Tolerance Levels": null
  }
}

Remember: Generate keys based on BOTH the category "${category || 'Not specified'}" AND the description provided.`;
      }
    } else {
      // No description - generate specification keys from product name and category only
      prompt = `Product Name: ${productName}
Category: ${category || 'Not specified'}

Based ONLY on the product name "${productName}" and category "${category || 'Not specified'}", generate the top ${keyCount} core specification KEY NAMES ONLY for this product type.

CRITICAL RULES:
1. Use ONLY the product name and category
2. Generate specification KEY NAMES only (like "Material Grade", "Core Dimensions", "Weight")
3. Do NOT generate values - only return the key names
4. Return keys with null values (we only want the key names)
5. Use proper specification key names relevant to this product type
6. No descriptions, no explanations, no examples, no additional text

Return ONLY a valid JSON object:
{
  "specifications": {
    "Material Grade": null,
    "Core Dimensions": null,
    "Weight": null,
    "Tensile Strength": null,
    "Thermal Conductivity": null,
    "Coating/Finish": null,
    "Corrosion Resistance": null,
    "Heat Treatment": null,
    "Magnetic Permeability": null,
    "Tolerance Levels": null
  }
}

IMPORTANT: Return ONLY the JSON object with specification key names (all values should be null).`;
    }

    let aiResponse;
    let result;

    // Call the appropriate AI provider
    if (selectedProvider === 'openai') {
      // OpenAI/ChatGPT API
      const openaiUrl = 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates product descriptions for construction materials. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error('OpenAI API service unavailable');
      }

      const data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content?.trim();
      
      if (!aiResponse) {
        throw new Error('No response from OpenAI API');
      }

    } else if (selectedProvider === 'gemini') {
      // Google Gemini API
      // Validate API key format (Gemini keys typically start with "AIza")
      if (!geminiApiKey || geminiApiKey.trim().length === 0) {
        throw new Error('GEMINI_API_KEY is empty or invalid');
      }
      
      if (!geminiApiKey.startsWith('AIza') && geminiApiKey.length < 20) {
        console.warn('Warning: Gemini API key format may be incorrect. Expected format: AIza...');
      }
      
      // First, try to list available models to see what's actually available
      let availableModels = [];
      try {
        // Try both v1 and v1beta endpoints for listing models
        const listModelsUrls = [
          `https://generativelanguage.googleapis.com/v1/models?key=${geminiApiKey}`,
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`
        ];
        
        for (const listModelsUrl of listModelsUrls) {
          try {
            const listResponse = await fetch(listModelsUrl);
            if (listResponse.ok) {
              const listData = await listResponse.json();
              console.log('ListModels response:', JSON.stringify(listData, null, 2));
              
              if (listData.models && Array.isArray(listData.models)) {
                availableModels = listData.models
                  .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                  .map(m => {
                    // Extract just the model name (remove 'models/' prefix if present)
                    const name = m.name || '';
                    return name.replace('models/', '');
                  })
                  .filter(name => name && name.includes('gemini'));
                
                if (availableModels.length > 0) {
                  console.log('✅ Found available Gemini models:', availableModels);
                  break; // Found models, stop trying other endpoints
                }
              }
            } else {
              const errorText = await listResponse.text();
              console.log(`ListModels failed for ${listModelsUrl}:`, errorText);
            }
          } catch (e) {
            console.warn(`ListModels error for ${listModelsUrl}:`, e.message);
          }
        }
        
        if (availableModels.length === 0) {
          console.warn('⚠️  No models found via ListModels, will try common model names');
        }
      } catch (e) {
        console.warn('Could not list available models, using defaults:', e.message);
      }
      
      // Try multiple Gemini models in order of preference
      // Based on Google's documentation, try different API versions and model names
      // Note: Some API keys work with different endpoints
      const geminiModels = [
        // Try Google AI Studio format first (most common for free API keys)
        { name: 'gemini-pro', apiVersion: 'v1beta', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' },
        { name: 'gemini-1.5-flash', apiVersion: 'v1beta', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' },
        { name: 'gemini-1.5-pro', apiVersion: 'v1beta', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' },
        // Try with explicit models/ prefix
        { name: 'models/gemini-pro', apiVersion: 'v1beta', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' },
        { name: 'models/gemini-1.5-flash', apiVersion: 'v1beta', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' },
        // Try v1 API
        { name: 'gemini-pro', apiVersion: 'v1', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' },
        { name: 'gemini-1.5-flash', apiVersion: 'v1', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' }
      ];
      
      // If we got available models, prioritize those
      if (availableModels.length > 0) {
        // Prepend available models to the list
        const prioritizedModels = availableModels.map(name => {
          // Extract model name and determine API version
          const parts = name.split('/');
          const modelName = parts[parts.length - 1];
          return { name: modelName, apiVersion: 'v1beta', useRestFormat: false, baseUrl: 'https://generativelanguage.googleapis.com' };
        });
        geminiModels.unshift(...prioritizedModels);
      }
      
      let lastError = null;
      
      for (const { name: geminiModel, apiVersion, useRestFormat, baseUrl } of geminiModels) {
        try {
          // Try different URL formats
          let geminiUrl;
          const base = baseUrl || 'https://generativelanguage.googleapis.com';
          
          if (useRestFormat) {
            // REST API format: https://generativelanguage.googleapis.com/v1/{model}:generateContent
            geminiUrl = `${base}/${apiVersion}/${geminiModel}:generateContent?key=${geminiApiKey}`;
          } else if (geminiModel.startsWith('models/')) {
            // Model name already includes 'models/' prefix
            geminiUrl = `${base}/${apiVersion}/${geminiModel}:generateContent?key=${geminiApiKey}`;
          } else {
            // Standard format: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
            geminiUrl = `${base}/${apiVersion}/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
          }
          console.log(`Trying Gemini API: ${geminiUrl.replace(geminiApiKey, '***KEY***')}`);
          
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: 0.8,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2000  // Increased for more detailed responses like Gemini Chat
              }
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            let errorMessage = 'Gemini API service unavailable';
            try {
              const errorJson = JSON.parse(errorData);
              errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
              console.error(`Gemini API error for ${geminiModel} (${apiVersion}):`, errorJson);
              lastError = new Error(`Gemini API error (${geminiModel}): ${errorMessage}`);
            } catch (e) {
              console.error(`Gemini API error (raw) for ${geminiModel}:`, errorData);
              lastError = new Error(`Gemini API error (${geminiModel}): ${errorData}`);
            }
            // Try next model
            continue;
          }

          const data = await response.json();
          aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
          if (!aiResponse) {
            console.error(`Gemini API response structure for ${geminiModel}:`, JSON.stringify(data, null, 2));
            lastError = new Error(`No response from Gemini API (${geminiModel}) - check API key validity`);
            // Try next model
            continue;
          }
          
          // Success! Break out of the loop
          console.log(`✅ Successfully used Gemini model: ${geminiModel} (${apiVersion}, format: ${useRestFormat ? 'REST' : 'standard'})`);
          break;
        } catch (fetchError) {
          console.error(`Error with Gemini model ${geminiModel}:`, fetchError.message);
          lastError = fetchError;
          // Try next model
          continue;
        }
      }
      
      // If we've tried all models and still no response, throw the last error
      if (!aiResponse) {
        const errorMsg = lastError 
          ? `All Gemini models failed. Last error: ${lastError.message}. Please verify your GEMINI_API_KEY is valid and has access to Gemini models. You can get a new key from https://makersuite.google.com/app/apikey`
          : 'All Gemini models failed. Please check your API key and try again.';
        throw new Error(errorMsg);
      }

    } else if (selectedProvider === 'claude') {
      // Anthropic Claude API
      const claudeUrl = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(claudeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Claude API error:', errorData);
        throw new Error('Claude API service unavailable');
      }

      const data = await response.json();
      aiResponse = data.content?.[0]?.text?.trim();
      
      if (!aiResponse) {
        throw new Error('No response from Claude API');
      }
    }

    console.log(`${selectedProvider.toUpperCase()} raw response:`, aiResponse);
    
    // Parse the JSON response from AI
    try {
      // If user requested a specific count, we'll enforce it after parsing
      // Remove markdown code blocks if present
      let cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      result = JSON.parse(cleanedResponse);
      console.log('✅ Parsed AI result:', result);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw AI response:', aiResponse);
      
      // Fallback: use the raw response as description
      result = {
        enhancedDescription: aiResponse,
        extractedAttributes: {
          grade: null,
          brand: null,
          dimensions: null,
          weight: null,
          color: null,
          material: null,
          certification: []
        },
        specifications: {}
      };
      
      console.log('⚠️  Using raw response as description (JSON parsing failed)');
    }

    // Extract specifications (key-value pairs) from the result
    let specifications = result.specifications || {};
    
    // If user requested a specific count, enforce it STRICTLY
    if (requestedCount && requestedCount > 0) {
      // Get all keys, filtering out any invalid entries
      const specKeys = Object.keys(specifications).filter(key => {
        // Only include valid keys (non-empty strings)
        return key && typeof key === 'string' && key.trim().length > 0;
      });
      
      const actualCount = specKeys.length;
      
      if (actualCount > requestedCount) {
        console.log(`⚠️  AI returned ${actualCount} keys, but user requested exactly ${requestedCount}. Trimming to ${requestedCount}.`);
        // Keep only the first N keys - STRICTLY enforce the count
        const trimmedSpecs = {};
        specKeys.slice(0, requestedCount).forEach(key => {
          trimmedSpecs[key] = specifications[key];
        });
        specifications = trimmedSpecs;
        
        // Verify the count after trimming
        const finalCount = Object.keys(specifications).length;
        if (finalCount !== requestedCount) {
          console.warn(`⚠️  After trimming, got ${finalCount} keys instead of ${requestedCount}. Re-trimming...`);
          // Force trim again if needed
          const finalSpecs = {};
          Object.keys(specifications).slice(0, requestedCount).forEach(key => {
            finalSpecs[key] = specifications[key];
          });
          specifications = finalSpecs;
        }
        
        console.log(`✅ Trimmed to exactly ${requestedCount} specification keys`);
      } else if (actualCount < requestedCount) {
        console.log(`⚠️  AI returned only ${actualCount} keys, but user requested ${requestedCount}. Keeping all available keys.`);
      } else {
        console.log(`✅ AI returned exactly ${requestedCount} keys as requested.`);
      }
      
      // Final verification - ensure we never return more than requested
      const finalKeyCount = Object.keys(specifications).length;
      if (finalKeyCount > requestedCount) {
        console.error(`❌ ERROR: Still have ${finalKeyCount} keys after trimming. Force trimming to ${requestedCount}...`);
        const forceTrimmed = {};
        Object.keys(specifications).slice(0, requestedCount).forEach(key => {
          forceTrimmed[key] = specifications[key];
        });
        specifications = forceTrimmed;
        console.log(`✅ Force trimmed to exactly ${Object.keys(specifications).length} keys`);
      }
    }
    
    // Use description from user input or result, but prioritize specifications
    const finalDescription = description || result.enhancedDescription || result.description || '';
    
    res.json({
      status: 'success',
      enhancedDescription: finalDescription,
      extractedAttributes: result.extractedAttributes || {
        grade: null,
        brand: null,
        dimensions: null,
        weight: null,
        color: null,
        material: null,
        certification: []
      },
      specifications: specifications,
      provider: selectedProvider,
      categoryMismatchWarning: categoryMismatchWarning || null
    });
  } catch (error) {
    console.error('AI fetch error:', error);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Failed to fetch data from AI service. Please try again.';
    
    if (error.message.includes('API key')) {
      errorMessage = 'Invalid or missing API key. Please check your API keys in the .env file.';
    } else if (error.message.includes('Gemini API error')) {
      errorMessage = error.message;
    } else if (error.message.includes('No response')) {
      errorMessage = 'AI service returned no response. Please check your API key and try again.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Network error connecting to AI service. Please check your internet connection.';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    res.status(500).json({
      status: 'error',
      message: errorMessage,
      provider: 'unknown'
    });
  }
});

export { router as adminRouter, ADMIN_CREDENTIALS };