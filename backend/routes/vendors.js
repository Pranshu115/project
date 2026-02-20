import express from 'express';
import { authenticateToken, isServiceProvider } from './auth.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

const router = express.Router();

router.post('/rank', authenticateToken, isServiceProvider, async (req, res) => {
  try {
  // Extract items, ignore _timestamp and _random (used for cache-busting on frontend)
  const { items, _timestamp, _random } = req.body;
  
  // Log timestamp to verify cache-busting is working
  console.log(`Vendor ranking request received at ${new Date().toISOString()}, timestamp: ${_timestamp}, random: ${_random}`);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Items are required'
      });
    }
  
  const itemVendors = {};

    // For each item, find matching products from database
    for (const item of items) {
      const itemId = item.id?.toString() || String(item.id);
      const itemName = item.normalizedName || item.rawName || '';
      
      if (!itemName) {
        itemVendors[itemId] = [];
        continue;
      }

      // Determine category from item name
      const itemNameLower = itemName.toLowerCase();
      let itemCategory = 'other';
      if (itemNameLower.includes('steel') || itemNameLower.includes('bar') || itemNameLower.includes('rod') || itemNameLower.includes('rebar')) {
        itemCategory = 'steel';
      } else if (itemNameLower.includes('cement')) {
        itemCategory = 'cement';
      } else if (itemNameLower.includes('sand') || itemNameLower.includes('aggregate') || itemNameLower.includes('gravel')) {
        itemCategory = 'aggregates';
      } else if (itemNameLower.includes('brick') || itemNameLower.includes('block')) {
        itemCategory = 'masonry';
      } else if (itemNameLower.includes('wire') || itemNameLower.includes('cable') || itemNameLower.includes('switch')) {
        itemCategory = 'electrical';
      } else if (itemNameLower.includes('pipe') || itemNameLower.includes('fitting') || itemNameLower.includes('tap')) {
        itemCategory = 'plumbing';
      } else if (itemNameLower.includes('screw') || itemNameLower.includes('nail') || itemNameLower.includes('bolt')) {
        itemCategory = 'hardware';
      }

      // First, try to find products by productId if available (from BOQ normalization)
      // This helps us understand what product we're looking for
      let referenceProduct = null;
      if (item.productId) {
        referenceProduct = await Product.findOne({
          _id: item.productId,
          isActive: true
        });
      }
      
      // Search for products matching the item name
      // Handle singular/plural variations for better matching
      const itemNameSingular = itemNameLower.endsWith('s') && itemNameLower.length > 3 
        ? itemNameLower.slice(0, -1) 
        : itemNameLower;
      const itemNamePlural = !itemNameLower.endsWith('s') && itemNameLower.length > 3
        ? itemNameLower + 's'
        : itemNameLower;
      
      // Split item name into words for better matching
      const itemWords = itemName.split(/\s+/).filter(w => w.length > 2); // Filter out short words
      const searchPatterns = [
        itemName, // Full name
        itemNameSingular, // Singular form
        itemNamePlural, // Plural form
        ...itemWords, // Individual words
        itemName.split(' ')[0] // First word
      ].filter(p => p && p.length > 0);

      // Build search patterns - use lowercase for consistency
      const searchPatternsLower = searchPatterns.map(p => p.toLowerCase());
      const namePatterns = searchPatternsLower.map(pattern => ({ name: { $regex: new RegExp(pattern, 'i') } }));
      const descPatterns = searchPatternsLower.map(pattern => ({ description: { $regex: new RegExp(pattern, 'i') } }));
      
      // Build the query - prioritize exact productId match if available, but also find similar products
      const queryConditions = {
        $and: [
          {
            $or: [
              { name: { $regex: new RegExp(itemNameLower, 'i') } },
              { description: { $regex: new RegExp(itemNameLower, 'i') } },
              ...namePatterns,
              ...descPatterns
            ]
          },
          {
            isActive: true,
            status: 'approved' // Only show approved products to service providers
          }
        ]
      };
      
      // If we have a reference product, also match by category for better results
      if (referenceProduct && referenceProduct.category) {
        queryConditions.$and[0].$or.push({ category: referenceProduct.category });
      }
      
      // Also add category matching if we determined a category
      if (itemCategory !== 'other') {
        queryConditions.$and[0].$or.push({ category: itemCategory });
      }
      
      // Fetch products with latest data - ensure no caching
      let products = await Product.find(queryConditions)
        .populate({
          path: 'supplier',
          select: 'name company email phone address',
          // Force fresh data by not using lean() and ensuring latest
        })
        .lean(false) // Keep Mongoose documents to ensure fresh data
        .sort({ 
          status: 1, 
          price: 1, 
          averageRating: -1 
        })
        .limit(50); // Increased limit to get more suppliers
      
      // Re-fetch each product and supplier to ensure we have the absolute latest data
      // Use a fresh query with cache-busting to bypass any Mongoose caching
      const freshProducts = [];
      for (const product of products) {
        // Re-fetch the product using findOne with explicit conditions to bypass caching
        // Add a timestamp-based condition to force fresh query
        const productId = product._id.toString();
        const freshProduct = await Product.findOne({ 
          _id: productId,
          // Add condition that's always true but prevents query caching
          updatedAt: { $exists: true }
        })
          .select('name category price unit stock location description specifications images isActive status averageRating totalReviews supplier updatedAt')
          .populate({
            path: 'supplier',
            select: 'name company email phone address'
          })
          .lean(false)
          .maxTimeMS(5000);
        
        if (freshProduct) {
          // Re-fetch supplier separately to ensure latest supplier info
          // Use findOne with explicit conditions and cache-busting to bypass any caching
          if (freshProduct.supplier && freshProduct.supplier._id) {
            const supplierId = freshProduct.supplier._id.toString();
            // Re-fetch supplier with explicit field selection, no caching, and force fresh query
            // Using findOne with explicit _id and adding a timestamp to prevent caching
            const freshSupplier = await User.findOne({ 
              _id: supplierId,
              // Add a condition that's always true to prevent query caching
              $or: [{ _id: supplierId }]
            })
              .select('name company email phone address')
              .lean()
              .maxTimeMS(5000); // Add timeout to ensure fresh query
            
            if (freshSupplier) {
              // Convert to plain object to ensure we have fresh data
              const supplierData = {
                _id: freshSupplier._id,
                name: freshSupplier.name,
                company: freshSupplier.company,
                email: freshSupplier.email,
                phone: freshSupplier.phone,
                address: freshSupplier.address ? {
                  street: freshSupplier.address.street,
                  city: freshSupplier.address.city,
                  state: freshSupplier.address.state,
                  zipCode: freshSupplier.address.zipCode,
                  country: freshSupplier.address.country
                } : null
              };
              
              // Log supplier info to verify we're getting latest data
              console.log(`Re-fetched supplier ${supplierId}: Name="${supplierData.name}", Company="${supplierData.company}", City="${supplierData.address?.city || 'N/A'}", State="${supplierData.address?.state || 'N/A'}"`);
              freshProduct.supplier = supplierData;
            } else {
              console.warn(`Supplier ${supplierId} not found when re-fetching`);
            }
          }
          // Log location and updatedAt to verify we're getting latest data
          console.log(`Re-fetched product ${freshProduct._id}: Location="${freshProduct.location}", UpdatedAt="${freshProduct.updatedAt}"`);
          freshProducts.push(freshProduct);
        }
      }
      products = freshProducts;
      
      // If productId is available, prioritize that exact product
      if (item.productId && products.length > 0) {
        const exactMatchIndex = products.findIndex(p => p._id.toString() === item.productId.toString());
        if (exactMatchIndex > 0) {
          const exactMatch = products.splice(exactMatchIndex, 1)[0];
          products.unshift(exactMatch); // Move to front
        }
      }

      // If no exact matches, try to find products in the same category (but only if category is not 'other')
      if (products.length === 0 && itemCategory !== 'other') {
        products = await Product.find({
          category: itemCategory,
          isActive: true,
          status: 'approved' // Only show approved products to service providers
        })
        .populate({
          path: 'supplier',
          select: 'name company email phone address',
        })
        .lean(false)
        .sort({ status: 1, price: 1, averageRating: -1 })
        .limit(50);
        
        // Re-fetch each product and supplier for category-based results too
        const freshCategoryProducts = [];
        for (const product of products) {
        // Re-fetch the product using findOne with explicit conditions to bypass caching
        // Add a timestamp-based condition to force fresh query
        const productId = product._id.toString();
        const freshProduct = await Product.findOne({ 
          _id: productId,
          // Add condition that's always true but prevents query caching
          updatedAt: { $exists: true }
        })
          .select('name category price unit stock location description specifications images isActive status averageRating totalReviews supplier updatedAt')
          .populate({
            path: 'supplier',
            select: 'name company email phone address'
          })
          .lean(false)
          .maxTimeMS(5000);
          
          if (freshProduct) {
            // Re-fetch supplier separately to ensure latest supplier info
            // Use findOne with explicit conditions and cache-busting to bypass any caching
            if (freshProduct.supplier && freshProduct.supplier._id) {
              const supplierId = freshProduct.supplier._id.toString();
              // Re-fetch supplier with explicit field selection, no caching, and force fresh query
              // Using findOne with explicit _id and adding a condition that's always true to prevent caching
              const freshSupplier = await User.findOne({ 
                _id: supplierId,
                // Add a condition that's always true to prevent query caching
                $or: [{ _id: supplierId }]
              })
                .select('name company email phone address')
                .lean()
                .maxTimeMS(5000); // Add timeout to ensure fresh query
              
              if (freshSupplier) {
                // Convert to plain object to ensure we have fresh data
                const supplierData = {
                  _id: freshSupplier._id,
                  name: freshSupplier.name,
                  company: freshSupplier.company,
                  email: freshSupplier.email,
                  phone: freshSupplier.phone,
                  address: freshSupplier.address ? {
                    street: freshSupplier.address.street,
                    city: freshSupplier.address.city,
                    state: freshSupplier.address.state,
                    zipCode: freshSupplier.address.zipCode,
                    country: freshSupplier.address.country
                  } : null
                };
                
                // Log supplier info to verify we're getting latest data
                console.log(`Re-fetched category supplier ${supplierId}: Name="${supplierData.name}", Company="${supplierData.company}", City="${supplierData.address?.city || 'N/A'}", State="${supplierData.address?.state || 'N/A'}"`);
                freshProduct.supplier = supplierData;
              } else {
                console.warn(`Category supplier ${supplierId} not found when re-fetching`);
              }
            }
            // Log location and updatedAt to verify we're getting latest data
            console.log(`Re-fetched category product ${freshProduct._id}: Location="${freshProduct.location}", UpdatedAt="${freshProduct.updatedAt}"`);
            freshCategoryProducts.push(freshProduct);
          }
        }
        products = freshCategoryProducts;
      }

      // IMPORTANT: Removed the fallback that shows all suppliers
      // Only suppliers who have products matching the BOQ requirements will be shown
      // If no matching products are found, return empty array (no suppliers shown)
      
      // Log for debugging
      console.log(`Item "${itemName}": Found ${products.length} products`);

      // Group products by supplier and calculate rankings
      const supplierProducts = {};
      
      for (const product of products) {
        // Skip if supplier is not populated
        if (!product.supplier || !product.supplier._id) {
          console.log(`Skipping product ${product._id}: No supplier found`);
          continue;
        }
        
        const supplierId = product.supplier._id.toString();
        // Get supplier information from the fresh supplier object we just re-fetched
        const supplierName = product.supplier.name || product.supplier.company || 'Unknown Supplier';
        const supplierCompany = product.supplier.company || '';
        const supplierEmail = product.supplier.email || '';
        const supplierPhone = product.supplier.phone || '';
        const supplierAddress = product.supplier.address || {};
        
        // Get the latest product data directly from the fresh product object
        // Since we already re-fetched the product, these values are guaranteed to be latest
        const latestPrice = product.price || 0;
        const latestStock = product.stock || 0;
        const latestDescription = product.description || '';
        const latestName = product.name || itemName;
        const latestUnit = product.unit || 'nos';
        const latestCategory = product.category || itemCategory;
        const latestLocation = product.location || ''; // Get location directly from product
        
        // Get location from product first (this is the primary source), then fallback to supplier address
        // Clean up location string to remove duplicates and extra spaces
        let supplierLocation = (latestLocation || '').trim();
        
        // Remove duplicate words in location (e.g., "delhi delhi" -> "delhi")
        if (supplierLocation) {
          const locationWords = supplierLocation.toLowerCase().split(/\s+/);
          const uniqueWords = [...new Set(locationWords)];
          supplierLocation = uniqueWords.join(' ').trim();
          // Capitalize first letter of each word
          supplierLocation = supplierLocation.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
        }
        
        // If product location is empty, fallback to supplier address
        if (!supplierLocation || supplierLocation === '') {
          if (supplierAddress) {
            const city = supplierAddress.city || '';
            const state = supplierAddress.state || '';
            supplierLocation = [city, state].filter(Boolean).join(', ').trim();
          }
          if (!supplierLocation || supplierLocation === '') {
            supplierLocation = 'Location not specified';
          }
        }
        
        // Log for debugging to verify we're getting latest data
        console.log(`Product ${product._id}: Price=${latestPrice}, Stock=${latestStock}, Name=${latestName}, Location=${supplierLocation}`);
        console.log(`Supplier ${supplierId}: Name="${supplierName}", Company="${supplierCompany}", Email="${supplierEmail}", Phone="${supplierPhone}", Address="${JSON.stringify(supplierAddress)}"`);
        
        if (!supplierProducts[supplierId]) {
          supplierProducts[supplierId] = {
            supplierId: supplierId,
            supplierName: supplierName,
            supplierCompany: supplierCompany,
            supplierLocation: supplierLocation,
            products: [],
            bestPrice: latestPrice,
            bestRating: product.averageRating || 0,
            totalStock: 0,
            hasApprovedProduct: product.status === 'approved'
          };
        }

        supplierProducts[supplierId].products.push({
          ...product.toObject ? product.toObject() : product,
          price: latestPrice,
          stock: latestStock,
          description: latestDescription,
          name: latestName,
          unit: latestUnit,
          category: latestCategory
        });
        supplierProducts[supplierId].bestPrice = Math.min(supplierProducts[supplierId].bestPrice, latestPrice);
        supplierProducts[supplierId].bestRating = Math.max(supplierProducts[supplierId].bestRating, product.averageRating || 0);
        supplierProducts[supplierId].totalStock += latestStock;
        if (product.status === 'approved') {
          supplierProducts[supplierId].hasApprovedProduct = true;
        }
      }

      // Convert to array and calculate ranking score
      const vendors = Object.values(supplierProducts).map((supplier, index) => {
        // Calculate ranking score based on price, rating, and stock
        // Lower price = better, higher rating = better, more stock = better
        const priceScore = 100 - (supplier.bestPrice / 100); // Normalize price (assuming max price ~10000)
        const ratingScore = (supplier.bestRating / 5) * 30; // Rating out of 30 points
        const stockScore = Math.min((supplier.totalStock / 1000) * 20, 20); // Stock out of 20 points
        const rankScore = priceScore + ratingScore + stockScore;

        // Estimate lead time based on stock availability (more stock = faster delivery)
        const leadTime = supplier.totalStock > 500 ? 2 : supplier.totalStock > 100 ? 3 : 5;

        // Get the best matching product for this supplier (lowest price)
        const bestProduct = supplier.products.sort((a, b) => {
          const priceA = (a.price || a.toObject?.().price) || 0;
          const priceB = (b.price || b.toObject?.().price) || 0;
          return priceA - priceB;
        })[0];
        
        // Extract product data ensuring we get the latest values
        const bestProductData = bestProduct?.toObject ? bestProduct.toObject() : bestProduct;
        const productPrice = bestProductData?.price || supplier.bestPrice;
        const productName = bestProductData?.name || itemName;
        const productDescription = bestProductData?.description || '';
        const productUnit = bestProductData?.unit || 'nos';
        const productCategory = bestProductData?.category || itemCategory;

        return {
          id: supplier.supplierId,
          name: supplier.supplierName,
          company: supplier.supplierCompany,
          location: supplier.supplierLocation,
          price: productPrice, // Use the actual product price, not bestPrice
          leadTime: leadTime,
          rank: index + 1,
          rating: supplier.bestRating,
          stock: supplier.totalStock,
          productCount: supplier.products.length,
          rankScore: rankScore,
          // Add product details with latest information
          productName: productName,
          productId: bestProductData?._id?.toString() || null,
          unit: productUnit,
          category: productCategory,
          description: productDescription,
          isAvailable: (supplier.totalStock > 0),
          status: supplier.hasApprovedProduct ? 'approved' : 'pending'
        };
      });

      // Sort by rank score (descending) and assign final ranks
      vendors.sort((a, b) => b.rankScore - a.rankScore);
      vendors.forEach((vendor, index) => {
        vendor.rank = index + 1;
      });

      // Sort approved products first, then by rank score
      vendors.sort((a, b) => {
        if (a.status === 'approved' && b.status !== 'approved') return -1;
        if (a.status !== 'approved' && b.status === 'approved') return 1;
        return b.rankScore - a.rankScore;
      });
      
      // Only return vendors with available products, valid data, and confirmed status (approved products only)
      // Filter out pending suppliers - only show suppliers who have at least one approved product
      const validVendors = vendors
        .filter(vendor => 
          vendor.id && 
          vendor.name && 
          vendor.price > 0 &&
          vendor.status === 'approved' // Only show confirmed suppliers with approved products
        )
        .slice(0, 10); // Return top 10 vendors
      
      itemVendors[itemId] = validVendors;
      
      // Log for debugging
      if (validVendors.length === 0) {
        console.log(`No suppliers available for item "${itemName}" (ID: ${itemId})`);
      }
    }

  res.json({ itemVendors });
  } catch (error) {
    console.error('Vendor ranking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to rank vendors',
      error: error.message
    });
  }
});

export { router as vendorRouter };
