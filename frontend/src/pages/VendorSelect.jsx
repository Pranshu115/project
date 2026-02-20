import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../config/api';
import './VendorSelect.css';

const VendorSelect = ({ items = [], onComplete }) => {
  const [itemVendors, setItemVendors] = useState({});
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchVendors = async () => {
    // Validate items before fetching
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('Cannot fetch vendors: items is empty or invalid');
      setLoading(false);
      return;
    }
    
    const token = localStorage.getItem('token');
    setLoading(true);
    
    try {
      // Generate a unique timestamp and random number to prevent any caching
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      
      console.log(`Fetching vendors at ${new Date().toISOString()} with timestamp: ${timestamp}, random: ${random}`);
      console.log('Items being sent:', items);
      
      // Add timestamp and random to prevent caching and ensure fresh data
      const res = await fetch(`${getApiUrl('/api/vendors/rank')}?_t=${timestamp}&_r=${random}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Request-ID': `${timestamp}-${random}`, // Add unique request ID
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ items, _timestamp: timestamp, _random: random })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.itemVendors) {
        // Ensure all item vendors are arrays and filter out invalid entries
        const cleanedVendors = {};
        Object.keys(data.itemVendors).forEach(itemId => {
          const vendors = data.itemVendors[itemId];
          if (Array.isArray(vendors)) {
            // Filter out invalid vendors (must have id, name, and valid price)
            cleanedVendors[itemId] = vendors.filter(v => 
              v && v.id && v.name && typeof v.price === 'number' && v.price > 0
            );
          } else {
            cleanedVendors[itemId] = [];
          }
        });
        setItemVendors(cleanedVendors);
      } else {
        // If no itemVendors in response, initialize with empty arrays
        const emptyVendors = {};
        items.forEach(item => {
          const itemId = item.id?.toString() || String(item.id);
          emptyVendors[itemId] = [];
        });
        setItemVendors(emptyVendors);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      // Initialize with empty arrays on error
      const emptyVendors = {};
      items.forEach(item => {
        const itemId = item.id?.toString() || String(item.id);
        emptyVendors[itemId] = [];
      });
      setItemVendors(emptyVendors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if items is valid and has length
    if (items && Array.isArray(items) && items.length > 0) {
      // Always fetch fresh data when component mounts or items change
      fetchVendors();
    } else {
      // If no items, redirect back to BOQ normalize
      console.warn('No items found, redirecting to BOQ normalize');
      navigate('/boq-normalize', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  
  // Also fetch vendors when component becomes visible (user switches tabs/windows)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && items && Array.isArray(items) && items.length > 0) {
        console.log('Page became visible, refreshing vendor data...');
        fetchVendors();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [items]);

  // Add refresh functionality to get latest supplier data
  const handleRefresh = () => {
    fetchVendors();
  };

  const handleSelect = (itemId, vendorId) => {
    console.log('Selecting vendor:', { itemId, vendorId });
    setSelections({ ...selections, [itemId]: vendorId });
  };

  const handleProceed = () => {
    // Check how many items have selections
    const itemsWithSelections = items.filter(item => {
      const itemId = item.id?.toString() || String(item.id);
      return selections[itemId] || selections[item.id];
    }).length;
    
    // Warn if some items don't have suppliers, but allow proceeding
    if (itemsWithSelections < items.length) {
      const itemsWithoutSuppliers = items.length - itemsWithSelections;
      const proceed = window.confirm(
        `${itemsWithoutSuppliers} item(s) don't have selected suppliers. ` +
        `These items will be skipped when creating the purchase order. ` +
        `Do you want to continue?`
      );
      if (!proceed) {
        return;
      }
    }
    
    // If no items have selections, show error
    if (itemsWithSelections === 0) {
      alert('Please select at least one supplier before proceeding.');
      return;
    }
    
    onComplete(selections);
    navigate('/substitution');
  };

  // Show loading or error state if items are not available
  if (!items || !Array.isArray(items) || items.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Supplier Selection</h1>
          <p>No items found. Please go back and upload a BOQ file.</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => navigate('/boq-normalize')}
        >
          Go Back to BOQ Normalize
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Supplier Selection</h1>
          <p>Choose the best vendor for each item</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            background: loading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            opacity: loading ? 0.7 : 1
          }}
          title="Refresh to get latest supplier information"
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} style={{ 
            animation: loading ? 'spin 1s linear infinite' : 'none' 
          }} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && items.length > 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          Loading suppliers...
        </div>
      )}

      <div className="vendor-list">
        {items.map((item) => {
          const itemId = item.id?.toString() || String(item.id);
          const vendors = itemVendors[itemId] || itemVendors[item.id] || [];
          const hasVendors = Array.isArray(vendors) && vendors.length > 0 && vendors.some(v => v.id && v.name);
          
          return (
          <div key={item.id} className="vendor-section">
            <h3 className="item-title">{item.normalizedName || item.rawName}</h3>
            <div className="vendor-options">
              {hasVendors ? (
                vendors
                  .filter(vendor => vendor && vendor.id && vendor.name && vendor.price > 0)
                  .map((vendor) => (
                  <div 
                    key={vendor.id}
                    className={`vendor-card ${selections[itemId] === vendor.id || selections[item.id] === vendor.id ? 'selected' : ''}`}
                    onClick={() => handleSelect(itemId, vendor.id)}
                  >
                    <div className="vendor-header">
                      <div>
                        <div className="vendor-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {vendor.name}
                          {vendor.status === 'pending' && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.15rem 0.4rem', 
                              background: '#fef3c7', 
                              color: '#d97706', 
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              Pending Approval
                            </span>
                          )}
                        </div>
                        {vendor.company && (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {vendor.company}
                          </div>
                        )}
                        {vendor.location && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            📍 {vendor.location}
                          </div>
                        )}
                      </div>
                      {vendor.rank === 1 && <span className="badge">Recommended</span>}
                    </div>
                    <div className="vendor-product-info">
                      <div className="product-name">{vendor.productName || item.normalizedName}</div>
                      {vendor.description && (
                        <div className="product-description">{vendor.description.substring(0, 50)}...</div>
                      )}
                    </div>
                    <div className="vendor-details">
                      <div className="detail">
                        <TrendingUp size={16} />
                        <span>{vendor.price?.toLocaleString() || 'N/A'} / {vendor.unit || 'unit'}</span>
                      </div>
                      <div className="detail">
                        <Clock size={16} />
                        <span>{vendor.leadTime} days delivery</span>
                      </div>
                      {vendor.stock > 0 ? (
                        <div className="detail" style={{ color: '#059669' }}>
                          <span>✓ Stock: {vendor.stock} {vendor.unit || 'units'}</span>
                        </div>
                      ) : (
                        <div className="detail" style={{ color: '#dc2626' }}>
                          <span>✗ Out of stock</span>
                        </div>
                      )}
                      {vendor.rating > 0 && (
                        <div className="detail">
                          <span>⭐ {vendor.rating.toFixed(1)} rating</span>
                        </div>
                      )}
                      {vendor.isAvailable === false && (
                        <div className="detail" style={{ color: '#dc2626', fontWeight: '600' }}>
                          <span>⚠ Not Available</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-vendors" style={{
                  padding: '2rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <p style={{ 
                    color: '#64748b', 
                    fontSize: '1rem',
                    margin: 0,
                    fontWeight: '500'
                  }}>
                    No supplier is available for this requirement
                  </p>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <button 
        className="btn-primary btn-large" 
        onClick={handleProceed}
        disabled={!items.some(item => {
          const itemId = item.id?.toString() || String(item.id);
          return selections[itemId] || selections[item.id];
        })}
      >
        Continue to Substitutions
      </button>
    </div>
  );
};

export default VendorSelect;
