import express from 'express';
import { authenticateToken } from './auth.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import BOQ from '../models/BOQ.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Service Provider Dashboard
router.get('/service-provider', authenticateToken, async (req, res) => {
  try {
    // Set cache-busting headers to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Get user's BOQs - always fetch fresh from database
    const boqs = await BOQ.find({ serviceProvider: req.userId })
      .sort({ createdAt: -1 })
      .lean(false); // Keep Mongoose documents for fresh data
    
    // Get user's orders (as service provider) - always fetch fresh
    const orders = await Order.find({ serviceProvider: req.userId })
      .sort({ createdAt: -1 })
      .lean(false); // Keep Mongoose documents for fresh data

    // Calculate stats
    const stats = {
      totalBOQs: boqs.length,
      activePOs: orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
      totalSpent: orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.totalAmount, 0),
      // Count orders as pending approval if they are 'pending' or 'confirmed' (not yet confirmed by supplier)
      // Once supplier moves order to 'processing', 'shipped', 'delivered', etc., it's no longer pending
      pendingApprovals: orders.filter(o => 
        o.status === 'pending' || o.status === 'confirmed'
      ).length
    };

    // Format recent BOQs
    const recentBOQs = boqs.slice(0, 5).map(boq => ({
      id: boq._id,
      name: boq.name,
      itemCount: boq.itemCount,
      createdAt: formatDate(boq.createdAt),
      status: boq.status
    }));

    // Format live POs (orders) with supplier information - always fetch fresh supplier data
    const recentPOs = await Promise.all(orders.slice(0, 5).map(async (order) => {
      // Re-fetch supplier to ensure latest information
      const supplier = await User.findById(order.supplier).select('name company').lean();
      
      return {
        id: order.orderNumber || order._id.toString(),
        orderNumber: order.orderNumber,
        vendor: supplier?.name || supplier?.company || 'Supplier',
        vendorCompany: supplier?.company || '',
        amount: order.totalAmount,
        status: order.status,
        itemCount: order.items?.length || 0,
        createdAt: formatDate(order.createdAt)
      };
    }));

    res.json({
      status: 'success',
      stats,
      recentBOQs,
      recentPOs
    });
  } catch (error) {
    console.error('Service provider dashboard error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Supplier Dashboard
router.get('/supplier', authenticateToken, async (req, res) => {
  try {
    // Get supplier's products
    const products = await Product.find({ supplier: req.userId });
    
    // Get supplier's orders
    const orders = await Order.find({ supplier: req.userId })
      .sort({ createdAt: -1 });

    // Calculate stats
    const stats = {
      totalProducts: products.length,
      activeOrders: orders.filter(o => 
        o.status !== 'delivered' && 
        o.status !== 'cancelled' && 
        o.status !== 'returned'
      ).length,
      totalRevenue: orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.totalAmount, 0),
      pendingQuotes: orders.filter(o => 
        o.status === 'pending' || o.status === 'confirmed'
      ).length
    };

    // Format products for response
    const formattedProducts = products.slice(0, 10).map(product => ({
      id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      unit: product.unit,
      stock: product.stock,
      description: product.description
    }));

    // Format live orders with service provider info
    const formattedOrders = await Promise.all(orders.slice(0, 10).map(async (order) => {
      const serviceProvider = await User.findById(order.serviceProvider).select('name company');
      return {
        id: order.orderNumber || order._id.toString(),
        orderNumber: order.orderNumber,
        customer: serviceProvider?.name || serviceProvider?.company || 'Service Provider',
        company: serviceProvider?.company || '',
        amount: order.totalAmount,
        status: order.status,
        createdAt: formatDate(order.createdAt),
        itemCount: order.items?.length || 0
      };
    }));

    res.json({
      status: 'success',
      stats,
      products: formattedProducts,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Supplier dashboard error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
});

// Get service provider order details
router.get('/service-provider/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    
    // Set cache-busting headers to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    console.log(`Fetching order details for ID: ${decodedId}, User: ${req.userId}`);
    
    // Try to find by orderNumber first (most common case) - always fetch fresh
    let order = await Order.findOne({ 
      orderNumber: decodedId, 
      serviceProvider: req.userId
    }).lean(false);
    
    // If not found by orderNumber, try _id
    if (!order) {
      // Check if it's a valid MongoDB ObjectId
      if (decodedId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({ 
          _id: decodedId, 
          serviceProvider: req.userId
        }).lean(false);
      }
    }
    
    // If still not found, return 404
    if (!order) {
      console.log(`Order not found: ${decodedId} for user ${req.userId}`);
      return res.status(404).json({ 
        status: 'error',
        message: 'Order not found or you do not have permission to view this order' 
      });
    }
    
    console.log(`Order found: ${order.orderNumber}, Items: ${order.items?.length || 0}, Supplier ID: ${order.supplier}`);
    
    // Get supplier ID - handle both populated and unpopulated cases
    let supplierId = null;
    if (order.supplier) {
      // If supplier is already populated (object), get the _id
      if (typeof order.supplier === 'object' && order.supplier._id) {
        supplierId = order.supplier._id.toString();
      } 
      // If supplier is just an ObjectId reference
      else if (order.supplier.toString) {
        supplierId = order.supplier.toString();
      }
      // If it's already a string
      else {
        supplierId = order.supplier;
      }
    }
    
    console.log(`Supplier ID extracted: ${supplierId}`);
    
    // Populate product and BOQ fields - always fetch fresh
    await order.populate('items.product', 'name category unit price description location specifications');
    await order.populate('boq', 'name itemCount');
    
    // Try to populate supplier first (in case it's already populated)
    try {
      await order.populate('supplier', 'name company email phone address');
    } catch (populateError) {
      console.log('Supplier populate failed, will fetch directly:', populateError.message);
    }
    
    // Re-fetch supplier with fresh data to ensure latest information
    let freshSupplier = null;
    if (supplierId) {
      try {
        freshSupplier = await User.findById(supplierId).select('name company email phone address').lean();
        console.log(`Supplier fetched:`, freshSupplier ? { name: freshSupplier.name, company: freshSupplier.company } : 'NOT FOUND');
      } catch (fetchError) {
        console.error('Error fetching supplier:', fetchError);
      }
    } else {
      console.error('No supplier ID found in order');
    }
    
    // Convert order to plain object for proper serialization
    const orderObj = order.toObject ? order.toObject() : order;
    
    // Replace supplier with fresh data (prefer freshSupplier, fallback to populated supplier)
    if (freshSupplier) {
      orderObj.supplier = freshSupplier;
      console.log(`Supplier attached to order (fresh):`, { name: freshSupplier.name, company: freshSupplier.company });
    } else if (orderObj.supplier && typeof orderObj.supplier === 'object' && orderObj.supplier._id) {
      // Use populated supplier if available
      console.log(`Using populated supplier:`, { name: orderObj.supplier.name, company: orderObj.supplier.company });
    } else {
      console.error('Supplier not found or not attached to order');
      // Set supplier to null explicitly if not found
      orderObj.supplier = null;
    }
    
    res.json({ 
      status: 'success',
      order: orderObj
    });
  } catch (error) {
    console.error('Get service provider order details error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Update payment status for service provider order
router.patch('/service-provider/orders/:id/payment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod } = req.body;
    const decodedId = decodeURIComponent(id);
    
    console.log(`Updating payment status for order: ${decodedId}, Status: ${paymentStatus}, User: ${req.userId}`);
    
    if (!paymentStatus) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Payment status is required' 
      });
    }
    
    // Validate payment status
    const validStatuses = ['pending', 'partial', 'paid', 'refunded'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        status: 'error',
        message: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    // Try to find by orderNumber first
    let order = await Order.findOne({ 
      orderNumber: decodedId, 
      serviceProvider: req.userId 
    });
    
    // If not found by orderNumber, try _id
    if (!order) {
      if (decodedId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({ 
          _id: decodedId, 
          serviceProvider: req.userId 
        });
      }
    }
    
    if (!order) {
      console.log(`Order not found for payment update: ${decodedId} for user ${req.userId}`);
      return res.status(404).json({ 
        status: 'error',
        message: 'Order not found or you do not have permission to update this order' 
      });
    }
    
    // Update payment status
    order.paymentStatus = paymentStatus;
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    
    // Add to status history
    order.statusHistory.push({
      status: order.status,
      updatedBy: req.userId,
      notes: `Payment status updated to ${paymentStatus}`,
      timestamp: new Date()
    });
    
    await order.save();
    
    // If payment status is updated to "paid", create a notification for the supplier
    if (paymentStatus === 'paid' && order.supplier) {
      try {
        const notification = new Notification({
          user: order.supplier,
          type: 'payment_received',
          title: 'Payment Received',
          message: `Payment of ₹${order.totalAmount.toLocaleString('en-IN')} has been received for Order ${order.orderNumber}`,
          relatedOrder: order._id,
          isRead: false
        });
        await notification.save();
        console.log(`Notification created for supplier ${order.supplier} about payment for order ${order.orderNumber}`);
      } catch (notifError) {
        console.error('Error creating payment notification:', notifError);
        // Don't fail the payment update if notification creation fails
      }
    }
    
    // Populate fields for response
    await order.populate('supplier', 'name company email phone address');
    await order.populate('items.product', 'name category unit price description location specifications');
    await order.populate('boq', 'name itemCount');
    
    console.log(`Payment status updated successfully: ${order.orderNumber} to ${paymentStatus}`);
    
    res.json({ 
      status: 'success',
      message: 'Payment status updated successfully',
      order 
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Delete order for service provider
router.delete('/service-provider/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    
    console.log(`Deleting order for service provider: ${decodedId}, User: ${req.userId}`);
    
    // Try to find by orderNumber first
    let order = await Order.findOne({ 
      orderNumber: decodedId, 
      serviceProvider: req.userId 
    });
    
    // If not found by orderNumber, try _id
    if (!order) {
      if (decodedId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({ 
          _id: decodedId, 
          serviceProvider: req.userId 
        });
      }
    }
    
    if (!order) {
      console.log(`Order not found for deletion: ${decodedId} for user ${req.userId}`);
      return res.status(404).json({ 
        status: 'error',
        message: 'Order not found or you do not have permission to delete this order' 
      });
    }
    
    // Prevent deletion of orders that are already delivered or paid
    if (order.status === 'delivered' && order.paymentStatus === 'paid') {
      return res.status(400).json({ 
        status: 'error',
        message: 'Cannot delete an order that has been delivered and paid. Please contact support if you need to cancel this order.' 
      });
    }
    
    // Delete the order
    await Order.findByIdAndDelete(order._id);
    
    console.log(`Order ${order.orderNumber} deleted successfully by service provider ${req.userId}`);
    
    res.json({ 
      status: 'success',
      message: 'Order deleted successfully',
      orderNumber: order.orderNumber
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Delete order for supplier
router.delete('/supplier/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    
    console.log(`Deleting order for supplier: ${decodedId}, User: ${req.userId}`);
    
    // Try to find by orderNumber first
    let order = await Order.findOne({ 
      orderNumber: decodedId, 
      supplier: req.userId 
    });
    
    // If not found by orderNumber, try _id
    if (!order) {
      if (decodedId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findOne({ 
          _id: decodedId, 
          supplier: req.userId 
        });
      }
    }
    
    if (!order) {
      console.log(`Order not found for deletion: ${decodedId} for supplier ${req.userId}`);
      return res.status(404).json({ 
        status: 'error',
        message: 'Order not found or you do not have permission to delete this order' 
      });
    }
    
    // Prevent deletion of orders that are already delivered or paid
    if (order.status === 'delivered' && order.paymentStatus === 'paid') {
      return res.status(400).json({ 
        status: 'error',
        message: 'Cannot delete an order that has been delivered and paid. Please contact support if you need to cancel this order.' 
      });
    }
    
    // Delete the order
    await Order.findByIdAndDelete(order._id);
    
    console.log(`Order ${order.orderNumber} deleted successfully by supplier ${req.userId}`);
    
    res.json({ 
      status: 'success',
      message: 'Order deleted successfully',
      orderNumber: order.orderNumber
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Helper function to format dates - shows exact date and time
function formatDate(date) {
  if (!date) return 'N/A';
  
  const orderDate = new Date(date);
  
  // Format: "DD/MM/YYYY, HH:MM:SS" (e.g., "12/02/2026, 10:56:58")
  const day = String(orderDate.getDate()).padStart(2, '0');
  const month = String(orderDate.getMonth() + 1).padStart(2, '0');
  const year = orderDate.getFullYear();
  const hours = String(orderDate.getHours()).padStart(2, '0');
  const minutes = String(orderDate.getMinutes()).padStart(2, '0');
  const seconds = String(orderDate.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

export { router as dashboardRouter };