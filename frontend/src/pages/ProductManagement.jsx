import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Edit, 
  Search, 
  Eye,
  Save,
  X,
  Trash2,
  Clock,
  CheckCircle,
  Ban,
  Sparkles
} from 'lucide-react';
import './Dashboard.css';

const ProductManagement = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchNotifications();
    
    // Removed automatic polling - products will only be fetched on initial load
    // Users can manually refresh if needed
  }, []);

  // Fetch categories on initial load only
  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Removed automatic refresh on notifications - this was causing unwanted refreshes
  // Products will only refresh when user performs actions (add, update, delete)

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch categories from the Category collection
      const response = await fetch('/api/supplier/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      let categoryList = [];
      
      if (data.status === 'success') {
        categoryList = data.categories || [];
      }
      
      // Also get unique categories from existing products
      const uniqueProductCategories = [...new Set(products
        .map(p => p.category)
        .filter(cat => cat && cat.trim() !== '')
        .map(cat => cat.toLowerCase().trim())
      )];
      
      // Merge categories from Category collection with product categories
      const categoryMap = new Map();
      
      // Add categories from Category collection first (they have displayName)
      categoryList.forEach(cat => {
        const key = cat.name.toLowerCase().trim();
        categoryMap.set(key, {
          name: cat.name,
          displayName: cat.displayName || cat.name
        });
      });
      
      // Add product categories that aren't in the Category collection
      uniqueProductCategories.forEach(catName => {
        if (!categoryMap.has(catName)) {
          categoryMap.set(catName, {
            name: catName,
            displayName: catName.charAt(0).toUpperCase() + catName.slice(1)
          });
        }
      });
      
      // Convert map to array and sort
      const allCategories = Array.from(categoryMap.values()).sort((a, b) => 
        (a.displayName || a.name).localeCompare(b.displayName || b.name)
      );
      
      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-cache' // Prevent caching
      });
      const data = await response.json();
      if (data.status === 'success') {
        // Ensure all products have a status field (default to 'pending' if missing)
        const productsWithStatus = data.products.map(product => ({
          ...product,
          status: product.status || 'pending'
        }));
        setProducts(productsWithStatus);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (productData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      if (data.status === 'success') {
        setProducts([...products, data.product]);
        setShowAddModal(false);
        fetchProducts();
        alert('Product added successfully! It is now pending admin approval and will be visible to service providers once approved.');
      } else {
        alert(data.message || 'Failed to add product');
      }
    } catch (error) {
      console.error('Failed to add product:', error);
      alert('Failed to add product. Please try again.');
    }
  };

  const handleUpdateProduct = async (productId, productData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/supplier/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        // Ensure the updated product includes specifications
        const updatedProduct = {
          ...data.product,
          specifications: data.product.specifications || {}
        };
        
        console.log('✅ Product updated with specifications:', updatedProduct.specifications);
        console.log('✅ Specification keys:', Object.keys(updatedProduct.specifications || {}));
        
        // Update the products list with the updated product (including specifications)
        setProducts(products.map(p => 
          (p.id === productId || p._id === productId) ? updatedProduct : p
        ));
        
        // Close the modal
        setEditingItem(null);
        
        // Don't call fetchProducts() here as it might load stale data
        // The local state update above is sufficient
        alert('Product updated successfully!');
      } else {
        // Show specific error message from backend
        const errorMessage = data.message || (data.errors && data.errors.length > 0 ? data.errors[0] : 'Failed to update product');
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('Failed to update product. Please try again.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    // Show confirmation dialog
    const product = products.find(p => (p.id === productId || p._id === productId));
    const productName = product?.name || 'this product';
    
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/supplier/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        // Remove the product from the list
        setProducts(products.filter(p => (p.id !== productId && p._id !== productId)));
        alert('Product deleted successfully');
      } else {
        alert(data.message || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product. Please try again.');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    // Normalize category comparison (both should be lowercase for matching)
    const productCategory = (product.category || '').toLowerCase();
    const filterCategoryLower = filterCategory === 'all' ? 'all' : filterCategory.toLowerCase();
    const matchesCategory = filterCategoryLower === 'all' || productCategory === filterCategoryLower;
    const matchesStatus = filterStatus === 'all' || (product.status || 'pending') === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ maxWidth: '100%', padding: '2rem' }}>
      <div className="dashboard-header">
        <div>
          <h1>Manage Your Product</h1>
          <p>
            {user?.name && (
              <span style={{ fontWeight: '600', color: '#4f46e5' }}>{user.name}</span>
            )}
            {user?.name && ' - '}
            Manage your product catalog and inventory
          </p>
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginTop: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fbbf24',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#92400e'
            }}>
              <Clock size={16} />
              <span>Pending: {products.filter(p => (p.status || 'pending') === 'pending').length}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#d1fae5',
              borderRadius: '8px',
              border: '1px solid #10b981',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#065f46'
            }}>
              <CheckCircle size={16} />
              <span>Approved: {products.filter(p => p.status === 'approved').length}</span>
            </div>
            {products.filter(p => p.status === 'rejected').length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#fee2e2',
                borderRadius: '8px',
                border: '1px solid #ef4444',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#991b1b'
              }}>
                <Ban size={16} />
                <span>Rejected: {products.filter(p => p.status === 'rejected').length}</span>
              </div>
            )}
          </div>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <div className="dashboard-content" style={{ gridTemplateColumns: '1fr', width: '100%' }}>
        <div className="dashboard-section" style={{ width: '100%' }}>
          <div className="section-header">
            <h2>All Products</h2>
            <div className="section-controls">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.displayName || cat.name}
                  </option>
                ))}
              </select>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          
          <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', width: '100%' }}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const productStatus = product.status || 'pending';
                const statusConfig = {
                  pending: {
                    label: 'Pending Approval',
                    icon: Clock,
                    color: '#d97706',
                    bgColor: '#fef3c7',
                    borderColor: '#fbbf24'
                  },
                  approved: {
                    label: 'Approved',
                    icon: CheckCircle,
                    color: '#059669',
                    bgColor: '#d1fae5',
                    borderColor: '#10b981'
                  },
                  rejected: {
                    label: 'Rejected',
                    icon: Ban,
                    color: '#dc2626',
                    bgColor: '#fee2e2',
                    borderColor: '#ef4444'
                  }
                };
                const status = statusConfig[productStatus] || statusConfig.pending;
                const StatusIcon = status.icon;
                
                return (
                <div 
                  key={product.id || product._id} 
                  className="product-card" 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    border: productStatus === 'pending' ? `2px solid ${status.borderColor}` : '1px solid #e5e7eb',
                    background: productStatus === 'pending' ? '#fffbeb' : 'white',
                    position: 'relative'
                  }}
                >
                  {/* Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: status.bgColor,
                    color: status.color,
                    border: `1px solid ${status.borderColor}`,
                    zIndex: 10
                  }}>
                    <StatusIcon size={14} />
                    <span>{status.label}</span>
                  </div>
                  
                  <div className="product-info" style={{ flex: 1, paddingTop: '2.5rem' }}>
                    {user?.name && (
                      <div style={{ 
                        fontSize: '1rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontWeight: '600',
                        marginBottom: '0.75rem',
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Supplier: <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '1rem' }}>{user.name}</span>
                      </div>
                    )}
                    <h4 style={{ 
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '0.5rem',
                      lineHeight: '1.4'
                    }}>{product.name}</h4>
                    <p className="product-category" style={{ marginBottom: '1rem' }}>{product.category}</p>
                    
                    {productStatus === 'pending' && (
                      <div style={{
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        borderRadius: '8px',
                        background: '#fef3c7',
                        border: '1px solid #fbbf24',
                        fontSize: '0.875rem',
                        color: '#92400e'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                          <Clock size={16} />
                          Awaiting Admin Approval
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#78350f' }}>
                          Your product is pending review. It will be visible to service providers once approved.
                        </div>
                      </div>
                    )}
                    
                    {productStatus === 'rejected' && product.rejectionReason && (
                      <div style={{
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        borderRadius: '8px',
                        background: '#fee2e2',
                        border: '1px solid #ef4444',
                        fontSize: '0.875rem',
                        color: '#991b1b'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                          <Ban size={16} />
                          Rejected
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#7f1d1d' }}>
                          <strong>Reason:</strong> {product.rejectionReason}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      marginTop: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', minWidth: '60px' }}>Price:</span>
                        <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: '600' }}>{product.price} per {product.unit}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', minWidth: '60px' }}>Stock:</span>
                        <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: '600' }}>{product.stock} {product.unit}</span>
                      </div>
                      {product.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', minWidth: '60px' }}>📍</span>
                          <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', textTransform: 'capitalize' }}>{product.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="product-actions" style={{ 
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem'
                  }}>
                    <button 
                      className="btn-icon"
                      onClick={() => setEditingItem(product)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        color: '#3b82f6'
                      }}
                      title="Edit product"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="btn-icon"
                      onClick={() => handleDeleteProduct(product.id || product._id)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        color: '#ef4444'
                      }}
                      title="Delete product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                );
              })
            ) : (
              <div className="empty-state">
                <Package size={48} />
                <h3>No products found</h3>
                <p>Add products to your catalog to start receiving orders</p>
                <button 
                  className="btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  Add Product
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <ProductModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddProduct}
        />
      )}

      {/* Edit Product Modal */}
      {editingItem && (
        <ProductModal
          product={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(data) => {
            const productId = editingItem.id || editingItem._id;
            handleUpdateProduct(productId, data);
          }}
        />
      )}
    </div>
  );
};

const ProductModal = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || '',
    price: product?.price || '',
    unit: product?.unit || '',
    stock: product?.stock || '',
    location: product?.location || '',
    description: product?.description || ''
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  
  // Product type selection state
  const [productType, setProductType] = useState(product ? null : 'existing_category');
  
  // Category and Unit states
  const [categories, setCategories] = useState([]);
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryInputRef = useRef(null);
  const categorySuggestionsRef = useRef(null);
  
  const [units, setUnits] = useState([]);
  const [unitSuggestions, setUnitSuggestions] = useState([]);
  const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);
  const unitInputRef = useRef(null);
  const unitSuggestionsRef = useRef(null);
  
  // Track previous category to detect actual changes
  const previousCategoryRef = useRef(null);
  
  // Extract Specifications state
  const [extracting, setExtracting] = useState(false); // For extracting specs from description
  const [aiProvider, setAiProvider] = useState('auto'); // 'auto', 'openai', 'gemini', 'claude' - for extract specs only
  // Initialize specifications: for existing products, use their specs; for new products, start empty
  const [specifications, setSpecifications] = useState(() => {
    if (product && product.specifications) {
      return product.specifications;
    }
    return {}; // Start with empty object for new products
  });

  // Update specifications when product prop changes (e.g., when modal reopens after update)
  // This ensures specifications are loaded when editing an existing product
  useEffect(() => {
    if (product) {
      const productSpecs = product.specifications;
      
      // Only update if product has specifications and they're different from current state
      if (productSpecs && typeof productSpecs === 'object' && !Array.isArray(productSpecs)) {
        const productSpecKeys = Object.keys(productSpecs);
        const currentSpecKeys = Object.keys(specifications);
        
        // Update if:
        // 1. Product has specs and current state is empty (initial load)
        // 2. Product has different/more keys than current state (product was updated)
        if (productSpecKeys.length > 0) {
          const specsChanged = JSON.stringify(productSpecs) !== JSON.stringify(specifications);
          if (currentSpecKeys.length === 0 || specsChanged) {
            console.log('🔄 Syncing specifications from product:', productSpecKeys);
            setSpecifications({ ...productSpecs });
          }
        }
      } else if (!productSpecs && Object.keys(specifications).length === 0) {
        // Product has no specs and we have none - ensure we start with empty object
        setSpecifications({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.specifications]);

  // Debug: Log when specifications change
  useEffect(() => {
    console.log('📊 [SPECS STATE] Specifications changed:', specifications);
    console.log('📊 [SPECS STATE] Number of keys:', Object.keys(specifications).length);
    console.log('📊 [SPECS STATE] Keys:', Object.keys(specifications));
    console.log('📊 [SPECS STATE] Will display:', specifications && Object.keys(specifications).length > 0);
  }, [specifications]);

  const fetchSuggestions = async (query) => {
    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/supplier/products/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(data.suggestions && data.suggestions.length > 0);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setFormData({...formData, name: value});
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Debounce the search - wait 300ms after user stops typing
    const timeout = setTimeout(() => {
      if (value.trim().length > 0) {
        fetchSuggestions(value);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    
    setSearchTimeout(timeout);
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData({
      ...formData,
      name: suggestion.name,
      category: suggestion.category || formData.category
    });
    setSuggestions([]);
    setShowSuggestions(false);
    // Focus back on input after selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuggestions([]);
    setShowSuggestions(false);
    
    // Include ALL specifications in the product data (both predefined and dynamic from AI)
    // IMPORTANT: Keep ALL keys even if values are null/empty - admin needs to see all AI-generated keys
    const allSpecifications = { ...specifications };
    
    // Keep ALL specification keys, even if they have null/empty values
    // This allows admin to see what keys were generated by AI and fill them in
    // Only remove keys that are completely undefined
    Object.keys(allSpecifications).forEach(key => {
      const value = allSpecifications[key];
      // Only remove if completely undefined
      if (value === undefined) {
        delete allSpecifications[key];
      }
      // Keep null, empty string, and empty arrays - they show keys that need values
    });
    
    const productData = {
      ...formData,
      specifications: allSpecifications
    };
    
    console.log('💾 Saving product with specifications:', allSpecifications);
    console.log('💾 Specification keys count:', Object.keys(allSpecifications).length);
    console.log('💾 Specification keys:', Object.keys(allSpecifications));
    
    onSave(productData);
  };

  // Fetch categories and units on mount
  useEffect(() => {
    fetchCategories();
    fetchUnits();
  }, []);

  // Initialize category and unit suggestions when data is loaded
  useEffect(() => {
    if (categories.length > 0 && formData.category) {
      const filtered = categories.filter(cat => 
        cat.name.toLowerCase() === formData.category.toLowerCase() ||
        (cat.displayName || cat.name).toLowerCase().includes(formData.category.toLowerCase())
      );
      setCategorySuggestions(filtered.length > 0 ? filtered : categories);
    } else if (categories.length > 0) {
      setCategorySuggestions(categories);
    }
  }, [categories, formData.category]);

  // Auto-load admin-defined specs when category changes (for new products AND pending products)
  // IMPORTANT: This ONLY watches category changes - product name is completely ignored
  // When category changes, it loads admin specs for that category regardless of product name
  useEffect(() => {
    // If editing an existing product, only auto-load for pending products
    if (product && (product.status || 'pending') !== 'pending') {
      previousCategoryRef.current = formData.category;
      return;
    }

    // Get current category (product name is NOT used here)
    const currentCategory = formData.category ? formData.category.trim().toLowerCase() : '';
    const previousCategory = previousCategoryRef.current ? previousCategoryRef.current.trim().toLowerCase() : null;

    // Only proceed if category actually changed
    if (currentCategory === previousCategory) {
      return; // Category hasn't changed, don't reload specs
    }

    // Update the ref to track current category
    previousCategoryRef.current = formData.category;

    // Clear specs immediately when category changes (before loading new ones)
    // This prevents showing old specs from previous category
    setSpecifications({});

    // Only if category is set and categories are loaded
    // Product name is NOT checked - only category matters
    if (currentCategory && categories.length > 0) {
      // Check if the category matches an existing category
      const matchedCategory = categories.find(cat => 
        cat.name.toLowerCase() === currentCategory ||
        (cat.displayName || cat.name).toLowerCase() === currentCategory
      );

      if (matchedCategory) {
        // Category matches - load its admin-defined specs (product name irrelevant)
        console.log('🔄 Category changed to:', matchedCategory.name, '- Loading admin specs for this category (product name ignored)...');
        loadCategorySpecifications(matchedCategory.name);
      } else {
        // Category doesn't match - specs already cleared above
        console.log('🔄 Category does not match any existing category - Specs cleared');
      }
    } else if (!currentCategory) {
      // Category is empty - specs already cleared above
      console.log('🔄 Category cleared - Specs cleared');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.category, categories, product]);

  useEffect(() => {
    if (units.length > 0 && formData.unit) {
      const filtered = units.filter(unit => 
        unit.name.toLowerCase() === formData.unit.toLowerCase() ||
        (unit.displayName || unit.name).toLowerCase().includes(formData.unit.toLowerCase())
      );
      setUnitSuggestions(filtered.length > 0 ? filtered : units);
    } else if (units.length > 0) {
      setUnitSuggestions(units);
    }
  }, [units, formData.unit]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchUnits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/units', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setUnits(data.units || []);
      }
    } catch (error) {
      console.error('Failed to fetch units:', error);
    }
  };

  // Helper function to load admin-defined specifications for a category
  // IMPORTANT: This function ONLY uses category name - product name is completely ignored
  // When a category is selected, it loads admin-defined specs for that category regardless of product name
  const loadCategorySpecifications = async (categoryName) => {
    // Auto-load specs for:
    // - new products
    // - existing products that are still pending approval (supplier can still edit)
    // Do NOT auto-load for approved/rejected products to avoid overwriting existing data.
    if (product && (product.status || 'pending') !== 'pending') {
      console.log('⏭️ Skipping spec load - editing non-pending product');
      return;
    }

    // Snapshot existing specs BEFORE we clear state (used to preserve already-entered values for pending edits)
    const existingSpecsSnapshot =
      specifications && typeof specifications === 'object' && !Array.isArray(specifications)
        ? { ...specifications }
        : {};

    if (!categoryName || !categoryName.trim()) {
      // If category is cleared, clear specs too
      console.log('🧹 Category is empty - clearing specs');
      setSpecifications({});
      return;
    }

    // Normalize category name (product name is NOT used here - only category matters)
    const normalizedCategoryName = categoryName.trim().toLowerCase();
    console.log('🔍 Loading specifications for category:', normalizedCategoryName, '(product name is ignored)');

    // IMPORTANT: Clear specs immediately when switching categories
    // This prevents showing old specs from previous category while API call is in progress
    setSpecifications({});

    try {
      const token = localStorage.getItem('token');
      const apiUrl = `/api/supplier/categories/${encodeURIComponent(normalizedCategoryName)}/specifications`;
      console.log('📡 API URL:', apiUrl);
      
      const resp = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-cache' // Ensure we always get fresh data
      });
      
      console.log('📥 API Response status:', resp.status);
      
      if (resp.ok) {
        const data = await resp.json();
        console.log('📦 API Response data:', JSON.stringify(data, null, 2));
        console.log('📦 API Response specifications:', data.specifications);
        console.log('📦 API Response specifications type:', typeof data.specifications);
        console.log('📦 API Response specifications is array?', Array.isArray(data.specifications));
        console.log('📦 API Response specifications keys:', data.specifications ? Object.keys(data.specifications) : 'none');
        console.log('📦 API Response specifications keys count:', data.specifications ? Object.keys(data.specifications).length : 0);
        console.log('📦 API Response specifications full object:', JSON.stringify(data.specifications, null, 2));
        
        if (data.status === 'success') {
          // Check if specifications exist and have keys
          // IMPORTANT: Even if values are null, we want to show the keys
          const specsObj = data.specifications || {};
          const specKeys = Object.keys(specsObj);
          const hasSpecs = specKeys.length > 0;
          
          console.log('🔍 Checking specs - Keys found:', specKeys.length, '- Keys:', specKeys);
          console.log('🔍 Has specs?', hasSpecs);
          
          if (hasSpecs) {
            // Admin has saved spec KEYS for this category (values are typically null placeholders).
            // IMPORTANT behavior:
            // - keys must match the category template (template keys only)
            // - for pending edits, preserve any existing values for keys that are in the template
            const newSpecs = {};
            Object.keys(specsObj).forEach((k) => {
              if (Object.prototype.hasOwnProperty.call(existingSpecsSnapshot, k)) {
                newSpecs[k] = existingSpecsSnapshot[k];
              } else {
                newSpecs[k] = specsObj[k];
              }
            });
            console.log('✅ Setting specifications for category:', normalizedCategoryName);
            console.log('✅ Specs object:', newSpecs);
            console.log('✅ Specs keys:', Object.keys(newSpecs));
            console.log('✅ Specs keys count:', Object.keys(newSpecs).length);
            console.log('✅ Full specs object:', JSON.stringify(newSpecs, null, 2));
            setSpecifications(newSpecs);
            
            // Force a small delay to ensure state update is processed
            setTimeout(() => {
              console.log('✅ [AFTER SET] Current specifications state should have keys:', Object.keys(newSpecs).length);
            }, 100);
          } else {
            // Admin hasn't saved specs for this category - ensure specs are empty
            console.log('ℹ️ No admin-defined specifications found for category:', normalizedCategoryName, '- Specs object is empty or has no keys');
            console.log('ℹ️ Specs object was:', specsObj);
            setSpecifications({});
          }
        } else {
          // API returned error status - clear specs
          console.log('ℹ️ API returned error status - Clearing specs');
          setSpecifications({});
        }
      } else if (resp.status === 404) {
        // Category not found - clear specs
        console.log('ℹ️ Category not found (404) for:', normalizedCategoryName, '- Keeping specs empty');
        setSpecifications({});
      } else {
        console.error('❌ API error:', resp.status, resp.statusText);
        // On API error, keep specs empty
        setSpecifications({});
      }
    } catch (err) {
      console.error('❌ Failed to load default specifications for category:', normalizedCategoryName, err);
      // On error, ensure specs are cleared
      setSpecifications({});
    }
  };

  const handleCategoryChange = async (e) => {
    const value = e.target.value;
    setFormData({...formData, category: value});
    
    // Filter categories based on input
    if (value.trim().length > 0) {
      const filtered = categories.filter(cat => 
        (cat.displayName || cat.name).toLowerCase().includes(value.toLowerCase())
      );
      setCategorySuggestions(filtered);
      setShowCategorySuggestions(true);
    } else {
      setCategorySuggestions(categories);
      setShowCategorySuggestions(true);
    }

    // If user manually types a category name that matches an existing category,
    // load specs for that category (product name is completely ignored)
    if (value.trim().length > 0 && (!product || (product && (product.status || 'pending') === 'pending'))) {
      // Check if the typed value exactly matches a category name
      // Product name is NOT checked - only category matters
      const matchedCategory = categories.find(cat => 
        cat.name.toLowerCase() === value.trim().toLowerCase() ||
        (cat.displayName || cat.name).toLowerCase() === value.trim().toLowerCase()
      );
      
      if (matchedCategory) {
        // User typed a valid category name - load its specs (product name irrelevant)
        console.log('📝 Category typed:', matchedCategory.name, '- Loading specs for this category only...');
        await loadCategorySpecifications(matchedCategory.name);
      } else {
        // User is typing but hasn't matched a category yet - clear specs
        setSpecifications({});
      }
    } else if (!value.trim() && (!product || (product && (product.status || 'pending') === 'pending'))) {
      // Category field cleared - clear specs
      setSpecifications({});
    }
  };

  const handleCategorySelect = async (category) => {
    // Use the actual category name (lowercase) from the database, not displayName
    // IMPORTANT: Product name is completely ignored - only category matters
    const updatedCategory = category.name || category.displayName || category;
    
    // Reset previous category ref to ensure useEffect detects the change
    previousCategoryRef.current = null;
    
    // Update form data first - this will trigger the useEffect
    // Store the actual category name (lowercase) in formData
    // Product name in formData is NOT used for loading specs
    setFormData({...formData, category: updatedCategory});
    setShowCategorySuggestions(false);

    // ALWAYS load admin-defined specs for the selected category (new products + pending edits)
    // This loads specs based ONLY on category - product name is irrelevant
    console.log('📋 Category selected:', updatedCategory, '- Loading admin specs for this category only (product name ignored)...');
    await loadCategorySpecifications(updatedCategory);
  };

  const handleCategoryCreate = async () => {
    const categoryName = formData.category.trim();
    if (!categoryName) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: categoryName })
      });
      const data = await response.json();
      if (data.status === 'success') {
        await fetchCategories();
        const createdCategoryName = data.category.name;
        setFormData({...formData, category: createdCategoryName});
        setShowCategorySuggestions(false);
        
        // Load admin-defined specs for this category (if any exist)
        await loadCategorySpecifications(createdCategoryName);
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleUnitChange = (e) => {
    const value = e.target.value;
    setFormData({...formData, unit: value});
    
    // Filter units based on input
    if (value.trim().length > 0) {
      const filtered = units.filter(unit => 
        (unit.displayName || unit.name).toLowerCase().includes(value.toLowerCase())
      );
      setUnitSuggestions(filtered);
      setShowUnitSuggestions(true);
    } else {
      setUnitSuggestions(units);
      setShowUnitSuggestions(true);
    }
  };

  const handleUnitSelect = async (unit) => {
    setFormData({...formData, unit: unit.name});
    setShowUnitSuggestions(false);
  };

  const handleUnitCreate = async () => {
    const unitName = formData.unit.trim();
    if (!unitName) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: unitName })
      });
      const data = await response.json();
      if (data.status === 'success') {
        await fetchUnits();
        setFormData({...formData, unit: data.unit.name});
        setShowUnitSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to create unit:', error);
    }
  };


  // Extract specifications from description
  const handleExtractSpecifications = async () => {
    if (!formData.description || !formData.description.trim()) {
      alert('Please enter a description with specification key-value pairs first');
      return;
    }

    if (!formData.category || !formData.category.trim()) {
      alert('Please select a category first. Category is required to properly extract and validate specifications.');
      return;
    }

    setExtracting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier/products/extract-specifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: formData.description,
          category: formData.category,
          productName: formData.name,
          provider: aiProvider,
          existingSpecifications: specifications || {} // Send existing specs so backend only fills values for these keys
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Extract Specifications Response:', data);
      
      // Handle warning status (category mismatch - extraction blocked)
      if (data.status === 'warning') {
        alert(`⚠️ ${data.categoryMismatchWarning || data.message || 'Category and description do not match.'}`);
        return; // Don't extract specifications if there's a mismatch
      }
      
      if (data.status === 'success') {
        // Show category mismatch warning if present (but still allow extraction)
        if (data.categoryMismatchWarning) {
          alert(`⚠️ ${data.categoryMismatchWarning}`);
        }
        
        // Only fill values for existing specification keys (don't add new keys)
        const extractedSpecs = data.specifications || {};
        const currentSpecs = specifications || {};
        
        // Merge: extracted specs only fill values for existing keys, keep all existing keys
        const mergedSpecs = { ...currentSpecs };
        // Only update values for keys that already exist
        Object.keys(extractedSpecs).forEach(key => {
          if (currentSpecs.hasOwnProperty(key)) {
            mergedSpecs[key] = extractedSpecs[key];
          }
        });
          
          setSpecifications(mergedSpecs);
        console.log('✅ Specifications extracted from description:', extractedSpecs);
        console.log('✅ Total specifications after merge:', mergedSpecs);

        const providerName = data.provider === 'openai' ? 'ChatGPT' : data.provider === 'gemini' ? 'Gemini' : data.provider === 'claude' ? 'Claude' : 'AI';
        const count = data.extractedCount || Object.keys(extractedSpecs).length;
        if (count > 0) {
          const warningNote = data.categoryMismatchWarning 
            ? ' However, please verify that the category matches the description.'
            : '';
          alert(`✅ Successfully extracted ${count} specification${count > 1 ? 's' : ''} from description using ${providerName}!${warningNote}`);
      } else {
          alert(`⚠️ No specifications found in the description. Please ensure your description contains key-value pairs like "Grade: OPC 53" or "Compressive Strength: 53 MPa".`);
        }
      } else {
        alert(data.message || 'Failed to extract specifications from description. Please try again.');
      }
    } catch (error) {
      console.error('Extract specifications error:', error);
      alert(`Failed to extract specifications: ${error.message}. Please check your API keys configuration and try again.`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{product ? 'Edit Product' : 'Add New Product'}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group" style={{ position: 'relative', marginBottom: '1rem' }}>
              <label>Product Name</label>
              <input
                ref={inputRef}
                type="text"
                value={formData.name}
                onChange={handleNameChange}
                onFocus={() => {
                  if (formData.name.trim().length > 0 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  } else if (!product) {
                    // Show dropdown with options even when no suggestions or when field is empty
                    setShowSuggestions(true);
                  }
                }}
                onBlur={(e) => {
                  // Check if the blur is due to clicking on a suggestion
                  if (suggestionsRef.current && suggestionsRef.current.contains(e.relatedTarget)) {
                    return;
                  }
                  // Delay hiding suggestions to allow click on suggestion
                  setTimeout(() => {
                    if (!suggestionsRef.current || !suggestionsRef.current.contains(document.activeElement)) {
                      setShowSuggestions(false);
                    }
                  }, 200);
                }}
                required
                autoComplete="off"
                style={{ width: '100%' }}
              />
              {showSuggestions && !product && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 10000,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    overflowX: 'visible',
                    marginTop: '4px',
                    padding: '4px 0',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking on dropdown
                    e.preventDefault();
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSuggestionClick(suggestion);
                      }}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background-color 0.15s ease',
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        minHeight: 'auto',
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        wordBreak: 'break-word',
                        overflow: 'visible',
                        overflowWrap: 'break-word'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <div style={{ 
                        fontWeight: '500', 
                        color: '#1e293b',
                        fontSize: '0.9375rem',
                        flex: '1 1 auto',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        lineHeight: '1.5',
                        minWidth: 0,
                        width: '100%',
                        maxWidth: 'none',
                        paddingRight: '0.5rem',
                        display: 'block',
                        boxSizing: 'border-box'
                      }}>
                        {suggestion.name}
                      </div>
                      {suggestion.category && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '0.375rem 0.625rem',
                          borderRadius: '6px',
                          textTransform: 'capitalize',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          alignSelf: 'flex-start',
                          marginTop: '0.125rem'
                        }}>
                          {suggestion.category}
                        </span>
                      )}
                    </div>
                  ))}
                  {!product && (
                    <>
                      {suggestions.length > 0 && (
                        <div style={{
                          height: '1px',
                          background: '#e5e7eb',
                          margin: '0.5rem 0'
                        }} />
                      )}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProductType('existing_category');
                          setShowSuggestions(false);
                        }}
                        style={{
                          padding: '0.875rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          background: productType === 'existing_category' ? '#f0f9ff' : 'white',
                          color: productType === 'existing_category' ? '#0369a1' : '#1e293b',
                          fontWeight: productType === 'existing_category' ? '600' : '500',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (productType !== 'existing_category') {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (productType !== 'existing_category') {
                            e.currentTarget.style.backgroundColor = productType === 'existing_category' ? '#f0f9ff' : 'white';
                          }
                        }}
                      >
                        Add new product in existing category
                      </div>
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProductType('new_category');
                          setShowSuggestions(false);
                        }}
                        style={{
                          padding: '0.875rem 1rem',
                          cursor: 'pointer',
                          background: productType === 'new_category' ? '#f0f9ff' : 'white',
                          color: productType === 'new_category' ? '#0369a1' : '#1e293b',
                          fontWeight: productType === 'new_category' ? '600' : '500',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (productType !== 'new_category') {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (productType !== 'new_category') {
                            e.currentTarget.style.backgroundColor = productType === 'new_category' ? '#f0f9ff' : 'white';
                          }
                        }}
                      >
                        Add new product and new category
                      </div>
                    </>
                  )}
                </div>
              )}
              {showSuggestions && product && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 10000,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    overflowX: 'visible',
                    marginTop: '4px',
                    padding: '4px 0',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking on dropdown
                    e.preventDefault();
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSuggestionClick(suggestion);
                      }}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderBottom: index < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background-color 0.15s ease',
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        minHeight: 'auto',
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        wordBreak: 'break-word',
                        overflow: 'visible',
                        overflowWrap: 'break-word'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <div style={{ 
                        fontWeight: '500', 
                        color: '#1e293b',
                        fontSize: '0.9375rem',
                        flex: '1 1 auto',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        lineHeight: '1.5',
                        minWidth: 0,
                        width: '100%',
                        maxWidth: 'none',
                        paddingRight: '0.5rem',
                        display: 'block',
                        boxSizing: 'border-box'
                      }}>
                        {suggestion.name}
                      </div>
                      {suggestion.category && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '0.375rem 0.625rem',
                          borderRadius: '6px',
                          textTransform: 'capitalize',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          alignSelf: 'flex-start',
                          marginTop: '0.125rem'
                        }}>
                          {suggestion.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="form-group" style={{ 
              position: 'relative',
              opacity: showSuggestions && suggestions.length > 0 ? 0.3 : 1,
              pointerEvents: showSuggestions && suggestions.length > 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s ease',
              overflow: 'visible',
              zIndex: showCategorySuggestions ? 1000 : 1
            }}>
              <label>Category</label>
              <input
                ref={categoryInputRef}
                type="text"
                value={formData.category}
                onChange={handleCategoryChange}
                onFocus={() => {
                  if (categories.length > 0) {
                    setCategorySuggestions(categories);
                    setShowCategorySuggestions(true);
                  }
                }}
                onBlur={(e) => {
                  if (categorySuggestionsRef.current && categorySuggestionsRef.current.contains(e.relatedTarget)) {
                    return;
                  }
                  setTimeout(() => {
                    if (!categorySuggestionsRef.current || !categorySuggestionsRef.current.contains(document.activeElement)) {
                      setShowCategorySuggestions(false);
                    }
                  }, 200);
                }}
                placeholder="Select or type a new category"
                required
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {showCategorySuggestions && (
                <div
                  ref={categorySuggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 10001,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    overflowX: 'visible',
                    marginTop: '4px',
                    padding: '4px 0',
                    width: '100%',
                    minWidth: '100%',
                    boxSizing: 'border-box',
                    wordWrap: 'break-word'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {categorySuggestions.length > 0 ? (
                    categorySuggestions.map((cat, index) => (
                      <div
                        key={index}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCategorySelect(cat);
                        }}
                        style={{
                          padding: '0.875rem 1rem',
                          cursor: 'pointer',
                          borderBottom: index < categorySuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'background-color 0.15s ease',
                          overflow: 'visible',
                          overflowWrap: 'break-word',
                          wordBreak: 'break-word',
                          whiteSpace: 'normal',
                          textOverflow: 'clip',
                          width: '100%',
                          boxSizing: 'border-box',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <span style={{
                          display: 'block',
                          width: '100%',
                          overflow: 'visible',
                          wordWrap: 'break-word',
                          whiteSpace: 'normal',
                          textAlign: 'left',
                          lineHeight: '1.5'
                        }}>
                          {cat.displayName || cat.name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.875rem 1rem', color: '#64748b' }}>
                      No matching categories
                    </div>
                  )}
                  {formData.category.trim() && !categorySuggestions.some(cat => cat.name.toLowerCase() === formData.category.trim().toLowerCase()) && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCategoryCreate();
                      }}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderTop: '1px solid #e5e7eb',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f9ff';
                      }}
                    >
                      <Plus size={16} />
                      Create "{formData.category.trim()}"
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="form-group" style={{ 
              opacity: showSuggestions && suggestions.length > 0 ? 0.3 : 1,
              pointerEvents: showSuggestions && suggestions.length > 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s ease',
              position: 'relative',
              zIndex: showCategorySuggestions ? 1 : 'auto'
            }}>
              <label>Price</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group" style={{ 
              position: 'relative',
              opacity: showSuggestions && suggestions.length > 0 ? 0.3 : 1,
              pointerEvents: showSuggestions && suggestions.length > 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s ease',
              zIndex: showCategorySuggestions ? 1 : (showUnitSuggestions ? 1000 : 'auto')
            }}>
              <label>Unit</label>
              <input
                ref={unitInputRef}
                type="text"
                value={formData.unit}
                onChange={handleUnitChange}
                onFocus={() => {
                  if (units.length > 0) {
                    setUnitSuggestions(units);
                    setShowUnitSuggestions(true);
                  }
                }}
                onBlur={(e) => {
                  if (unitSuggestionsRef.current && unitSuggestionsRef.current.contains(e.relatedTarget)) {
                    return;
                  }
                  setTimeout(() => {
                    if (!unitSuggestionsRef.current || !unitSuggestionsRef.current.contains(document.activeElement)) {
                      setShowUnitSuggestions(false);
                    }
                  }, 200);
                }}
                placeholder="Select or type a new unit"
                required
                autoComplete="off"
                style={{ width: '100%' }}
              />
              {showUnitSuggestions && (
                <div
                  ref={unitSuggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 10002,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    marginTop: '4px',
                    padding: '4px 0',
                    width: '100%'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {unitSuggestions.length > 0 ? (
                    unitSuggestions.map((unit, index) => (
                      <div
                        key={index}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnitSelect(unit);
                        }}
                        style={{
                          padding: '0.875rem 1rem',
                          cursor: 'pointer',
                          borderBottom: index < unitSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        {unit.displayName || unit.name}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.875rem 1rem', color: '#64748b' }}>
                      No matching units
                    </div>
                  )}
                  {formData.unit.trim() && !unitSuggestions.some(unit => unit.name.toLowerCase() === formData.unit.trim().toLowerCase()) && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnitCreate();
                      }}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderTop: '1px solid #e5e7eb',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f9ff';
                      }}
                    >
                      <Plus size={16} />
                      Create "{formData.unit.trim()}"
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="form-group" style={{ 
              opacity: showSuggestions && suggestions.length > 0 ? 0.3 : 1,
              pointerEvents: showSuggestions && suggestions.length > 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s ease'
            }}>
              <label>Stock Quantity</label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group span-2" style={{ 
              opacity: showSuggestions && suggestions.length > 0 ? 0.3 : 1,
              pointerEvents: showSuggestions && suggestions.length > 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s ease'
            }}>
              <label>Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="Enter your business location"
                required
              />
            </div>
            
            <div className="form-group span-2" style={{ 
              opacity: showSuggestions && suggestions.length > 0 ? 0.3 : 1,
              pointerEvents: showSuggestions && suggestions.length > 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s ease'
            }}>
              <label>
                <span>Description</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                placeholder="Enter product description. If you write specifications in the description (e.g., 'Grade: OPC 53, Compressive Strength: 53 MPa'), click 'Extract Specifications' below to automatically fill the specification fields."
              />
              {/* Extract Specifications Button */}
              {formData.description && formData.description.trim() && (
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                  {(!formData.category || !formData.category.trim()) && (
                    <span style={{ fontSize: '0.75rem', color: '#dc2626', fontStyle: 'italic' }}>
                      ⚠️ Category required for extraction
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleExtractSpecifications}
                    disabled={extracting || !formData.description || !formData.description.trim() || !formData.category || !formData.category.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.375rem 0.75rem',
                      background: extracting ? '#9ca3af' : (!formData.category || !formData.category.trim()) ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: extracting || !formData.description || !formData.description.trim() || !formData.category || !formData.category.trim() ? 'not-allowed' : 'pointer',
                      opacity: extracting || !formData.description || !formData.description.trim() || !formData.category || !formData.category.trim() ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    title={(!formData.category || !formData.category.trim()) 
                      ? "Please select a category first to extract specifications"
                      : "Extract specification key-value pairs from the description above using AI. Category and description must match."}
                  >
                    <Sparkles size={14} />
                    <span>{extracting ? 'Extracting...' : 'Extract Specifications'}</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Show message when category is selected but no admin specs found */}
            {formData.category && formData.category.trim() && 
             (!specifications || Object.keys(specifications).length === 0) && 
             (!product || (product && (product.status || 'pending') === 'pending')) && (
              <div className="form-group span-2" style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fef3c7',
                borderRadius: '8px',
                border: '1px solid #fbbf24'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: '#92400e',
                  fontSize: '0.875rem'
                }}>
                  <span>ℹ️</span>
                  <span>
                    <strong>Category "{formData.category}" selected:</strong> No admin-defined specifications found for this category. 
                    Admin needs to set specifications for a product in this category first. 
                    You can write specifications in the description and use "Extract Specifications", or add them manually.
                  </span>
                </div>
              </div>
            )}
            
            {/* Specifications Display Section - Show keys with input fields for manual entry */}
            {specifications && Object.keys(specifications).length > 0 && (() => {
              // Get all specification keys (we only want the keys, not values)
              // Remove duplicates (case-insensitive) and filter out empty keys
              const specKeys = [];
              const seenKeys = new Set();
              
              Object.keys(specifications).forEach(key => {
                const keyLower = key.toLowerCase().trim();
                // Skip if already seen (case-insensitive) or if key is empty
                if (!seenKeys.has(keyLower) && key.trim() !== '') {
                  seenKeys.add(keyLower);
                  specKeys.push(key);
                }
              });
              
              if (specKeys.length === 0) return null;
              
              return (
                <div className="form-group span-2" style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <label style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>
                    Specifications (from Admin) - Enter values manually
                  </label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    {specKeys.map((key, index) => (
                      <div key={key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem',
                        background: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                        borderRadius: '6px',
                        borderLeft: '3px solid #4f46e5'
                      }}>
                        <label style={{
                          fontSize: '0.875rem',
                          color: '#1e293b',
                          fontWeight: '600',
                          minWidth: '180px',
                          flexShrink: 0
                        }}>
                          {key}:
                        </label>
                        <input
                          type="text"
                          value={specifications[key] || ''}
                          onChange={(e) => {
                            setSpecifications({
                              ...specifications,
                              [key]: e.target.value
                            });
                          }}
                          placeholder={`Enter ${key.toLowerCase()} value`}
                          style={{
                            flex: '1',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            color: '#1e293b',
                            background: 'white',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#4f46e5';
                            e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Save size={16} />
              {product ? 'Update' : 'Add'} Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductManagement;
