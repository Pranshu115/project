import { useState } from 'react';
import { getApiUrl } from '../config/api';
import { 
  Package,
  DollarSign,
  Box,
  Tag,
  Edit2,
  Check,
  Ban,
  Save,
  X
} from 'lucide-react';

const ProductDetailModal = ({ product, supplier, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState({ ...product });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const productId = product.id || product._id;
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedProduct)
      });

      if (response.ok) {
        alert('Product updated successfully!');
        setIsEditing(false);
        if (onUpdate) onUpdate();
      } else {
        alert('Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error updating product');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this product?')) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const productId = product.id || product._id;
      const response = await fetch(`/api/admin/products/${productId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Product approved successfully!');
        if (onUpdate) onUpdate();
      } else {
        alert('Failed to approve product');
      }
    } catch (error) {
      console.error('Error approving product:', error);
      alert('Error approving product');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const productId = product.id || product._id;
      const response = await fetch(`/api/admin/products/${productId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        alert('Product rejected');
        if (onUpdate) onUpdate();
      } else {
        alert('Failed to reject product');
      }
    } catch (error) {
      console.error('Error rejecting product:', error);
      alert('Error rejecting product');
    } finally {
      setLoading(false);
    }
  };

  const currentProduct = isEditing ? editedProduct : product;
  
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": currentProduct.name,
    "description": currentProduct.description || "Construction material for building projects",
    "sku": `PROD-${String(currentProduct.id || currentProduct._id || '000000').padStart(6, '0')}`,
    "category": currentProduct.category,
    "brand": {
      "@type": "Brand",
      "name": supplier?.company || supplier?.name || "TatvaDirect Supplier"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": currentProduct.price.toString(),
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": currentProduct.price,
        "priceCurrency": "INR",
        "unitText": currentProduct.unit
      },
      "itemCondition": "https://schema.org/NewCondition",
      "availability": currentProduct.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": supplier?.company || supplier?.name || "TatvaDirect Supplier"
      }
    }
  };

  const statusInfo = {
    approved: { color: '#059669', text: 'Approved' },
    pending: { color: '#d97706', text: 'Pending Approval' },
    rejected: { color: '#dc2626', text: 'Rejected' }
  };

  const status = statusInfo[product.status] || statusInfo.pending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title-section">
              <Package size={28} color="#4f46e5" />
              {isEditing ? (
                <input
                  type="text"
                  value={editedProduct.name}
                  onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                  className="modal-title-input"
                />
              ) : (
                <h2 className="modal-title">{product.name}</h2>
              )}
            </div>
            <div className="modal-badges">
              <span className="category-badge-modal">{currentProduct.category}</span>
              <span className={`status-badge-modal status-${product.status}`}>
                {status.text}
              </span>
            </div>
          </div>
          
          <div className="modal-actions">
            {!isEditing ? (
              <>
                <button onClick={() => setIsEditing(true)} className="btn-modal btn-edit-modal">
                  <Edit2 size={16} />
                  Edit
                </button>
                
                {product.status !== 'approved' && (
                  <button onClick={handleApprove} disabled={loading} className="btn-modal btn-approve-modal">
                    <Check size={16} />
                    Approve
                  </button>
                )}
                
                {product.status !== 'rejected' && (
                  <button onClick={handleReject} disabled={loading} className="btn-modal btn-reject-modal">
                    <Ban size={16} />
                    Reject
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={handleSave} disabled={loading} className="btn-modal btn-save-modal">
                  <Save size={16} />
                  {loading ? 'Saving...' : 'Save'}
                </button>
                
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditedProduct({ ...product });
                  }} 
                  disabled={loading}
                  className="btn-modal btn-cancel-modal"
                >
                  <X size={16} />
                  Cancel
                </button>
              </>
            )}
            
            <button onClick={onClose} disabled={loading} className="btn-close-modal">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="detail-cards-grid">
            {isEditing ? (
              <>
                <div className="detail-card-editable">
                  <div className="detail-icon" style={{ background: '#05966915' }}>
                    <DollarSign size={20} color="#059669" />
                  </div>
                  <div className="detail-content-editable">
                    <label>Price</label>
                    <input
                      type="number"
                      value={editedProduct.price}
                      onChange={(e) => setEditedProduct({ ...editedProduct, price: parseFloat(e.target.value) || 0 })}
                      className="detail-input"
                    />
                    <span className="detail-subtitle">per {editedProduct.unit}</span>
                  </div>
                </div>
                
                <div className="detail-card-editable">
                  <div className="detail-icon" style={{ background: '#4f46e515' }}>
                    <Box size={20} color="#4f46e5" />
                  </div>
                  <div className="detail-content-editable">
                    <label>Stock</label>
                    <input
                      type="number"
                      value={editedProduct.stock}
                      onChange={(e) => setEditedProduct({ ...editedProduct, stock: parseInt(e.target.value) || 0 })}
                      className="detail-input"
                    />
                    <span className="detail-subtitle">{editedProduct.unit}</span>
                  </div>
                </div>
                
                <div className="detail-card-editable">
                  <div className="detail-icon" style={{ background: '#d9770615' }}>
                    <Tag size={20} color="#d97706" />
                  </div>
                  <div className="detail-content-editable">
                    <label>Category</label>
                    <select
                      value={editedProduct.category}
                      onChange={(e) => setEditedProduct({ ...editedProduct, category: e.target.value })}
                      className="detail-select"
                    >
                      <option value="steel">Steel</option>
                      <option value="cement">Cement</option>
                      <option value="aggregates">Aggregates</option>
                      <option value="masonry">Masonry</option>
                      <option value="other">Other</option>
                    </select>
                    <label style={{ marginTop: '0.75rem' }}>Unit</label>
                    <input
                      type="text"
                      value={editedProduct.unit}
                      onChange={(e) => setEditedProduct({ ...editedProduct, unit: e.target.value })}
                      className="detail-input"
                      style={{ marginTop: '0.25rem' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="detail-card">
                  <div className="detail-icon" style={{ background: '#05966915' }}>
                    <DollarSign size={20} color="#059669" />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Price</span>
                    <span className="detail-value">{currentProduct.price.toLocaleString()}</span>
                    <span className="detail-subtitle">per {currentProduct.unit}</span>
                  </div>
                </div>
                
                <div className="detail-card">
                  <div className="detail-icon" style={{ background: '#4f46e515' }}>
                    <Box size={20} color="#4f46e5" />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Stock Available</span>
                    <span className="detail-value">{currentProduct.stock.toLocaleString()}</span>
                    <span className="detail-subtitle">{currentProduct.unit}</span>
                  </div>
                </div>
                
                <div className="detail-card">
                  <div className="detail-icon" style={{ background: '#d9770615' }}>
                    <Tag size={20} color="#d97706" />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">SKU</span>
                    <span className="detail-value">PROD-{String(currentProduct.id || currentProduct._id || '000000').padStart(6, '0')}</span>
                    <span className="detail-subtitle">Product Code</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="description-section">
            <h3>Description</h3>
            {isEditing ? (
              <textarea
                value={editedProduct.description || ''}
                onChange={(e) => setEditedProduct({ ...editedProduct, description: e.target.value })}
                className="description-textarea"
                placeholder="Enter product description..."
              />
            ) : (
              <p>{currentProduct.description || 'No description available'}</p>
            )}
          </div>

          {supplier && (
            <div className="supplier-section">
              <h3>Supplier Information</h3>
              <div className="supplier-info-card">
                <div className="supplier-avatar-modal">
                  {(supplier.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="supplier-name-modal">{supplier.name}</div>
                  <div className="supplier-company-modal">{supplier.company || supplier.email}</div>
                </div>
              </div>
            </div>
          )}

          <div className="schema-section">
            <div className="schema-header">
              <h3>Schema.org Structured Data</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(productSchema, null, 2));
                  alert('Schema copied to clipboard!');
                }}
                className="btn-copy-schema"
              >
                Copy JSON
              </button>
            </div>
            <pre className="schema-code">
              <code>{JSON.stringify(productSchema, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
