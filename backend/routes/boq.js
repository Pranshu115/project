import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { authenticateToken, isServiceProvider } from './auth.js';
import BOQ from '../models/BOQ.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load pdf-parse - handle different versions
let pdfParseFunction = null;
try {
  const pdfModule = require('pdf-parse');
  // Try to get the actual parsing function
  // In some versions it's directly callable, in v2.x it's PDFParse class
  if (typeof pdfModule === 'function') {
    pdfParseFunction = pdfModule;
  } else if (pdfModule.PDFParse && typeof pdfModule.PDFParse === 'function') {
    // For v2.x, we'll need to handle it specially
    pdfParseFunction = pdfModule.PDFParse;
  } else if (pdfModule.default && typeof pdfModule.default === 'function') {
    pdfParseFunction = pdfModule.default;
  }
} catch (error) {
  console.warn('pdf-parse module not available:', error.message);
}

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Helper function to parse CSV file
const parseCSV = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let hasData = false;
    
    fs.createReadStream(filePath)
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: false
      }))
      .on('data', (data) => {
        hasData = true;
        results.push(data);
      })
      .on('end', () => {
        if (!hasData || results.length === 0) {
          reject(new Error('CSV file appears to be empty or contains no valid data'));
        } else {
          resolve(results);
        }
      })
      .on('error', (error) => {
        reject(new Error(`Failed to parse CSV file: ${error.message}. Please ensure the file is a valid CSV format.`));
      });
  });
};

// Helper function to parse Excel file
const parseExcel = async (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }
    
    // Use the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('Could not read worksheet from Excel file');
    }
    
    // Convert to JSON - handle empty rows
    const data = xlsx.utils.sheet_to_json(worksheet, {
      defval: '', // Default value for empty cells
      blankrows: false // Skip blank rows
    });
    
    if (!data || data.length === 0) {
      throw new Error('Excel file appears to be empty or contains no data');
    }
    
    return data;
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error(`Failed to parse Excel file: ${error.message}. Please ensure the file is a valid Excel format (.xlsx or .xls) and contains data.`);
  }
};

// Helper function to parse PDF file
const parsePDF = async (filePath) => {
  if (!pdfParseFunction) {
    throw new Error('PDF parsing is not available. Please convert your BOQ file to CSV or Excel format (.csv, .xlsx, .xls).');
  }

  const dataBuffer = fs.readFileSync(filePath);
  
  let data;
  try {
    // Try different methods to call pdf-parse
    if (typeof pdfParseFunction === 'function') {
      // Try calling directly
      try {
        data = await pdfParseFunction(dataBuffer);
      } catch (e) {
        // If direct call fails, try as constructor (for v2.x)
        if (e.message.includes('without \'new\'')) {
          const PDFParse = require('pdf-parse').PDFParse;
          const parser = new PDFParse(dataBuffer);
          // Check if parser has a parse method or is thenable
          if (typeof parser.parse === 'function') {
            data = await parser.parse();
          } else if (typeof parser.then === 'function') {
            data = await parser;
          } else {
            // Try to get data from parser object
            data = parser;
          }
        } else {
          throw e;
        }
      }
    } else {
      throw new Error('PDF parser function not available');
    }
  } catch (parseError) {
    console.error('PDF parsing error:', parseError);
    throw new Error(`Unable to parse PDF file: ${parseError.message}. Please convert your BOQ to CSV or Excel format (.csv, .xlsx) for better compatibility.`);
  }
  
  if (!data || !data.text || data.text.trim().length === 0) {
    throw new Error('Could not extract text from PDF. The PDF may be image-based or encrypted. Please convert your BOQ to CSV or Excel format (.csv, .xlsx) for better compatibility.');
  }
  
  // Basic PDF parsing - extract text and try to parse table-like data
  // This is a simplified parser - you may need to enhance it based on your PDF structure
  const lines = data.text.split('\n').filter(line => line.trim());
  const results = [];
  
  if (lines.length === 0) {
    throw new Error('No readable content found in PDF. Please convert your BOQ to CSV or Excel format (.csv, .xlsx).');
  }
  
  // Try to extract items from PDF text
  // Look for patterns like: "Item Name", "Quantity", "Description", etc.
  lines.forEach((line, index) => {
    const parts = line.split(/\s{2,}|\t/).filter(p => p.trim());
    if (parts.length >= 2) {
      // Try to identify if this line contains item data
      const quantity = parseFloat(parts.find(p => !isNaN(parseFloat(p))));
      if (quantity && quantity > 0) {
        results.push({
          description: parts[0] || line,
          quantity: quantity,
          unit: parts[parts.length - 1] || 'nos'
        });
      }
    }
  });
  
  // If no items were extracted, provide helpful error
  if (results.length === 0) {
    throw new Error('Could not extract structured data from PDF. PDF files with tables or complex formatting may not parse correctly. Please convert your BOQ to CSV or Excel format (.csv, .xlsx) for reliable parsing.');
  }
  
  return results;
};

// Helper function to calculate match confidence between two strings
const calculateMatchConfidence = (itemName, productName, productDescription = '') => {
  const itemLower = itemName.trim().toLowerCase();
  const productLower = productName.trim().toLowerCase();
  const descLower = (productDescription || '').trim().toLowerCase();
  
  // Exact match = 100%
  if (itemLower === productLower) {
    return 1.0;
  }
  
  // Check if item name is contained in product name or vice versa
  if (productLower.includes(itemLower) || itemLower.includes(productLower)) {
    // Calculate how much of the item name is covered
    const coverage = Math.min(itemLower.length, productLower.length) / Math.max(itemLower.length, productLower.length);
    return 0.85 + (coverage * 0.1); // 85-95% range
  }
  
  // Word-based matching
  const itemWords = itemLower.split(/\s+/).filter(w => w.length > 2);
  const productWords = productLower.split(/\s+/).filter(w => w.length > 2);
  const descWords = descLower.split(/\s+/).filter(w => w.length > 2);
  
  if (itemWords.length === 0) {
    return 0.5; // No meaningful words
  }
  
  // Count matching words
  let matchingWords = 0;
  let totalItemWords = itemWords.length;
  
  for (const itemWord of itemWords) {
    if (productWords.includes(itemWord) || descWords.includes(itemWord)) {
      matchingWords++;
    }
  }
  
  // Calculate word match percentage
  const wordMatchRatio = matchingWords / totalItemWords;
  
  // All words match = 90-95%
  if (wordMatchRatio === 1.0) {
    return 0.90;
  }
  
  // Most words match (>= 70%) = 75-85%
  if (wordMatchRatio >= 0.7) {
    return 0.75 + (wordMatchRatio - 0.7) * 0.33; // 75-85% range
  }
  
  // Some words match (>= 50%) = 60-75%
  if (wordMatchRatio >= 0.5) {
    return 0.60 + (wordMatchRatio - 0.5) * 0.75; // 60-75% range
  }
  
  // Few words match (>= 30%) = 45-60%
  if (wordMatchRatio >= 0.3) {
    return 0.45 + (wordMatchRatio - 0.3) * 0.75; // 45-60% range
  }
  
  // Very few words match (< 30%) = 30-45%
  return 0.30 + (wordMatchRatio * 0.5); // 30-45% range
};

// Helper function to normalize product name by matching with database products
const normalizeProductName = async (rawName) => {
  // Clean and normalize the raw name for better matching
  const itemNameLower = rawName.trim().toLowerCase();
  
  // Determine category from item name (similar to vendor ranking)
  let itemCategory = 'other';
  if (itemNameLower.includes('steel') || itemNameLower.includes('bar') || itemNameLower.includes('rod') || itemNameLower.includes('rebar')) {
    itemCategory = 'steel';
  } else if (itemNameLower.includes('cement')) {
    itemCategory = 'cement';
  } else if (itemNameLower.includes('sand') || itemNameLower.includes('aggregate') || itemNameLower.includes('gravel')) {
    itemCategory = 'aggregates';
  } else if (itemNameLower.includes('brick') || itemNameLower.includes('block')) {
    itemCategory = 'masonry';
  } else if (itemNameLower.includes('plaster')) {
    itemCategory = 'cement'; // Plaster is often in cement category
  }
  
  // Handle singular/plural variations for better matching
  const itemNameSingular = itemNameLower.endsWith('s') && itemNameLower.length > 3 
    ? itemNameLower.slice(0, -1) 
    : itemNameLower;
  const itemNamePlural = !itemNameLower.endsWith('s') && itemNameLower.length > 3
    ? itemNameLower + 's'
    : itemNameLower;
  
  // Split item name into words for better matching
  const itemWords = rawName.split(/\s+/).filter(w => w.length > 2);
  const searchPatterns = [
    itemNameLower, // Full name
    itemNameSingular, // Singular form
    itemNamePlural, // Plural form
    ...itemWords.map(w => w.toLowerCase()), // Individual words
    rawName.split(' ')[0].toLowerCase() // First word
  ].filter(p => p && p.length > 0);
  
  // Build search patterns - use lowercase for consistency
  const searchPatternsLower = [...new Set(searchPatterns)]; // Remove duplicates
  const namePatterns = searchPatternsLower.map(pattern => ({ name: { $regex: new RegExp(pattern, 'i') } }));
  const descPatterns = searchPatternsLower.map(pattern => ({ description: { $regex: new RegExp(pattern, 'i') } }));
  
  // Build the query - include category matching for better results
  const queryConditions = {
    $and: [
      {
        $or: [
          { name: { $regex: new RegExp(itemNameLower, 'i') } },
          { description: { $regex: new RegExp(itemNameLower, 'i') } },
          ...namePatterns,
          ...descPatterns,
          // Also match by category if we determined one
          ...(itemCategory !== 'other' ? [{ category: itemCategory }] : [])
        ]
      },
      {
        isActive: true,
        status: 'approved' // Only show approved products to service providers
      }
    ]
  };
  
  // Try to find exact or similar product in database
  // Include both approved and pending products to find ALL suppliers
  const products = await Product.find(queryConditions)
  .populate({
    path: 'supplier',
    select: 'name company address',
    match: {} // Force fresh population
  })
  .sort({ status: 1, updatedAt: -1, createdAt: -1 }) // Sort approved first, then by updatedAt
  .lean(false); // Keep as Mongoose document for re-fetching
  
  console.log(`BOQ Normalize - Searching for "${rawName}" (category: ${itemCategory}): Found ${products.length} products`);

  if (products.length > 0) {
    const bestProduct = products[0];
    
    // Re-fetch the product to get the absolute latest data including location
    const productId = bestProduct._id.toString();
    const freshProduct = await Product.findOne({ 
      _id: productId,
      updatedAt: { $exists: true }
    })
      .select('name category price unit stock location description specifications images isActive status averageRating totalReviews supplier updatedAt')
      .populate({
        path: 'supplier',
        select: 'name company email phone address'
      })
      .lean(false)
      .maxTimeMS(5000);
    
    if (!freshProduct) {
      // Fallback to original product if re-fetch fails
      console.warn(`Failed to re-fetch product ${productId}, using cached data`);
    } else {
      // Convert to plain object to ensure we access the actual database values
      const productObj = freshProduct.toObject ? freshProduct.toObject() : freshProduct;
      console.log(`BOQ Normalize - Successfully re-fetched product ${productId}: Location="${productObj.location}", UpdatedAt="${productObj.updatedAt}"`);
    }
    
    // Use fresh product if available, otherwise fallback
    const productToUse = freshProduct || bestProduct;
    
    // Convert to plain object to ensure we get actual values, not Mongoose virtuals
    const productData = productToUse.toObject ? productToUse.toObject() : productToUse;
    
    // Re-fetch supplier separately to ensure latest supplier info
    let freshSupplier = null;
    if (productData.supplier && productData.supplier._id) {
      const supplierId = productData.supplier._id.toString();
      freshSupplier = await User.findOne({ 
        _id: supplierId,
        $or: [{ _id: supplierId }]
      })
        .select('name company email phone address')
        .lean()
        .maxTimeMS(5000);
      
      if (freshSupplier) {
        console.log(`BOQ Normalize - Re-fetched supplier ${supplierId}: Name="${freshSupplier.name}", Company="${freshSupplier.company}", City="${freshSupplier.address?.city || 'N/A'}", State="${freshSupplier.address?.state || 'N/A'}"`);
      }
    }
    
    // Count ALL available suppliers for this product (including pending status)
    // Use the same query conditions as the initial search to ensure consistency
    const allMatchingProducts = await Product.find(queryConditions)
    .select('supplier')
    .populate('supplier', '_id')
    .lean(false);
    
    // Count unique suppliers (re-fetch each to ensure fresh data)
    const uniqueSupplierIds = new Set();
    for (const prod of allMatchingProducts) {
      // Re-fetch product to get latest supplier data
      const freshProd = await Product.findOne({ _id: prod._id })
        .select('supplier')
        .populate('supplier', '_id')
        .lean(false);
      
      if (freshProd && freshProd.supplier && freshProd.supplier._id) {
        uniqueSupplierIds.add(freshProd.supplier._id.toString());
      } else if (prod.supplier && prod.supplier._id) {
        uniqueSupplierIds.add(prod.supplier._id.toString());
      }
    }
    
    const availableSuppliers = uniqueSupplierIds.size;
    console.log(`BOQ Normalize - Product "${rawName}": Found ${availableSuppliers} unique suppliers from ${allMatchingProducts.length} products`);
    
    // Get supplier info using fresh data
    const supplier = freshSupplier || productData.supplier;
    
    // IMPORTANT: Get location directly from the productData object (plain object from database)
    // This ensures we get the actual database value, not a cached or virtual value
    let latestLocation = '';
    if (productData && productData.location) {
      latestLocation = String(productData.location).trim();
    }
    
    // Log the raw location value for debugging
    console.log(`BOQ Normalize - Product ${productId}: Raw location from DB="${latestLocation}", ProductData location="${productData.location}", Type=${typeof productData.location}, UpdatedAt="${productData.updatedAt || 'N/A'}"`);
    
    // Clean up location string to remove duplicates
    let supplierLocation = latestLocation.trim();
    if (supplierLocation) {
      const locationWords = supplierLocation.toLowerCase().split(/\s+/);
      const uniqueWords = [...new Set(locationWords)];
      supplierLocation = uniqueWords.join(' ').trim();
      supplierLocation = supplierLocation.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    
    // If product location is empty, fallback to supplier address
    if (!supplierLocation || supplierLocation === '') {
      if (supplier && supplier.address) {
        const city = supplier.address.city || '';
        const state = supplier.address.state || '';
        supplierLocation = [city, state].filter(Boolean).join(', ').trim();
        console.log(`BOQ Normalize - Using supplier address: City="${city}", State="${state}", Combined="${supplierLocation}"`);
      }
      if (!supplierLocation || supplierLocation === '') {
        supplierLocation = 'Location not specified';
      }
    }
    
    console.log(`BOQ Normalize - Final location for product ${productId}: "${supplierLocation}"`);
    
    const supplierInfo = supplier ? {
      supplierName: supplier.name || supplier.company || 'Unknown',
      supplierLocation: supplierLocation,
      supplierCompany: supplier.company || ''
    } : null;

    // Calculate proper confidence score based on how well the product matches
    const productDescription = productData.description || '';
    const confidence = calculateMatchConfidence(rawName, bestProduct.name, productDescription);
    
    // Round confidence to 2 decimal places for cleaner display
    const roundedConfidence = Math.round(confidence * 100) / 100;

    return {
      normalizedName: bestProduct.name,
      productId: bestProduct._id,
      confidence: roundedConfidence,
      availableSuppliers: availableSuppliers,
      supplierInfo: supplierInfo,
      isAvailable: bestProduct.stock > 0
    };
  }

  // If no match found, clean and normalize the raw name
  const cleanedName = rawName.trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
  
  // For no match, calculate a low confidence based on category detection
  // If we detected a category, give it a small confidence boost
  let noMatchConfidence = 0.3; // Base confidence for no match
  if (itemCategory !== 'other') {
    noMatchConfidence = 0.4; // Slightly higher if category was detected
  }
  
  return {
    normalizedName: cleanedName,
    productId: null,
    confidence: noMatchConfidence,
    availableSuppliers: 0,
    supplierInfo: null,
    isAvailable: false
  };
};

// Helper function to determine unit and category from product name
const inferUnitAndCategory = (productName) => {
  const name = productName.toLowerCase();
  let unit = 'nos';
  let category = 'other';

  if (name.includes('steel') || name.includes('bar') || name.includes('rod') || name.includes('rebar')) {
    unit = 'kg';
    category = 'steel';
  } else if (name.includes('cement')) {
    unit = 'bag';
    category = 'cement';
  } else if (name.includes('sand') || name.includes('aggregate') || name.includes('gravel')) {
    unit = 'cft';
    category = 'aggregates';
  } else if (name.includes('brick') || name.includes('block')) {
    unit = 'nos';
    category = 'masonry';
  } else if (name.includes('wire') || name.includes('cable') || name.includes('switch')) {
    unit = 'meter';
    category = 'electrical';
  } else if (name.includes('pipe') || name.includes('fitting') || name.includes('tap')) {
    unit = 'meter';
    category = 'plumbing';
  } else if (name.includes('screw') || name.includes('nail') || name.includes('bolt')) {
    unit = 'nos';
    category = 'hardware';
  }

  return { unit, category };
};

router.post('/normalize', authenticateToken, isServiceProvider, upload.single('file'), async (req, res) => {
  try {
    // Log request with timestamp to verify cache-busting
    const timestamp = req.query._t || 'N/A';
    const random = req.query._r || 'N/A';
    console.log(`BOQ Normalize request received at ${new Date().toISOString()}, timestamp: ${timestamp}, random: ${random}`);
    
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let rawItems = [];

    // Parse file based on extension
    try {
      if (fileExtension === '.csv') {
        rawItems = await parseCSV(filePath);
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        rawItems = await parseExcel(filePath);
      } else if (fileExtension === '.pdf') {
        rawItems = await parsePDF(filePath);
      } else {
        // Try to detect file type by MIME type or try parsing as Excel first, then CSV
        const mimeType = req.file.mimetype;
        if (mimeType && (mimeType.includes('spreadsheet') || mimeType.includes('excel'))) {
          rawItems = await parseExcel(filePath);
        } else if (mimeType && mimeType.includes('csv')) {
          rawItems = await parseCSV(filePath);
        } else {
          // Try Excel first (most common), then CSV
          try {
            rawItems = await parseExcel(filePath);
          } catch (excelError) {
            try {
              rawItems = await parseCSV(filePath);
            } catch (csvError) {
              throw new Error(`Unsupported file format. Please upload CSV (.csv), Excel (.xlsx, .xls), or PDF (.pdf) format.`);
            }
          }
        }
      }
    } catch (parseError) {
      console.error('File parsing error:', parseError);
      // Clean up uploaded file
      try {
        await fs.remove(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
      
      // Provide user-friendly error message
      let errorMessage = 'Failed to parse file. ';
      if (parseError.message.includes('PDF')) {
        errorMessage += 'PDF files are not fully supported. Please convert your BOQ to CSV or Excel format (.csv, .xlsx) for better compatibility.';
      } else if (parseError.message.includes('CSV') || parseError.message.includes('Excel')) {
        errorMessage += 'Please ensure the file format is correct and contains valid data.';
      } else {
        errorMessage += parseError.message || 'Please ensure the file format is correct.';
      }
      
      return res.status(400).json({
        status: 'error',
        message: errorMessage,
        error: parseError.message
      });
    }

    // Clean up uploaded file after parsing
    await fs.remove(filePath);

    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No items found in the uploaded file'
      });
    }

    // Log first few rows for debugging
    console.log('Raw items sample (first 3 rows):', JSON.stringify(rawItems.slice(0, 3), null, 2));
    console.log('Total raw items:', rawItems.length);
    console.log('All raw items:', JSON.stringify(rawItems, null, 2));

    // Normalize items - map raw data to structured format
    const normalizedItems = [];
    for (let i = 0; i < rawItems.length; i++) {
      const rawItem = rawItems[i];
      
      // Get all column names (case-insensitive)
      const keys = Object.keys(rawItem);
      const lowerKeys = keys.map(k => k.toLowerCase());
      
      // Extract item data from various possible column names (case-insensitive)
      let description = '';
      let quantity = 0;
      let unit = 'nos';
      let rate = 0;
      
      // Find description - try multiple column name variations
      const descKeys = ['description', 'item', 'name', 'product', 'item description', 'item name', 'material', 'product name', 'item description', 'description of item'];
      for (const key of descKeys) {
        const foundKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey && rawItem[foundKey] && String(rawItem[foundKey]).trim()) {
          description = String(rawItem[foundKey]).trim();
          break;
        }
      }
      
      // If no description found, use first non-empty TEXT column (avoid pure numbers like "6000" or "5kg")
      if (!description) {
        for (const key of keys) {
          const value = rawItem[key];
          const str = String(value ?? '').trim();
          
          if (!str) continue;
          
          // Skip values that are purely numeric or simple number+unit like "6000", "5kg"
          const isPureNumber = /^[0-9.,]+$/.test(str);
          const isNumberWithUnit = /^[0-9.,]+\s*[a-zA-Z]+$/.test(str) && !/[a-zA-Z]/.test(str.replace(/^[0-9.,\s]+/, ''));
          
          if (isPureNumber || isNumberWithUnit) {
            continue;
          }

          // Prefer values that contain at least one letter (likely a product description)
          if (/[a-zA-Z]/.test(str)) {
            description = str;
            break;
          }
        }
      }
      
      // If still no description, try using the row index as a fallback
      if (!description || description.length === 0) {
        description = `Item ${i + 1}`;
        console.log(`Row ${i + 1}: Using fallback description`, rawItem);
      }
      
      // Find quantity - try multiple column name variations
      const qtyKeys = ['quantity', 'qty', 'qty.', 'amount', 'qty', 'quantity (nos)', 'qty (nos)', 'nos', 'number', 'count'];
      for (const key of qtyKeys) {
        const foundKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey) {
          const qtyValue = parseFloat(rawItem[foundKey]);
          if (!isNaN(qtyValue) && qtyValue > 0) {
            quantity = qtyValue;
            break;
          }
        }
      }
      
      // If quantity not found, try to find any numeric value in the row
      if (quantity <= 0) {
        for (const key of keys) {
          const value = parseFloat(rawItem[key]);
          if (!isNaN(value) && value > 0 && value < 1000000) { // Reasonable quantity range
            quantity = value;
            break;
          }
        }
      }
      
      // Find unit
      const unitKeys = ['unit', 'uom', 'unit of measure', 'uom.'];
      for (const key of unitKeys) {
        const foundKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey && rawItem[foundKey]) {
          unit = String(rawItem[foundKey]).trim().toLowerCase();
          break;
        }
      }
      
      // Find rate/price
      const rateKeys = ['rate', 'price', 'unit price', 'rate per unit', 'unit rate'];
      for (const key of rateKeys) {
        const foundKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey) {
          const rateValue = parseFloat(rawItem[foundKey]);
          if (!isNaN(rateValue)) {
            rate = rateValue;
            break;
          }
        }
      }

      // Log the extracted data for debugging
      console.log(`Row ${i + 1}: description="${description}", quantity=${quantity}, keys=${keys.join(', ')}`);
      
      // More lenient validation - always include the item if we have any data
      // Description is now guaranteed to have a value (fallback to "Item X")
      
      // If quantity is 0 or not found, default to 1
      if (quantity <= 0) {
        quantity = 1;
        console.log(`Row ${i + 1}: No quantity found, defaulting to 1`, rawItem);
      }

      // Normalize product name by matching with database
      const normalized = await normalizeProductName(description);
      const { unit: inferredUnit, category } = inferUnitAndCategory(normalized.normalizedName);

      normalizedItems.push({
        id: i + 1,
        rawName: description,
        normalizedName: normalized.normalizedName,
        quantity: quantity,
        unit: unit || inferredUnit,
        confidence: normalized.confidence,
        productId: normalized.productId,
        supplierInfo: normalized.supplierInfo,
        availableSuppliers: normalized.availableSuppliers || 0,
        isAvailable: normalized.isAvailable || false
      });
    }

    console.log(`Total normalized items: ${normalizedItems.length} out of ${rawItems.length} raw items`);
    
    if (normalizedItems.length === 0) {
      // Provide helpful error message with file structure info
      const sampleKeys = rawItems.length > 0 ? Object.keys(rawItems[0]) : [];
      return res.status(400).json({
        status: 'error',
        message: `No valid items found in the uploaded file. Found ${rawItems.length} rows. Detected columns: ${sampleKeys.join(', ')}. Please ensure your file has columns for item description/name and quantity.`,
        debug: {
          totalRows: rawItems.length,
          columns: sampleKeys,
          sampleRow: rawItems[0] || null
        }
      });
    }

    // Map normalized items to BOQ items format
    const boqItems = await Promise.all(normalizedItems.map(async (item) => {
      const { unit: inferredUnit, category } = inferUnitAndCategory(item.normalizedName);

      return {
        description: item.normalizedName,
        quantity: item.quantity,
        unit: item.unit || inferredUnit,
        category: category,
        normalizedProduct: item.productId,
        specifications: `Confidence: ${Math.round(item.confidence * 100)}%`
      };
    }));

    // Create BOQ document
    const boq = await BOQ.create({
      name: req.file.originalname.replace(/\.[^/.]+$/, '') || `BOQ-${Date.now()}`,
      description: 'BOQ created from uploaded file',
      serviceProvider: req.userId,
      items: boqItems,
      status: 'normalized',
      normalizedAt: new Date(),
      uploadedFile: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

    // Add processing log
    boq.addProcessingLog('normalized', `BOQ normalized successfully with ${normalizedItems.length} items`, req.userId);
    await boq.save();

    // Format items for frontend
    const formattedItems = normalizedItems.map((item) => ({
      ...item,
      boqId: boq._id.toString()
    }));

    res.json({ 
      items: formattedItems,
      boqId: boq._id.toString()
    });
  } catch (error) {
    console.error('BOQ normalization error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to normalize BOQ',
      error: error.message 
    });
  }
});

// Delete BOQ
router.delete('/:id', authenticateToken, isServiceProvider, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the BOQ and verify ownership
    const boq = await BOQ.findOne({ 
      _id: id, 
      serviceProvider: req.userId 
    });
    
    if (!boq) {
      return res.status(404).json({ 
        status: 'error',
        message: 'BOQ not found or you do not have permission to delete it' 
      });
    }
    
    // Delete uploaded file if it exists
    if (boq.uploadedFile && boq.uploadedFile.path) {
      try {
        const filePath = path.join(__dirname, '..', boq.uploadedFile.path);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      } catch (fileError) {
        console.error('Error deleting uploaded file:', fileError);
        // Continue with BOQ deletion even if file deletion fails
      }
    }
    
    // Delete the BOQ
    await BOQ.findByIdAndDelete(id);
    
    res.json({ 
      status: 'success',
      message: 'BOQ deleted successfully' 
    });
  } catch (error) {
    console.error('Delete BOQ error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to delete BOQ',
      error: error.message 
    });
  }
});

export { router as boqRouter };
