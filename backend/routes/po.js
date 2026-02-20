import express from 'express';
import { authenticateToken, isServiceProvider } from './auth.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import BOQ from '../models/BOQ.js';
import Notification from '../models/Notification.js';

const router = express.Router();

router.post('/group', authenticateToken, isServiceProvider, async (req, res) => {
  try {
    const { selectedVendors, substitutions, items } = req.body;
    
    if (!selectedVendors || typeof selectedVendors !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'Selected vendors are required'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Items are required'
      });
    }

    // Create a map of substitutions for quick lookup
    const substitutionMap = {};
    if (substitutions && Array.isArray(substitutions)) {
      substitutions.forEach(sub => {
        if (sub.originalItem && sub.suggestedItem) {
          substitutionMap[sub.originalItem] = sub.suggestedItem;
        }
      });
    }

    // Group items by selected vendor
    const vendorGroups = {};
    
    for (const item of items) {
      const itemId = item.id?.toString();
      const vendorId = selectedVendors[itemId];
      
      if (!vendorId) {
        continue; // Skip items without selected vendor
      }

      // Check if there's a substitution for this item
      const itemName = substitutionMap[item.normalizedName] || item.normalizedName || item.rawName;
      
      // Find the product from database - ONLY real products from the selected supplier
      let product = null;
      
      // First try to find by productId if available
      if (item.productId) {
        product = await Product.findOne({
          _id: item.productId,
          supplier: vendorId,
          isActive: true,
          status: 'approved' // Only approved products can be ordered
        }).populate('supplier', 'name company');
      }
      
      // If not found by ID, try to find by name from the selected supplier
      if (!product) {
        product = await Product.findOne({
          name: { $regex: new RegExp(itemName, 'i') },
          supplier: vendorId,
          status: 'approved', // Only approved products can be ordered
          isActive: true
        }).populate('supplier', 'name company');
      }
      
      // If product not found, skip this item (don't use placeholder data)
      if (!product) {
        console.warn(`Product "${itemName}" not found for supplier ${vendorId}. Skipping item.`);
        continue;
      }

      const supplier = product.supplier || await User.findById(vendorId);
      const supplierName = supplier?.name || supplier?.company || 'Unknown Supplier';
      
      if (!vendorGroups[vendorId]) {
        vendorGroups[vendorId] = {
          vendorId: vendorId,
          vendorName: supplierName,
          items: [],
          total: 0
        };
      }

      const quantity = parseFloat(item.quantity) || 0;
      // Use ONLY the real product price from database
      const price = product.price || 0;
      const itemTotal = quantity * price;

      vendorGroups[vendorId].items.push({
        name: itemName,
        quantity: quantity,
        price: price,
        unit: product.unit || 'nos',
        productId: product._id.toString(),
        originalItem: item.normalizedName || item.rawName
      });

      vendorGroups[vendorId].total += itemTotal;
    }

    // Convert to array format
    const groups = Object.values(vendorGroups).map(group => ({
      vendorId: group.vendorId,
      vendorName: group.vendorName,
      total: Math.round(group.total * 100) / 100, // Round to 2 decimal places
      items: group.items
    }));

    // If no groups were created, return empty array
    if (groups.length === 0) {
      return res.json({ 
        groups: [],
        message: 'No items with selected vendors found'
      });
    }

    res.json({ groups });
  } catch (error) {
    console.error('PO grouping error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to group purchase orders',
      error: error.message
    });
  }
});

router.post('/create', authenticateToken, isServiceProvider, async (req, res) => {
  try {
    const { poGroups, boqId } = req.body;
    
    // Validate poGroups
    if (!poGroups) {
      return res.status(400).json({
        status: 'error',
        message: 'PO groups are required. Please ensure you have selected suppliers for your items and try again.'
      });
    }

    if (!Array.isArray(poGroups)) {
      return res.status(400).json({
        status: 'error',
        message: 'PO groups must be an array. Please refresh the page and try again.'
      });
    }

    if (poGroups.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No purchase order groups found. This might happen if:\n- No suppliers were selected for the items\n- The selected suppliers don\'t have matching products in the database\n- Items could not be matched to supplier products\n\nPlease go back and ensure all items have selected suppliers with matching products.'
      });
    }

    // Verify BOQ exists and belongs to the service provider
    let boq = null;
    if (boqId) {
      boq = await BOQ.findOne({ 
        _id: boqId, 
        serviceProvider: req.userId 
      });
      if (!boq) {
        return res.status(404).json({
          status: 'error',
          message: 'BOQ not found or access denied'
        });
      }
    }

    const createdOrders = [];

    // Create an Order document for each PO group
    for (const group of poGroups) {
      // Find supplier by vendorId - vendorId should always be the supplier's User ID
      // Always fetch fresh supplier data to ensure latest information
      let supplier = null;
      
      // vendorId must be a valid ObjectId and must exist
      if (!group.vendorId) {
        console.error(`Missing vendorId in PO group:`, group);
        return res.status(400).json({
          status: 'error',
          message: `Missing supplier ID for vendor "${group.vendorName}". Cannot create order.`
        });
      }

      // Validate and find supplier by ID - always fetch fresh
      if (group.vendorId.match(/^[0-9a-fA-F]{24}$/)) {
        supplier = await User.findById(group.vendorId).lean(false); // Keep Mongoose document for fresh data
        
        // Verify the user is actually a supplier
        if (supplier && supplier.userType !== 'supplier') {
          console.error(`User ${group.vendorId} is not a supplier, userType: ${supplier.userType}`);
          return res.status(400).json({
            status: 'error',
            message: `Invalid supplier ID. User is not a supplier.`
          });
        }
      } else {
        console.error(`Invalid vendorId format: ${group.vendorId}`);
        return res.status(400).json({
          status: 'error',
          message: `Invalid supplier ID format for vendor "${group.vendorName}".`
        });
      }

      // If supplier not found, return error
      if (!supplier) {
        console.error(`Supplier not found with ID: ${group.vendorId}`);
        return res.status(404).json({
          status: 'error',
          message: `Supplier not found for vendor "${group.vendorName}". Please ensure the supplier exists in the system.`
        });
      }

      // Map items to order items format - ONLY use real products from suppliers
      // Always fetch fresh product data to ensure latest prices and information
      const orderItems = await Promise.all(group.items.map(async (item) => {
        // First try to find product by productId if available - always fetch fresh
        let product = null;
        if (item.productId) {
          product = await Product.findOne({
            _id: item.productId,
            supplier: supplier._id,
            isActive: true,
            status: 'approved' // Only approved products can be ordered
          }).lean(false); // Keep Mongoose document for fresh data
        }
        
        // If not found by ID, try to find by name from the selected supplier - always fetch fresh
        if (!product) {
          product = await Product.findOne({ 
            name: { $regex: new RegExp(item.name, 'i') },
            supplier: supplier._id,
            status: 'approved', // Only approved products can be ordered
            isActive: true
          })
          .sort({ createdAt: -1 })
          .lean(false); // Keep Mongoose document for fresh data
        }

        // If product still not found, throw error - no placeholder products
        if (!product) {
          throw new Error(`Product "${item.name}" not found for supplier "${group.vendorName}". Please ensure the supplier has added this product in their manage your product section.`);
        }

        // Re-fetch product to ensure we have the absolute latest price and stock information
        const freshProduct = await Product.findOne({
          _id: product._id
        }).lean(false);
        
        // Use the actual product price from fresh database query
        const unitPrice = freshProduct?.price || product.price || item.price || 0;
        const quantity = parseFloat(item.quantity) || 0;

        return {
          product: product._id,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: unitPrice * quantity
        };
      }));

      // Calculate total amount
      const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

      // Generate order number manually
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const count = await Order.countDocuments({
        createdAt: {
          $gte: new Date(year, new Date().getMonth(), 1),
          $lt: new Date(year, new Date().getMonth() + 1, 1)
        }
      });
      const orderNumber = `ORD${year}${month}${String(count + 1).padStart(4, '0')}`;

      // Create order with proper order number
      const order = await Order.create({
        orderNumber: orderNumber,
        serviceProvider: req.userId,
        supplier: supplier._id,
        boq: boq ? boq._id : undefined,
        items: orderItems,
        totalAmount: totalAmount,
        status: 'confirmed', // Set to confirmed since service provider is creating it
        paymentStatus: 'pending'
      });

      // Add status history
      order.addStatusHistory('confirmed', req.userId, 'Purchase order created and confirmed by service provider');
      await order.save();

      // Create notification for the supplier about the new order
      try {
        // Get service provider info for the notification message
        const serviceProvider = await User.findById(req.userId).select('name company');
        const serviceProviderName = serviceProvider?.name || serviceProvider?.company || 'Service Provider';
        
        // Use supplier._id directly (Mongoose will handle ObjectId conversion)
        const notification = new Notification({
          user: supplier._id,
          type: 'order_status',
          title: 'New Order Received',
          message: `You have received a new order ${order.orderNumber} from ${serviceProviderName} for ₹${totalAmount.toLocaleString('en-IN')}`,
          relatedOrder: order._id,
          isRead: false
        });
        await notification.save();
        console.log(`✅ Notification created for supplier ${supplier._id} about new order ${order.orderNumber}`);
      } catch (notifError) {
        console.error('❌ Error creating order notification:', notifError);
        console.error('Notification error details:', {
          supplierId: supplier._id,
          supplierType: typeof supplier._id,
          orderId: order._id,
          error: notifError.message,
          stack: notifError.stack
        });
        // Don't fail the order creation if notification creation fails
      }

      createdOrders.push({
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        supplier: group.vendorName,
        totalAmount: order.totalAmount
      });
    }

    // Update BOQ status if it exists
    if (boq) {
      boq.status = 'completed';
      boq.completedAt = new Date();
      boq.addProcessingLog('completed', 'Purchase orders created', req.userId);
      await boq.save();
    }

    res.json({ 
      success: true, 
      orders: createdOrders,
      message: `Successfully created ${createdOrders.length} purchase order(s)`
    });
  } catch (error) {
    console.error('PO creation error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to create purchase orders',
      error: error.message 
    });
  }
});

export { router as poRouter };
