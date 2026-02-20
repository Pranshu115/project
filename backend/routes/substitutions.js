import express from 'express';
import { authenticateToken, isServiceProvider } from './auth.js';
import Product from '../models/Product.js';

const router = express.Router();

router.post('/suggest', authenticateToken, isServiceProvider, async (req, res) => {
  try {
    const { selectedVendors, items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Items are required'
      });
    }

    const suggestions = [];

    // For each item, find alternative products that might be better
    for (const item of items) {
      const itemName = item.normalizedName || item.rawName || '';
      const itemId = item.id?.toString();
      const selectedVendorId = selectedVendors?.[itemId];

      if (!itemName) continue;

      // Find the currently selected product
      const currentProduct = await Product.findOne({
        $or: [
          { name: { $regex: new RegExp(itemName, 'i') }, status: 'approved' },
          { _id: item.productId }
        ],
        isActive: true
      }).populate('supplier', 'name');

      if (!currentProduct) continue;

      // Find alternative products in the same category
      const alternatives = await Product.find({
        category: currentProduct.category,
        status: 'approved',
        isActive: true,
        _id: { $ne: currentProduct._id }, // Exclude current product
        price: { $lt: currentProduct.price * 1.1 } // Within 10% price range (could be cheaper or slightly more expensive)
      })
      .populate('supplier', 'name company')
      .sort({ price: 1, averageRating: -1 })
      .limit(3);

      // Check if any alternative is better (cheaper price or better rating with similar price)
      for (const alt of alternatives) {
        const priceSavings = currentProduct.price - alt.price;
        const priceSavingsPercent = (priceSavings / currentProduct.price) * 100;
        
        // Suggest if:
        // 1. Price is at least 5% cheaper, OR
        // 2. Price is similar but rating is significantly better
        const isBetterPrice = priceSavingsPercent >= 5;
        const isBetterRating = alt.averageRating > currentProduct.averageRating + 0.5 && priceSavingsPercent >= -5;

        if (isBetterPrice || isBetterRating) {
          // Estimate lead time based on stock
          const leadTime = alt.stock > 500 ? 2 : alt.stock > 100 ? 3 : 5;
          const currentLeadTime = currentProduct.stock > 500 ? 2 : currentProduct.stock > 100 ? 3 : 5;

          suggestions.push({
            id: `${itemId}-${alt._id}`,
            originalItem: itemName,
            originalPrice: currentProduct.price,
            originalLeadTime: currentLeadTime,
            originalProductId: currentProduct._id.toString(),
            suggestedItem: alt.name,
            suggestedPrice: alt.price,
            suggestedLeadTime: leadTime,
            suggestedProductId: alt._id.toString(),
            supplierName: alt.supplier?.name || alt.supplier?.company || 'Unknown',
            savings: priceSavings,
            savingsPercent: Math.round(priceSavingsPercent * 10) / 10,
            reason: isBetterPrice ? 'Lower price' : 'Better rating with similar price'
          });
        }
      }
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Substitution suggestion error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate substitution suggestions',
      error: error.message
    });
  }
});

export { router as substitutionRouter };
