import React, { useState, useMemo } from 'react';
import { Upload, CheckCircle, AlertCircle, Users, Package, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './BOQNormalize.css';

const BOQNormalize = ({ onComplete }) => {
  const [file, setFile] = useState(null);
  const [items, setItems] = useState([]);
  const [boqId, setBoqId] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    // Get auth token
    const token = localStorage.getItem('token');

    try {
      // Add cache-busting parameters to ensure fresh data
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      
      console.log(`BOQ Normalize - Uploading file at ${new Date().toISOString()} with timestamp: ${timestamp}`);
      
      const res = await fetch(`/api/boq/normalize?_t=${timestamp}&_r=${random}`, {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Request-ID': `${timestamp}-${random}`,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // Get error message from response
        const errorMessage = data.message || data.error || res.statusText || 'Upload failed';
        throw new Error(errorMessage);
      }
      
      if (data.items && data.items.length > 0) {
        setItems(data.items);
        if (data.boqId) {
          setBoqId(data.boqId);
        }
      } else {
        alert('No items found in the uploaded file. Please try again.');
        setFile(null);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      // Show the actual error message to the user
      const errorMessage = error.message || 'Failed to process file. Please try again.';
      alert(errorMessage);
      setFile(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (items.length === 0) {
      alert('Please upload and process a BOQ file first');
      return;
    }
    
    console.log('Proceeding to vendor selection with items:', items);
    onComplete(items, boqId);
    navigate('/supplier-select', { replace: false });
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalItems = items.length;
    const totalSuppliers = items.reduce((sum, item) => sum + (item.availableSuppliers || 0), 0);
    const itemsWithSuppliers = items.filter(item => (item.availableSuppliers || 0) > 0).length;
    const itemsWithoutSuppliers = items.filter(item => (item.availableSuppliers || 0) === 0).length;
    const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    
    return {
      totalItems,
      totalSuppliers,
      itemsWithSuppliers,
      itemsWithoutSuppliers,
      totalQuantity
    };
  }, [items]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>BOQ Normalize</h1>
        <p>Upload your Bill of Quantities and map items to normalized catalog</p>
      </div>

      {!file ? (
        <div className="upload-zone">
          <Upload size={48} />
          <h3>Upload BOQ File</h3>
          <p>Supported formats: CSV (.csv), Excel (.xlsx, .xls), or PDF (.pdf)</p>
          <label className="btn-primary">
            Choose File
            <input 
              type="file" 
              onChange={handleFileUpload} 
              accept=".csv,.xlsx,.xls,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/pdf" 
              hidden 
            />
          </label>
        </div>
      ) : (
        <div className="results">
          {loading ? (
            <div className="loading">Processing...</div>
          ) : (
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
              {/* Main Content Area */}
              <div style={{ flex: 1 }}>
                <div className="items-grid">
                {items.map((item) => (
                  <div key={item.id} className="item-card">
                    <div className="item-header">
                      <span className="item-raw">{item.rawName}</span>
                      {item.confidence >= 0.8 ? (
                        <CheckCircle size={20} className="icon-success" />
                      ) : (
                        <AlertCircle size={20} className="icon-warning" />
                      )}
                    </div>
                    <div className="item-normalized">
                      <strong>{item.normalizedName}</strong>
                    </div>
                    <div className="item-meta">
                      <span>Qty: {item.quantity}</span>
                      <span className={`confidence ${item.confidence >= 0.8 ? 'high' : 'medium'}`}>
                        {Math.round(item.confidence * 100)}% match
                      </span>
                    </div>
                    {item.supplierInfo && (
                      <div className="item-supplier-info" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          <strong style={{ color: '#1e293b' }}>Available from:</strong> {item.supplierInfo.supplierName}
                          {item.supplierInfo.supplierLocation && (
                            <span style={{ marginLeft: '0.5rem' }}>📍 {item.supplierInfo.supplierLocation}</span>
                          )}
                        </div>
                        {item.availableSuppliers > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '0.25rem' }}>
                            {item.availableSuppliers} supplier{item.availableSuppliers > 1 ? 's' : ''} available
                          </div>
                        )}
                        {item.availableSuppliers === 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.25rem' }}>
                            No suppliers available
                          </div>
                        )}
                      </div>
                    )}
                    {!item.supplierInfo && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.8rem', color: '#d97706' }}>
                          No matching suppliers found
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                </div>
                <button 
                  className="btn-primary btn-large" 
                  onClick={handleProceed}
                  disabled={items.length === 0}
                  style={{ width: '100%', marginTop: '2rem' }}
                >
                  Proceed to Vendor Selection
                </button>
              </div>

              {/* Summary Sidebar */}
              {items.length > 0 && (
                <div style={{
                  width: '280px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  position: 'sticky',
                  top: '2rem',
                  height: 'fit-content'
                }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Summary
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        padding: '0.5rem',
                        background: '#e0e7ff',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Package size={20} color="#4f46e5" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          Total Items
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
                          {summaryStats.totalItems}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#f0fdf4',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        padding: '0.5rem',
                        background: '#d1fae5',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Users size={20} color="#059669" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          Total Suppliers
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#059669' }}>
                          {summaryStats.totalSuppliers}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#fef3c7',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        padding: '0.5rem',
                        background: '#fde68a',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <TrendingUp size={20} color="#d97706" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          Items with Suppliers
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#d97706' }}>
                          {summaryStats.itemsWithSuppliers} / {summaryStats.totalItems}
                        </div>
                      </div>
                    </div>

                    {summaryStats.itemsWithoutSuppliers > 0 && (
                      <div style={{
                        padding: '0.75rem',
                        background: '#fef2f2',
                        borderRadius: '8px',
                        border: '1px solid #fecaca'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.25rem', fontWeight: '500' }}>
                          Items without Suppliers
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626' }}>
                          {summaryStats.itemsWithoutSuppliers}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BOQNormalize;
