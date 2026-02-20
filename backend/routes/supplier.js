import express from 'express';
import { authenticateToken } from './auth.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import Category from '../models/Category.js';
import Unit from '../models/Unit.js';
import User from '../models/User.js';

const router = express.Router();

// Check if supplier has completed initial setup (has at least one product)
router.get('/setup-status', authenticateToken, async (req, res) => {
  try {
    const productCount = await Product.countDocuments({ supplier: req.userId });
    res.json({ 
      status: 'success',
      hasProducts: productCount > 0,
      productCount
    });
  } catch (error) {
    console.error('Get setup status error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get all products for a supplier (including pending, approved, and rejected)
router.get('/products', authenticateToken, async (req, res) => {
  try {
    // Suppliers can see all their products regardless of status
    const products = await Product.find({ supplier: req.userId })
      .sort({ createdAt: -1 }); // Show newest first
    res.json({ 
      status: 'success',
      products 
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Search for product name suggestions (autocomplete)
router.get('/products/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({
        status: 'success',
        suggestions: []
      });
    }

    const queryLower = q.trim().toLowerCase();
    
    // First, try to find products that start with the query (highest priority)
    // Only show approved products in search suggestions
    const startsWithProducts = await Product.find({
      name: { $regex: new RegExp(`^${queryLower}`, 'i') },
      isActive: true,
      status: 'approved'
    })
    .select('name category')
    .limit(15)
    .lean();

    // Then, find products that contain the query anywhere in the name
    // Only show approved products in search suggestions
    const containsProducts = await Product.find({
      name: { $regex: new RegExp(queryLower, 'i') },
      isActive: true,
      status: 'approved'
    })
    .select('name category')
    .limit(15)
    .lean();

    // Combine and deduplicate (prioritize startsWith)
    const uniqueNames = new Set();
    const result = [];
    
    // Add products that start with the query first
    for (const product of startsWithProducts) {
      const lowerName = product.name.toLowerCase();
      if (!uniqueNames.has(lowerName)) {
        uniqueNames.add(lowerName);
        result.push({
          name: product.name,
          category: product.category
        });
      }
    }
    
    // Then add products that contain the query (if we don't have enough)
    if (result.length < 10) {
      for (const product of containsProducts) {
        const lowerName = product.name.toLowerCase();
        if (!uniqueNames.has(lowerName)) {
          uniqueNames.add(lowerName);
          result.push({
            name: product.name,
            category: product.category
          });
          // Stop when we have at least 10 suggestions
          if (result.length >= 10) {
            break;
          }
        }
      }
    }

    // Ensure we return at least 3 suggestions if available, up to 10
    const finalSuggestions = result.slice(0, 10);
    
    console.log(`Product search for "${q}": Found ${finalSuggestions.length} suggestions`);

    res.json({
      status: 'success',
      suggestions: finalSuggestions
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get all categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .select('name displayName defaultSpecifications')
      .lean();
    
    res.json({ 
      status: 'success',
      categories 
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get default specifications for a given category (for supplier auto-fill)
// IMPORTANT: This endpoint ONLY uses category name - product name is completely ignored
// Returns admin-defined defaultSpecifications for the category, regardless of product name
router.get('/categories/:name/specifications', authenticateToken, async (req, res) => {
  try {
    const rawName = req.params.name || '';
    const categoryName = rawName.trim().toLowerCase();

    console.log(`🔍 [GET SPECS] Request for category: "${rawName}" -> normalized: "${categoryName}" (product name not used)`);

    if (!categoryName) {
      return res.status(400).json({
        status: 'error',
        message: 'Category name is required'
      });
    }

    // Find category - try exact match first, then case-insensitive
    let category = await Category.findOne({ name: categoryName })
      .select('name displayName defaultSpecifications')
      .lean();

    if (!category) {
      // Try case-insensitive search as fallback
      const allCategories = await Category.find({ isActive: true })
        .select('name displayName defaultSpecifications')
        .lean();
      
      category = allCategories.find(cat => cat.name.toLowerCase() === categoryName);
      
      if (!category) {
        console.log(`❌ [GET SPECS] Category "${categoryName}" not found in database`);
        console.log(`📋 [GET SPECS] Available categories:`, allCategories.map(c => c.name));
        return res.status(404).json({
          status: 'error',
          message: 'Category not found'
        });
      }
    }

    console.log(`✅ [GET SPECS] Category "${categoryName}" found. Category name in DB: "${category.name}"`);
    console.log(`📦 [GET SPECS] Raw defaultSpecifications:`, category.defaultSpecifications);
    console.log(`📦 [GET SPECS] defaultSpecifications type:`, typeof category.defaultSpecifications);
    console.log(`📦 [GET SPECS] defaultSpecifications is null?`, category.defaultSpecifications === null);
    console.log(`📦 [GET SPECS] defaultSpecifications is undefined?`, category.defaultSpecifications === undefined);

    // Ensure we return an empty object if defaultSpecifications is null, undefined, or empty
    let specs = {};
    if (category.defaultSpecifications && 
        typeof category.defaultSpecifications === 'object' && 
        !Array.isArray(category.defaultSpecifications)) {
      const specKeys = Object.keys(category.defaultSpecifications);
      console.log(`🔑 [GET SPECS] Found ${specKeys.length} specification keys:`, specKeys);
      console.log(`🔑 [GET SPECS] Full defaultSpecifications object:`, JSON.stringify(category.defaultSpecifications, null, 2));
      
      if (specKeys.length > 0) {
        specs = category.defaultSpecifications;
        console.log(`✅ [GET SPECS] Returning ${specKeys.length} specification keys`);
      } else {
        console.log(`ℹ️ [GET SPECS] defaultSpecifications is an empty object (no keys)`);
      }
    } else {
      console.log(`ℹ️ [GET SPECS] defaultSpecifications is null/undefined or invalid type`);
      console.log(`ℹ️ [GET SPECS] Value:`, category.defaultSpecifications);
    }

    console.log(`📋 [GET SPECS] Final specs being returned:`, JSON.stringify(specs, null, 2));
    console.log(`📋 [GET SPECS] Final specs keys count:`, Object.keys(specs).length);

    return res.json({
      status: 'success',
      category: {
        name: category.name,
        displayName: category.displayName || category.name
      },
      specifications: specs
    });
  } catch (error) {
    console.error('❌ [GET SPECS] Get category specifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Create or get category
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, displayName } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Category name is required'
      });
    }
    
    const categoryName = name.trim().toLowerCase();
    
    // Check if category already exists
    let category = await Category.findOne({ name: categoryName });
    
    if (!category) {
      category = await Category.create({
        name: categoryName,
        displayName: displayName || name.trim(),
        createdBy: req.userId
      });
    } else if (!category.isActive) {
      // Reactivate if it was deactivated
      category.isActive = true;
      await category.save();
    }
    
    res.json({ 
      status: 'success',
      message: 'Category processed successfully',
      category 
    });
  } catch (error) {
    console.error('Create category error:', error);
    
    if (error.code === 11000) {
      // Duplicate key error
      const category = await Category.findOne({ name: req.body.name.trim().toLowerCase() });
      return res.json({ 
        status: 'success',
        message: 'Category already exists',
        category 
      });
    }
    
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get all units
router.get('/units', authenticateToken, async (req, res) => {
  try {
    const units = await Unit.find({ isActive: true })
      .sort({ name: 1 })
      .select('name displayName')
      .lean();
    
    res.json({ 
      status: 'success',
      units 
    });
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Create or get unit
router.post('/units', authenticateToken, async (req, res) => {
  try {
    const { name, displayName } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Unit name is required'
      });
    }
    
    const unitName = name.trim().toLowerCase();
    
    // Check if unit already exists
    let unit = await Unit.findOne({ name: unitName });
    
    if (!unit) {
      unit = await Unit.create({
        name: unitName,
        displayName: displayName || name.trim(),
        createdBy: req.userId
      });
    } else if (!unit.isActive) {
      // Reactivate if it was deactivated
      unit.isActive = true;
      await unit.save();
    }
    
    res.json({ 
      status: 'success',
      message: 'Unit processed successfully',
      unit 
    });
  } catch (error) {
    console.error('Create unit error:', error);
    
    if (error.code === 11000) {
      // Duplicate key error
      const unit = await Unit.findOne({ name: req.body.name.trim().toLowerCase() });
      return res.json({ 
        status: 'success',
        message: 'Unit already exists',
        unit 
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Add new product
router.post('/products', authenticateToken, async (req, res) => {
  try {
    const { category, unit, ...otherData } = req.body;
    
    // Ensure category exists (create if it doesn't)
    let categoryName = category?.trim().toLowerCase();
    if (categoryName) {
      let categoryDoc = await Category.findOne({ name: categoryName });
      if (!categoryDoc) {
        categoryDoc = await Category.create({
          name: categoryName,
          displayName: category.trim(),
          createdBy: req.userId
        });
      }
    }
    
    // Ensure unit exists (create if it doesn't)
    let unitName = unit?.trim().toLowerCase();
    if (unitName) {
      let unitDoc = await Unit.findOne({ name: unitName });
      if (!unitDoc) {
        unitDoc = await Unit.create({
          name: unitName,
          displayName: unit.trim(),
          createdBy: req.userId
        });
      }
    }
    
    const productData = {
      ...otherData,
      category: categoryName,
      unit: unitName,
      supplier: req.userId,
      status: 'pending', // New products require admin approval
      isActive: false // Products are inactive until approved
    };
    
    console.log(`📦 Creating product with status: ${productData.status}, isActive: ${productData.isActive}`);
    console.log(`📦 Product data includes specifications:`, !!productData.specifications);
    if (productData.specifications) {
      console.log(`📦 Specifications keys:`, Object.keys(productData.specifications));
      console.log(`📦 Specifications:`, productData.specifications);
    }
    const newProduct = await Product.create(productData);
    console.log(`✅ Product created successfully:`);
    console.log(`   - Name: ${newProduct.name}`);
    console.log(`   - ID: ${newProduct._id}`);
    console.log(`   - Status: ${newProduct.status}`);
    console.log(`   - IsActive: ${newProduct.isActive}`);
    console.log(`   - Supplier: ${newProduct.supplier}`);
    console.log(`   - Category: ${newProduct.category}`);
    console.log(`   - Price: ${newProduct.price}`);
    console.log(`   - Specifications:`, newProduct.specifications);
    console.log(`   - Specifications keys:`, newProduct.specifications ? Object.keys(newProduct.specifications) : 'none');
    
    // Verify the product was saved correctly
    const verifyProduct = await Product.findById(newProduct._id);
    if (verifyProduct) {
      console.log(`✅ Verified product exists in database with status: ${verifyProduct.status}`);
    } else {
      console.error(`❌ ERROR: Product was not found in database after creation!`);
    }
    
    // Get supplier info for notification
    const supplier = await User.findById(req.userId).select('name email company');
    
    // Create notification for all admins about new product
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tatvadirect.com';
    const admins = await User.find({
      $or: [
        { email: adminEmail.toLowerCase() },
        { userType: 'admin' }
      ]
    }).select('_id');
    
    const notifications = admins.map(admin => ({
      user: admin._id,
      type: 'product_approval',
      title: `New Product Pending Approval: ${newProduct.name}`,
      message: `${supplier.name} (${supplier.company || supplier.email}) has added a new product "${newProduct.name}" that requires your approval.`,
      relatedProduct: newProduct._id,
      relatedSupplier: supplier._id,
      metadata: {
        productName: newProduct.name,
        productDescription: newProduct.description,
        productCategory: newProduct.category,
        productPrice: newProduct.price,
        productUnit: newProduct.unit,
        productStock: newProduct.stock,
        productLocation: newProduct.location,
        productMinOrderQuantity: newProduct.minOrderQuantity,
        productSpecifications: newProduct.specifications,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        supplierCompany: supplier.company,
        productId: newProduct._id.toString()
      }
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} admin notification(s) for new product`);
    }
    
    res.status(201).json({ 
      status: 'success',
      message: 'Product added successfully and is pending admin approval',
      product: newProduct 
    });
  } catch (error) {
    console.error('Add product error:', error);
    
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

// Update product
router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    // Get the old product data before updating
    const oldProduct = await Product.findById(req.params.id);
    
    if (!oldProduct || oldProduct.supplier.toString() !== req.userId.toString()) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    // Log the update request to verify location is being updated
    console.log(`Updating product ${req.params.id} with data:`, {
      location: req.body.location,
      price: req.body.price,
      stock: req.body.stock,
      name: req.body.name
    });
    
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, supplier: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    // Get supplier info
    const supplier = await User.findById(req.userId).select('name email company');
    
    // Track what changed
    const changes = [];
    if (oldProduct.name !== product.name) {
      changes.push(`Name: "${oldProduct.name}" → "${product.name}"`);
    }
    if (oldProduct.price !== product.price) {
      changes.push(`Price: ₹${oldProduct.price} → ₹${product.price}`);
    }
    if (oldProduct.stock !== product.stock) {
      changes.push(`Stock: ${oldProduct.stock} → ${product.stock}`);
    }
    if (oldProduct.category !== product.category) {
      changes.push(`Category: "${oldProduct.category}" → "${product.category}"`);
    }
    if (oldProduct.unit !== product.unit) {
      changes.push(`Unit: "${oldProduct.unit}" → "${product.unit}"`);
    }
    if (oldProduct.location !== product.location) {
      changes.push(`Location: "${oldProduct.location}" → "${product.location}"`);
    }
    if (oldProduct.description !== product.description) {
      changes.push(`Description updated`);
    }
    
    // Create notifications for all admins if there are changes
    if (changes.length > 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@tatvadirect.com';
      const admins = await User.find({
        $or: [
          { email: adminEmail.toLowerCase() },
          { userType: 'admin' }
        ]
      }).select('_id');
      
      const notifications = admins.map(admin => ({
        user: admin._id,
        type: 'supplier_edit',
        title: `Supplier Edited Product: ${product.name}`,
        message: `${supplier.name} (${supplier.company || supplier.email}) edited product "${product.name}". Changes: ${changes.join(', ')}`,
        relatedProduct: product._id,
        relatedSupplier: supplier._id,
        metadata: {
          productName: product.name,
          supplierName: supplier.name,
          supplierEmail: supplier.email,
          supplierCompany: supplier.company,
          changes: changes,
          oldData: {
            name: oldProduct.name,
            price: oldProduct.price,
            stock: oldProduct.stock,
            category: oldProduct.category,
            unit: oldProduct.unit,
            location: oldProduct.location
          },
          newData: {
            name: product.name,
            price: product.price,
            stock: product.stock,
            category: product.category,
            unit: product.unit,
            location: product.location
          }
        }
      }));
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        console.log(`Created ${notifications.length} admin notification(s) for product edit`);
      }
    }
    
    // Log the updated product to verify location was saved
    console.log(`Product ${product._id} updated successfully. New location: "${product.location}", UpdatedAt: ${product.updatedAt}`);
    
    // Ensure specifications are included in response
    const productResponse = product.toObject();
    if (!productResponse.specifications) {
      productResponse.specifications = {};
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
      const firstError = errors[0] || 'Validation failed';
      return res.status(400).json({
        status: 'error',
        message: firstError,
        errors
      });
    }
    
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Delete product
router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ 
      _id: req.params.id, 
      supplier: req.userId 
    });
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Product not found' 
      });
    }
    
    res.json({ 
      status: 'success',
      message: 'Product deleted successfully' 
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get supplier orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ supplier: req.userId })
      .populate('serviceProvider', 'name company email phone')
      .populate('items.product', 'name category unit price')
      .populate('boq', 'name')
      .sort({ createdAt: -1 });
    
    res.json({ 
      status: 'success',
      orders 
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get single order details
router.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    
    console.log(`Fetching supplier order details for ID: ${decodedId}, User: ${req.userId}`);
    
    // Try to find by orderNumber first (most common case)
    let order = await Order.findOne({ 
      orderNumber: decodedId, 
      supplier: req.userId 
    });
    
    // If not found by orderNumber, try _id
    if (!order) {
      // Check if it's a valid MongoDB ObjectId
      if (decodedId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({ 
          _id: decodedId, 
          supplier: req.userId 
        });
      }
    }
    
    // If still not found, return 404
    if (!order) {
      console.log(`Supplier order not found: ${decodedId} for user ${req.userId}`);
      return res.status(404).json({ 
        status: 'error',
        message: 'Order not found or you do not have permission to view this order' 
      });
    }
    
    console.log(`Supplier order found: ${order.orderNumber}, Items: ${order.items?.length || 0}`);
    
    // Populate all necessary fields
    await order.populate('serviceProvider', 'name company email phone address');
    await order.populate('items.product', 'name category unit price description location specifications');
    await order.populate('boq', 'name itemCount');
    
    res.json({ 
      status: 'success',
      order 
    });
  } catch (error) {
    console.error('Get supplier order details error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Update order status
router.patch('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    
    console.log(`Updating order status for ID: ${decodedId}, Status: ${status}, User: ${req.userId}`);
    
    if (!status) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Status is required' 
      });
    }
    
    // Try to find by orderNumber first (most common case)
    let order = await Order.findOne({ 
      orderNumber: decodedId, 
      supplier: req.userId 
    });
    
    // If not found by orderNumber, try _id
    if (!order) {
      // Check if it's a valid MongoDB ObjectId
      if (decodedId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({ 
          _id: decodedId, 
          supplier: req.userId 
        });
      }
    }
    
    if (!order) {
      console.log(`Order not found for status update: ${decodedId} for user ${req.userId}`);
      return res.status(404).json({ 
        status: 'error',
        message: 'Order not found or you do not have permission to update this order' 
      });
    }
    
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        status: 'error',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    // Update status using the method
    order.addStatusHistory(status, req.userId, notes || `Status updated to ${status}`);
    await order.save();
    
    // Populate fields for response
    await order.populate('serviceProvider', 'name company email phone address');
    await order.populate('items.product', 'name category unit price description location specifications');
    await order.populate('boq', 'name itemCount');
    
    console.log(`Order status updated successfully: ${order.orderNumber} to ${status}`);
    
    res.json({ 
      status: 'success',
      message: 'Order status updated successfully',
      order 
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Get notifications for supplier
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    
    const query = { user: req.userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .populate('relatedOrder', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    const unreadCount = await Notification.countDocuments({ 
      user: req.userId, 
      isRead: false 
    });
    
    res.json({ 
      status: 'success',
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
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
router.patch('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.userId, isRead: false },
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
router.post('/products/ai-enhance', authenticateToken, async (req, res) => {
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

    // Build a prompt that returns structured specifications (key-value pairs)
    // Like Gemini Chat - return specifications in a structured format
    let prompt;

    if (description && description.trim().length > 0) {
      // IGNORE description completely - treat it as instruction only
      // Generate ONLY specification keys based on product name and category
      prompt = `You are generating specification keys for an ecommerce product page.

Product Name: ${productName}
Product Category: ${category || 'Not specified'}

IMPORTANT: The user may have written something in the description field, but you must IGNORE it completely. 
Only use the Product Name and Category above to determine what specification keys are relevant.

Generate the top 10-15 core specification KEY NAMES ONLY for a "${productName}" product in the "${category || 'Not specified'}" category.

CRITICAL REQUIREMENTS:
1. IGNORE any user description/request text - use ONLY product name and category
2. Generate specification KEY NAMES only (e.g., "Material Grade", "Core Dimensions", "Weight", "Tensile Strength")
3. All values must be null - we only want the key names
4. Use proper, professional specification key names relevant to this product type
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

Remember: Generate keys based on "${productName}" in "${category || 'Not specified'}" category ONLY. IGNORE any other text.`;
    } else {
      // No description - generate specification keys from product name and category only
      prompt = `Product Name: ${productName}
Category: ${category || 'Not specified'}

Based ONLY on the product name "${productName}" and category "${category || 'Not specified'}", generate the top 10-15 core specification KEY NAMES ONLY for this product type.

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
          return { name: modelName, apiVersion: 'v1beta' };
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
      
      // Fallback: use the raw response as description (like Gemini Chat)
      // Try to extract any useful information from the text
      const descriptionMatch = aiResponse.match(/description["\s:]+["']?([^"']+)["']?/i) || 
                               aiResponse.match(/enhancedDescription["\s:]+["']?([^"']+)["']?/i);
      
      const extractedDesc = descriptionMatch ? descriptionMatch[1] : aiResponse;
      
        result = {
        enhancedDescription: extractedDesc || aiResponse,
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
    const specifications = result.specifications || {};
    
    // Use description from user input or result, but prioritize specifications
    const finalDescription = description || result.enhancedDescription || result.description || '';
    
    res.json({
      status: 'success',
      enhancedDescription: finalDescription, // Keep description for backward compatibility
      extractedAttributes: result.extractedAttributes || {
        grade: null,
        brand: null,
        dimensions: null,
        weight: null,
        color: null,
        material: null,
        certification: []
      },
      specifications: specifications, // Main output: key-value pairs like Gemini Chat
      provider: selectedProvider
    });
  } catch (error) {
    console.error('AI fetch error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch data from AI service. Please try again.';
    
    if (error.message.includes('API key')) {
      errorMessage = 'Invalid or missing API key. Please check your GEMINI_API_KEY in the .env file.';
    } else if (error.message.includes('Gemini API error')) {
      errorMessage = error.message; // Use the specific Gemini error message
    } else if (error.message.includes('No response')) {
      errorMessage = 'AI service returned no response. Please check your API key and try again.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Network error connecting to AI service. Please check your internet connection.';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    // Determine provider for error message
    let errorProvider = 'unknown';
    try {
      if (geminiApiKeyValue) errorProvider = 'gemini';
      else if (openaiApiKey) errorProvider = 'openai';
      else if (anthropicApiKey) errorProvider = 'claude';
    } catch (e) {
      // Ignore
    }
    
    res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: error.message,
      provider: errorProvider
    });
  }
});

// Extract specification key-value pairs from description
// This endpoint extracts structured data from user-written description
// IMPORTANT: Only fills values for existing specification keys, does not add new keys
router.post('/products/extract-specifications', authenticateToken, async (req, res) => {
  try {
    const { description, category, productName, provider = 'auto', existingSpecifications } = req.body;
    
    if (!description || !description.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Description is required to extract specifications'
      });
    }

    // Get API keys from environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || claudeApiKey;

    // Determine which provider to use
    let selectedProvider = provider;
    if (provider === 'auto') {
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
        message: 'OpenAI API key not configured.'
      });
    }
    if (selectedProvider === 'gemini' && !geminiApiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Gemini API key not configured.'
      });
    }
    if (selectedProvider === 'claude' && !anthropicApiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Claude API key not configured.'
      });
    }

    // Validate category and description match (product name is NOT used for validation)
    // Use flexible AI-based validation instead of hardcoded keywords
    let categoryMismatchWarning = null;
    let shouldExtract = true;
    
    if (category && category.trim() && description && description.trim()) {
      const categoryLower = (category || '').trim().toLowerCase();
      const descriptionLower = (description || '').trim().toLowerCase();
      
      // Flexible validation: Check if category name or its variations appear in description
      // Split category into words and check if any appear in description
      const categoryWords = categoryLower.split(/[\s\-_]+/).filter(word => word.length > 2);
      const hasCategoryMatch = categoryWords.some(word => descriptionLower.includes(word)) || 
                               descriptionLower.includes(categoryLower);
      
      // Basic validation: If category is a single word and doesn't appear at all, warn
      // But be lenient - allow extraction even if exact match isn't found (AI will handle it)
      if (!hasCategoryMatch && categoryWords.length === 1) {
        // Only warn, don't block - let AI decide based on context
        categoryMismatchWarning = `Warning: The category "${category}" may not match the description. Please verify that the category and description are aligned.`;
        console.log('⚠️ [SUPPLIER EXTRACT] Category may not match description:', categoryMismatchWarning);
        // Still allow extraction - AI will extract what it finds
      }
      
      // Note: We don't block extraction based on mismatch anymore
      // The AI will extract specifications based on what's in the description
      // and the category will help provide context
    }

    // Note: We always allow extraction - warnings are informational only
    // The AI will extract specifications based on description content

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

    // Get existing specification keys (if provided) - we only fill values for these keys
    const existingSpecKeys = existingSpecifications && typeof existingSpecifications === 'object' && !Array.isArray(existingSpecifications)
      ? Object.keys(existingSpecifications).filter(key => key && key.trim() !== '')
      : [];

    // Build prompt to extract key-value pairs from description (handles unstructured/scattered data)
    // IMPORTANT: If existingSpecKeys are provided, ONLY extract values for those keys
    const hasExistingSpecs = existingSpecKeys.length > 0;
    
    let prompt;
    if (hasExistingSpecs) {
      // Only fill values for existing specification keys
      prompt = `You are an expert at extracting product specification VALUES from unstructured text descriptions. Your task is to find VALUES for the SPECIFIC specification keys provided below.

Product Category: ${category || 'Not specified'}
Product Description:
${description}

EXISTING SPECIFICATION KEYS (ONLY extract values for these keys - DO NOT add new keys):
${existingSpecKeys.map((key, idx) => `${idx + 1}. "${key}"`).join('\n')}

CRITICAL REQUIREMENTS:
1. ONLY extract values for the specification keys listed above
2. DO NOT create new keys or add keys that are not in the list above
3. If a value is found in the description for a key, extract it
4. If no value is found for a key, leave it out (don't include it in the response)
5. Match keys case-insensitively and flexibly (e.g., "Grade" matches "grade", "GRADE", "Material Grade", etc.)
6. Use the description to find values for the keys listed above
7. If the description mentions information that doesn't match any of the keys above, IGNORE it - do not extract it

TASK: Extract ONLY the values for the specification keys listed above from the description.

Return ONLY a valid JSON object in this format (only include keys from the list above):
{
  "specifications": {
    "Key1": "Value1",
    "Key2": "Value2"
  }
}

IMPORTANT: Only return keys that are in the list above. Do not add new keys.`;
    } else {
      // No existing specs - extract all (original behavior)
      prompt = `You are an expert at extracting product specifications from unstructured text descriptions. Your task is to identify ALL specification keys and their values, even if they are scattered throughout the description or mentioned in different ways.

Product Category: ${category || 'Not specified'}
Product Description:
${description}

IMPORTANT: Use ONLY the category and description above. The product name is NOT relevant for extraction - ignore it completely.

TASK: Extract ALL specification key-value pairs from the description above, even if the information is scattered, unclear, or mentioned in different formats.

CRITICAL EXTRACTION RULES (APPLIES TO ALL CATEGORIES):
1. Use ONLY the category "${category || 'Not specified'}" and description to understand context - product name is irrelevant
2. Extract from NATURAL LANGUAGE: Even if specifications are written in paragraph form, extract them
3. Look for explicit patterns: "Key: Value", "Key - Value", "Key is Value", "Key of Value", "Key Value", etc.
4. Extract implicit specifications from natural language: 
   - Numbers with units (e.g., "43-inch", "1920 x 1080 pixels", "60 Hz", "53 MPa", "50 kg")
   - Descriptive phrases (e.g., "Full HD", "LED display", "OPC 53 grade")
   - Technical terms relevant to the category
5. Handle scattered information: If a value is mentioned in one sentence and its key in another, combine them
6. Extract measurements: Any numbers with units (inch, Hz, pixels, MPa, kg, mm, cm, m, minutes, hours, etc.) should be extracted with appropriate keys
7. Extract standards/certifications: Look for ISO, IS, ASTM, BIS, and other standard codes
8. Extract brands: If brand names are mentioned, extract them
9. Extract dimensions: If size, length, width, height, diameter, screen size, resolution, etc. are mentioned, extract them
10. Extract properties: Based on the category "${category || 'Not specified'}", extract relevant properties:
    - For electronics/TV: screen size, resolution, refresh rate, display technology, ports, connectivity, etc.
    - For construction materials: grade, strength, weight, dimensions, certifications, etc.
    - For any category: extract ALL relevant specifications mentioned
11. Handle natural language descriptions: Extract specifications even when written in paragraph form
12. Handle lists: "Available in 50kg and 25kg bags" → {"Weight": "50kg, 25kg"} or {"Available Weights": "50kg, 25kg"}
13. Context understanding: Use the category "${category || 'Not specified'}" to infer what types of specifications are relevant
14. Multiple mentions: If a specification is mentioned multiple times, use the most complete or specific value
15. BE THOROUGH AND FLEXIBLE: Extract ALL specifications mentioned, regardless of category - adapt to what's in the description
16. Use intelligent key naming: Create appropriate specification keys based on the values found and the category context

EXAMPLES OF VARIOUS FORMATS TO HANDLE (WORKS FOR ANY CATEGORY):
- "Grade: OPC 53" → {"Grade": "OPC 53"}
- "Compressive Strength is 53 MPa" → {"Compressive Strength": "53 MPa"}
- "It has a strength of 53 MPa" → {"Compressive Strength": "53 MPa"} or {"Strength": "53 MPa"}
- "OPC 53 grade cement" → {"Grade": "OPC 53"}
- "Setting time 30 minutes" → {"Setting Time": "30 minutes"}
- "43-inch Smart LED TV" → {"Screen Size": "43-inch", "Display Technology": "LED"}
- "Full HD resolution of 1920 x 1080 pixels" → {"Display Resolution": "1920 x 1080 pixels"}
- "60 Hz refresh rate" → {"Refresh Rate": "60 Hz"}
- "LED display technology" → {"Display Technology": "LED"}
- "This 43-inch Smart LED TV delivers an immersive viewing experience with its Full HD resolution of 1920 x 1080 pixels" → {"Screen Size": "43-inch", "Display Technology": "LED", "Display Resolution": "1920 x 1080 pixels"}
- "Initial setting occurs in 30 minutes, final setting in 600 minutes" → {"Initial Setting Time": "30 minutes", "Final Setting Time": "600 minutes"}
- "Comes in 50 kg bags" → {"Weight": "50 kg"} or {"Net Weight": "50 kg"}
- "Meets IS 12269 standard" → {"Certification": "IS 12269"} or {"Standard": "IS 12269"}
- "UltraTech brand" → {"Brand": "UltraTech"}
- "Dimensions: 10mm x 20mm x 30mm" → {"Dimensions": "10mm x 20mm x 30mm"}
- "The product weighs 50kg and has dimensions of 10x20x30mm" → {"Weight": "50kg", "Dimensions": "10x20x30mm"}
- For ANY category: Extract all numbers, measurements, properties, and technical terms mentioned

Return ONLY a valid JSON object in this format:
{
  "specifications": {
    "Key1": "Value1",
    "Key2": "Value2",
    "Key3": "Value3"
  }
}

IMPORTANT GUIDELINES (FLEXIBLE FOR ANY CATEGORY):
- Be thorough: Extract ALL specification-related information, even if it's written in natural language or paragraph form
- Be smart: Use context clues to match keys with values that are mentioned separately
- Extract from natural language: Extract specifications from any format - explicit key-value pairs or embedded in descriptive text
- Standardize keys: Use proper specification key names based on the category and values found
- Preserve values: Keep the exact values as mentioned (e.g., "53 MPa", "50 kg", "30 minutes", "43-inch", "1920 x 1080 pixels")
- If a value is clearly a specification but the key is implied, infer the key based on context and category
- Category-aware extraction: Use the category "${category || 'Not specified'}" to understand what types of specifications are relevant, but extract ALL specifications found regardless
- Flexible key naming: Create appropriate keys based on what's in the description - don't limit to predefined keys
- Extract measurements: Any number with a unit should be extracted with an appropriate key
- Extract properties: Extract all technical properties, features, dimensions, and specifications mentioned
- If no specifications are found, return an empty object: {"specifications": {}}
- Return ONLY the JSON object, no additional text, explanations, or markdown formatting`;
    }

    let aiResponse;
    let result;

    // Call the appropriate AI provider
    if (selectedProvider === 'openai') {
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
              content: 'You are an expert at extracting product specifications from unstructured text and natural language descriptions. You can identify key-value pairs even when they are written in paragraph form, scattered throughout the description, or mentioned in different formats. Extract specifications from natural language like "43-inch Smart LED TV" or "Full HD resolution of 1920 x 1080 pixels". Always respond with valid JSON only, extracting ALL specification-related information you find, even if written in natural language.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1500
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
      // Google Gemini API - Use same fallback logic as AI Fetch endpoint
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
      // Same models as AI Fetch: gemini-pro, gemini-1.5-flash, gemini-1.5-pro
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
          return { name: modelName, apiVersion: 'v1beta' };
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
          console.log(`Trying Gemini API for extraction: ${geminiUrl.replace(geminiApiKey, '***KEY***')}`);
    
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
                temperature: 0.2,  // Lower temperature for more consistent extraction
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 4000  // Increased tokens to prevent truncation
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
          console.log(`✅ Successfully used Gemini model for extraction: ${geminiModel} (${apiVersion}, format: ${useRestFormat ? 'REST' : 'standard'})`);
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
          max_tokens: 1500,
          temperature: 0.2,
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

    console.log(`${selectedProvider.toUpperCase()} extraction response:`, aiResponse);
    
    // Parse the JSON response from AI
    let specifications = {};
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/```javascript\n?/g, '')
        .trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      // Try to fix incomplete JSON (common with truncated responses)
      // If JSON appears incomplete, try to close it properly
      if (cleanedResponse.includes('"specifications"') && !cleanedResponse.match(/\}\s*\}$/)) {
        // Check if we have an incomplete string value
        const incompleteStringMatch = cleanedResponse.match(/"([^"]*)$/);
        if (incompleteStringMatch) {
          // Remove the incomplete string and close the JSON properly
          cleanedResponse = cleanedResponse.replace(/"[^"]*$/, '""');
        }
        // Ensure proper closing braces
        const openBraces = (cleanedResponse.match(/\{/g) || []).length;
        const closeBraces = (cleanedResponse.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          cleanedResponse += '}'.repeat(openBraces - closeBraces);
        }
        // Try to close any incomplete string values
        cleanedResponse = cleanedResponse.replace(/(":\s*"[^"]*)$/, '$1"');
      }
      
      result = JSON.parse(cleanedResponse);
      console.log('✅ Parsed extraction result:', result);
      
      // Extract specifications from the result
      let extractedSpecs = result.specifications || {};
      
      // If we have existing specification keys, ONLY keep extracted values for those keys
      if (hasExistingSpecs) {
        const filteredSpecs = {};
        // Match keys case-insensitively and flexibly
        existingSpecKeys.forEach(existingKey => {
          // Try exact match first
          if (extractedSpecs[existingKey]) {
            filteredSpecs[existingKey] = extractedSpecs[existingKey];
          } else {
            // Try case-insensitive match
            const matchingKey = Object.keys(extractedSpecs).find(key => 
              key.toLowerCase().trim() === existingKey.toLowerCase().trim()
            );
            if (matchingKey) {
              filteredSpecs[existingKey] = extractedSpecs[matchingKey];
            } else {
              // Try partial match (e.g., "Grade" matches "Material Grade")
              const partialMatch = Object.keys(extractedSpecs).find(key => 
                key.toLowerCase().includes(existingKey.toLowerCase()) ||
                existingKey.toLowerCase().includes(key.toLowerCase())
              );
              if (partialMatch) {
                filteredSpecs[existingKey] = extractedSpecs[partialMatch];
              }
            }
          }
        });
        specifications = filteredSpecs;
        console.log(`✅ Filtered to only existing keys: ${Object.keys(specifications).length} values extracted for ${existingSpecKeys.length} existing keys`);
      } else {
        specifications = extractedSpecs;
      }
      
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw AI response:', aiResponse);
      
      // Fallback: Try to extract key-value pairs using regex patterns
      console.log('⚠️  Attempting fallback extraction using regex patterns...');
      try {
        const fallbackSpecs = {};
        
        // Pattern 1: "Key: Value" or "Key - Value" or "Key is Value"
        const keyValuePattern = /([A-Za-z][A-Za-z\s\/\-&()]+?)\s*[:=\-]\s*([^,\n}]+?)(?=[,\n}]|$)/g;
        let match;
        while ((match = keyValuePattern.exec(aiResponse)) !== null) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (key && value && key.length < 100 && value.length < 200) {
            fallbackSpecs[key] = value;
          }
        }
        
        // Pattern 1.5: Extract from incomplete JSON (handle truncated responses)
        const incompleteJsonMatch = aiResponse.match(/"([^"]+)"\s*:\s*"([^"]*)/g);
        if (incompleteJsonMatch) {
          incompleteJsonMatch.forEach(pair => {
            const pairMatch = pair.match(/"([^"]+)"\s*:\s*"([^"]*)/);
            if (pairMatch && pairMatch[1] && pairMatch[2]) {
              const key = pairMatch[1].trim();
              const value = pairMatch[2].trim();
              if (key && value && !fallbackSpecs[key]) {
                fallbackSpecs[key] = value;
              }
            }
          });
        }
        
        // Pattern 2: Generic patterns for any category - extract numbers with common units
        // Screen size pattern (for electronics): "43-inch", "55 inch", etc.
        const screenSizeMatch = aiResponse.match(/(\d+(?:\.\d+)?)\s*[-]?\s*inch/i);
        if (screenSizeMatch && !fallbackSpecs['Screen Size'] && !fallbackSpecs['Size']) {
          fallbackSpecs['Screen Size'] = `${screenSizeMatch[1]}-inch`;
        }
        
        // Resolution pattern (for displays): "1920 x 1080", "1920x1080", "Full HD", "4K", etc.
        const resolutionMatch = aiResponse.match(/(\d+)\s*x\s*(\d+)\s*(?:pixels?)?/i) || 
                                aiResponse.match(/(Full\s+HD|HD|4K|8K|UHD)/i);
        if (resolutionMatch && !fallbackSpecs['Display Resolution'] && !fallbackSpecs['Resolution']) {
          if (resolutionMatch[1] && resolutionMatch[2]) {
            fallbackSpecs['Display Resolution'] = `${resolutionMatch[1]} x ${resolutionMatch[2]} pixels`;
          } else {
            fallbackSpecs['Display Resolution'] = resolutionMatch[0];
          }
        }
        
        // Frequency pattern: "60 Hz", "120 Hz", etc. (for refresh rate, frequency, etc.)
        const frequencyMatch = aiResponse.match(/(\d+)\s*Hz/i);
        if (frequencyMatch && !fallbackSpecs['Refresh Rate'] && !fallbackSpecs['Frequency']) {
          // Try to infer key from context
          const beforeText = aiResponse.substring(Math.max(0, frequencyMatch.index - 30), frequencyMatch.index);
          if (beforeText.toLowerCase().includes('refresh')) {
            fallbackSpecs['Refresh Rate'] = `${frequencyMatch[1]} Hz`;
          } else {
            fallbackSpecs['Frequency'] = `${frequencyMatch[1]} Hz`;
          }
        }
        
        // Display technology pattern: "LED", "LCD", "OLED", "QLED", etc.
        const displayTechMatch = aiResponse.match(/(LED|LCD|OLED|QLED|Plasma|CRT)\s*(?:display|tv|technology|screen)?/i);
        if (displayTechMatch && !fallbackSpecs['Display Technology'] && !fallbackSpecs['Technology']) {
          fallbackSpecs['Display Technology'] = displayTechMatch[1].toUpperCase();
        }
        
        // Pattern 2.5: Cement-specific patterns (high priority for cement category)
        if (category && category.toLowerCase().includes('cement')) {
          // Grade pattern: "OPC 53", "Grade: OPC 53", "53 Grade", etc.
          const gradeMatch = aiResponse.match(/(?:grade|type)[\s:]*([A-Z0-9\s]+(?:OPC|PPC|PSC|SRC)[\s0-9]*|[\d]+\s*grade)/i) ||
                            aiResponse.match(/(OPC|PPC|PSC|SRC)\s*(\d+)/i) ||
                            aiResponse.match(/(\d+)\s*grade/i);
          if (gradeMatch && !fallbackSpecs['Grade']) {
            if (gradeMatch[1] && gradeMatch[2]) {
              fallbackSpecs['Grade'] = `${gradeMatch[1]} ${gradeMatch[2]}`;
            } else if (gradeMatch[1]) {
              fallbackSpecs['Grade'] = gradeMatch[1].trim();
            } else if (gradeMatch[0]) {
              fallbackSpecs['Grade'] = gradeMatch[0].trim();
            }
          }
          
          // Cement Type pattern: "Ordinary Portland Cement", "Portland Pozzolana Cement", etc.
          const cementTypeMatch = aiResponse.match(/(Ordinary\s+Portland|Portland\s+Pozzolana|Portland\s+Slag|Sulphate\s+Resistant|Rapid\s+Hardening)[\s\w]*Cement/i);
          if (cementTypeMatch && !fallbackSpecs['Cement Type']) {
            fallbackSpecs['Cement Type'] = cementTypeMatch[0].trim();
          }
          
          // Standard/Conformance pattern: "IS 12269", "IS: 12269", "conforms to IS 12269", etc.
          const standardMatch = aiResponse.match(/(?:standard|conformance|conforms?|meets?)[\s:]*([A-Z]{2,4}\s*\d+)/i) ||
                               aiResponse.match(/(IS|ISO|ASTM|BIS)\s*:?\s*(\d+)/i);
          if (standardMatch && !fallbackSpecs['Standard Conformance'] && !fallbackSpecs['Standard']) {
            if (standardMatch[1] && standardMatch[2]) {
              fallbackSpecs['Standard Conformance'] = `${standardMatch[1]} ${standardMatch[2]}`;
            } else if (standardMatch[1]) {
              fallbackSpecs['Standard Conformance'] = standardMatch[1].trim();
            }
          }
          
          // Compressive Strength pattern: "53 MPa", "53 MPa after 28 days", "minimum compressive strength of 53 MPa", etc.
          const strengthMatch = aiResponse.match(/(?:compressive\s+strength|strength)[\s:]*of?\s*(\d+(?:\.\d+)?)\s*MPa/i) ||
                               aiResponse.match(/(\d+(?:\.\d+)?)\s*MPa(?:\s*(?:after|at)\s*\d+\s*days?)?/i);
          if (strengthMatch && !fallbackSpecs['Compressive Strength'] && !fallbackSpecs['Compressive Strength (28-Day)']) {
            const strengthValue = strengthMatch[1] || strengthMatch[0].match(/\d+(?:\.\d+)?/)?.[0];
            if (strengthValue) {
              const daysMatch = aiResponse.match(/(\d+)\s*days?/i);
              if (daysMatch && daysMatch[1] === '28') {
                fallbackSpecs['Compressive Strength (28-Day)'] = `${strengthValue} MPa`;
              } else {
                fallbackSpecs['Compressive Strength'] = `${strengthValue} MPa`;
              }
            }
          }
          
          // Initial Setting Time pattern: "not less than 30 minutes", "30 minutes", etc.
          const initialSettingMatch = aiResponse.match(/(?:initial\s+setting\s+time)[\s:]*of?\s*(?:not\s+less\s+than\s+)?(\d+)\s*minutes?/i) ||
                                     aiResponse.match(/(?:setting\s+time)[\s:]*(\d+)\s*minutes?/i);
          if (initialSettingMatch && !fallbackSpecs['Initial Setting Time']) {
            fallbackSpecs['Initial Setting Time'] = `${initialSettingMatch[1]} minutes`;
          }
          
          // Final Setting Time pattern: "not more than 600 minutes", "600 minutes", etc.
          const finalSettingMatch = aiResponse.match(/(?:final\s+setting\s+time)[\s:]*of?\s*(?:not\s+more\s+than\s+)?(\d+)\s*minutes?/i);
          if (finalSettingMatch && !fallbackSpecs['Final Setting Time']) {
            fallbackSpecs['Final Setting Time'] = `${finalSettingMatch[1]} minutes`;
          }
          
          // Fineness (Blaine) pattern: "225 m²/kg", "225 m2/kg", "fineness of 225", etc.
          const finenessMatch = aiResponse.match(/(?:fineness|blaine)[\s:]*of?\s*(\d+(?:\.\d+)?)\s*(?:m[²2]\/kg|m2\/kg)/i) ||
                              aiResponse.match(/(\d+(?:\.\d+)?)\s*m[²2]\/kg/i);
          if (finenessMatch && !fallbackSpecs['Fineness (Blaine)'] && !fallbackSpecs['Fineness']) {
            const finenessValue = finenessMatch[1] || finenessMatch[0].match(/\d+(?:\.\d+)?/)?.[0];
            if (finenessValue) {
              fallbackSpecs['Fineness (Blaine)'] = `${finenessValue} m²/kg`;
            }
          }
          
          // Soundness pattern: "within 10 mm", "10 mm (Le-Chatelier method)", etc.
          const soundnessMatch = aiResponse.match(/(?:soundness)[\s:]*of?\s*(?:within\s+)?(\d+(?:\.\d+)?)\s*mm/i) ||
                               aiResponse.match(/(?:within|less\s+than)\s*(\d+(?:\.\d+)?)\s*mm(?:\s*\([^)]*\))?/i);
          if (soundnessMatch && !fallbackSpecs['Soundness']) {
            const soundnessValue = soundnessMatch[1] || soundnessMatch[0].match(/\d+(?:\.\d+)?/)?.[0];
            if (soundnessValue) {
              fallbackSpecs['Soundness'] = `${soundnessValue} mm`;
            }
          }
          
          // Net Weight pattern: "50 kg", "50kg bags", "packed in 50 kg", etc.
          const weightMatch = aiResponse.match(/(?:net\s+weight|weight|packed\s+in)[\s:]*of?\s*(\d+(?:\.\d+)?)\s*kg/i) ||
                            aiResponse.match(/(\d+(?:\.\d+)?)\s*kg(?:\s*(?:bags?|moisture|resistant))?/i);
          if (weightMatch && !fallbackSpecs['Net Weight'] && !fallbackSpecs['Weight']) {
            const weightValue = weightMatch[1] || weightMatch[0].match(/\d+(?:\.\d+)?/)?.[0];
            if (weightValue) {
              fallbackSpecs['Net Weight'] = `${weightValue} kg`;
            }
          }
        }
        
        // Pattern 3: Numbers with units (generic - works for any category)
        const numberUnitPattern = /(\d+(?:\.\d+)?)\s*(MPa|kg|g|mm|cm|m|m²|m2|minutes?|hours?|days?|IS\s+\d+|ISO\s+\d+|inch|inches|Hz|hz|pixels?|rpm|watt|w|volt|v|amp|a|mah|gb|tb|mb)/gi;
        const unitMatches = [...aiResponse.matchAll(numberUnitPattern)];
        if (unitMatches.length > 0) {
          // Try to infer keys from context for any numbers with units found
          unitMatches.forEach((match) => {
            const value = match[0];
            const unit = match[2].toLowerCase();
            let key = null;
            
            // Try to infer key from nearby text (look for common specification terms)
            const beforeText = aiResponse.substring(Math.max(0, match.index - 80), match.index);
            const afterText = aiResponse.substring(match.index, Math.min(aiResponse.length, match.index + 40));
            const contextText = (beforeText + ' ' + afterText).toLowerCase();
            
            // Generic key inference based on context and unit
            if (unit.includes('mpa') || (unit.includes('pa') && contextText.includes('strength'))) {
              key = contextText.includes('compressive') ? 
                    (contextText.includes('28') || contextText.includes('day') ? 'Compressive Strength (28-Day)' : 'Compressive Strength') : 
                    'Strength';
            } else if (unit.includes('kg') || unit.includes('g')) {
              key = (contextText.includes('weight') || contextText.includes('weighs') || contextText.includes('net')) ? 
                    (contextText.includes('net') ? 'Net Weight' : 'Weight') : 'Mass';
            } else if (unit.includes('minute') || unit.includes('hour')) {
              key = contextText.includes('setting') ? 
                    (contextText.includes('initial') ? 'Initial Setting Time' : 
                     contextText.includes('final') ? 'Final Setting Time' : 'Setting Time') : 
                    'Time';
            } else if (unit.includes('mm') || unit.includes('cm') || unit.includes('m')) {
              if (contextText.includes('soundness')) {
                key = 'Soundness';
              } else if (contextText.includes('dimension') || contextText.includes('size')) {
                key = contextText.includes('screen') ? 'Screen Size' : 'Dimensions';
              } else {
                key = 'Size';
              }
            } else if (unit.includes('is ') || unit.includes('iso ')) {
              key = 'Standard Conformance';
            } else if (unit.includes('m²') || unit.includes('m2')) {
              key = (contextText.includes('fineness') || contextText.includes('blaine')) ? 'Fineness (Blaine)' : 'Area';
            } else if (unit.includes('inch')) {
              key = contextText.includes('screen') ? 'Screen Size' : 'Size';
            } else if (unit.includes('hz')) {
              key = contextText.includes('refresh') ? 'Refresh Rate' : 'Frequency';
            } else if (unit.includes('pixel')) {
              key = contextText.includes('resolution') ? 'Display Resolution' : 'Resolution';
            } else if (unit.includes('watt') || unit.includes('w ')) {
              key = 'Power';
            } else if (unit.includes('volt') || unit.includes('v ')) {
              key = 'Voltage';
            } else if (unit.includes('amp') || unit.includes('a ')) {
              key = 'Current';
            } else if (unit.includes('mah')) {
              key = 'Battery Capacity';
            } else if (unit.includes('gb') || unit.includes('tb') || unit.includes('mb')) {
              key = 'Storage' || 'Memory';
            }
            
            // If we found a key and it doesn't exist yet, add it
            if (key && !fallbackSpecs[key]) {
              fallbackSpecs[key] = value;
            } else if (!key) {
              // If no key inferred, try to extract from context
              const keyMatch = beforeText.match(/([a-z]+(?:\s+[a-z]+)*)\s*(?:is|of|:|-)\s*$/i);
              if (keyMatch && keyMatch[1]) {
                const inferredKey = keyMatch[1].trim().split(' ').map(w => 
                  w.charAt(0).toUpperCase() + w.slice(1)
                ).join(' ');
                if (inferredKey.length > 2 && inferredKey.length < 50 && !fallbackSpecs[inferredKey]) {
                  fallbackSpecs[inferredKey] = value;
                }
              }
            }
          });
        }
        
        if (Object.keys(fallbackSpecs).length > 0) {
          // If we have existing specification keys, filter fallback specs to only those keys
          if (hasExistingSpecs) {
            const filteredFallbackSpecs = {};
            existingSpecKeys.forEach(existingKey => {
              // Try exact match first
              if (fallbackSpecs[existingKey]) {
                filteredFallbackSpecs[existingKey] = fallbackSpecs[existingKey];
              } else {
                // Try case-insensitive match
                const matchingKey = Object.keys(fallbackSpecs).find(key => 
                  key.toLowerCase().trim() === existingKey.toLowerCase().trim()
                );
                if (matchingKey) {
                  filteredFallbackSpecs[existingKey] = fallbackSpecs[matchingKey];
                } else {
                  // Try partial match
                  const partialMatch = Object.keys(fallbackSpecs).find(key => 
                    key.toLowerCase().includes(existingKey.toLowerCase()) ||
                    existingKey.toLowerCase().includes(key.toLowerCase())
                  );
                  if (partialMatch) {
                    filteredFallbackSpecs[existingKey] = fallbackSpecs[partialMatch];
                  }
                }
              }
            });
            specifications = filteredFallbackSpecs;
            console.log(`✅ Fallback extraction filtered to existing keys: ${Object.keys(specifications).length} values`);
          } else {
          specifications = fallbackSpecs;
          console.log('✅ Fallback extraction successful:', specifications);
          }
        } else {
          console.log('⚠️  Fallback extraction found no specifications');
        }
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
        specifications = {};
      }
    }

    // Clean and validate extracted specifications
    const cleanedSpecs = {};
    Object.keys(specifications).forEach(key => {
      const value = specifications[key];
      // Only include non-empty, non-null values
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        cleanedSpecs[key.trim()] = String(value).trim();
      }
    });
    
    console.log('✅ Final extracted specifications:', cleanedSpecs);
    console.log('✅ Number of specifications extracted:', Object.keys(cleanedSpecs).length);

    res.json({
      status: 'success',
      specifications: cleanedSpecs,
      provider: selectedProvider,
      extractedCount: Object.keys(cleanedSpecs).length,
      categoryMismatchWarning: categoryMismatchWarning || null
    });
  } catch (error) {
    console.error('Extract specifications error:', error);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Failed to extract specifications from description. Please try again.';
    
    if (error.message.includes('API key')) {
      errorMessage = 'Invalid or missing API key. Please check your API keys configuration.';
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

export { router as supplierRouter };