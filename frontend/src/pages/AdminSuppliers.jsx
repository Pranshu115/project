import { useState, useEffect } from 'react';
import { 
  Package, 
  RefreshCw,
  Building
} from 'lucide-react';
import AdminNotifications from '../components/AdminNotifications';
import ProductDetailModal from '../components/ProductDetailModal';
import './AdminDashboard.css';

const AdminSuppliers = ({ user }) => {
  const [supplierData, setSupplierData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  const [viewMode, setViewMode] = useState('products');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        const data = result.data;
        setSupplierData(data.supplierData || []);
      } else {
        console.error('Failed to fetch admin data:', result.message);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductUpdate = () => {
    fetchAdminData();
    setSelectedProduct(null);
    setSelectedSupplier(null);
  };

  const toggleSupplier = (supplierId) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Suppliers Management</h1>
          <p>View and manage all suppliers and their products</p>
        </div>
        <div className="admin-actions">
          <AdminNotifications />
          <button 
            className="btn-refresh" 
            onClick={fetchAdminData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh Data
          </button>
          <div className="admin-user-info">
            <span>Welcome, {user?.name}</span>
            <div className="admin-badge">Admin</div>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="suppliers-content">
          <div className="suppliers-header-controls">
            <div className="view-mode-toggle">
              <button 
                className={viewMode === 'products' ? 'active' : ''}
                onClick={() => setViewMode('products')}
              >
                Products View
              </button>
              <button 
                className={viewMode === 'orders' ? 'active' : ''}
                onClick={() => setViewMode('orders')}
              >
                Orders View
              </button>
            </div>
          </div>
          
          {!supplierData || supplierData.length === 0 ? (
            <div className="empty-state">
              <Package size={48} />
              <p>No suppliers found</p>
            </div>
          ) : (
            <div className="suppliers-list">
              {supplierData.map((supplier, index) => {
                const supplierId = supplier._id || supplier.id || index;
                const isExpanded = expandedSuppliers[supplierId];
                // Use totalProducts if available, otherwise use products array length
                const productCount = supplier.totalProducts !== undefined 
                  ? supplier.totalProducts 
                  : (supplier.products?.length || 0);
                const orderCount = supplier.orders?.length || 0;
                const totalRevenue = supplier.totalRevenue || 0;
                const activeOrders = supplier.activeOrders || 0;
                
                return (
                  <div key={supplierId} className="supplier-card">
                    <div 
                      className="supplier-header"
                      onClick={() => toggleSupplier(supplierId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="supplier-info">
                        <div className="supplier-avatar">
                          {(supplier.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="supplier-details">
                          <div className="supplier-name">{supplier.name}</div>
                          <div className="supplier-company">{supplier.company || supplier.email}</div>
                          <div className="supplier-meta">
                            <span>{productCount} product{productCount !== 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span>{orderCount} order{orderCount !== 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span>₹{totalRevenue.toLocaleString('en-IN')} revenue</span>
                            {supplier.serviceProvidersWorkedWith > 0 && (
                              <>
                                <span>•</span>
                                <span>{supplier.serviceProvidersWorkedWith} SP{supplier.serviceProvidersWorkedWith !== 1 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="supplier-stats">
                        <div className="stat-item">
                          <span className="stat-label">Active Orders</span>
                          <span className="stat-value">{activeOrders}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Inventory Value</span>
                          <span className="stat-value">₹{(supplier.totalInventoryValue || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="supplier-expanded-content">
                        {viewMode === 'products' ? (
                          <>
                            <h4>Products ({productCount})</h4>
                            {supplier.products && supplier.products.length > 0 ? (
                              <div className="supplier-products">
                                {supplier.products.map((product) => (
                                  <div 
                                    key={product.id || product._id} 
                                    className="product-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProduct(product);
                                      setSelectedSupplier(supplier);
                                    }}
                                  >
                                    <div className="product-item-main">
                                      <span className="product-name">{product.name}</span>
                                      <span className="product-category">{product.category}</span>
                                    </div>
                                    <div className="product-item-details">
                                      <span className="product-price">₹{product.price.toLocaleString('en-IN')}/{product.unit}</span>
                                      <span className="product-stock">Stock: {product.stock}</span>
                                      <span className={`product-status-badge status-${product.status || 'pending'}`}>
                                        {product.status || 'pending'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="supplier-products-empty">
                                <p>No products available</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <h4>Orders ({orderCount})</h4>
                            {supplier.orders && supplier.orders.length > 0 ? (
                              <div className="supplier-orders">
                                {supplier.orders.map((order, idx) => (
                                  <div key={order.orderNumber || idx} className="order-item">
                                    <div className="order-item-header">
                                      <span className="order-number">#{order.orderNumber}</span>
                                      <span className={`status-badge ${order.status}`}>
                                        {order.status}
                                      </span>
                                    </div>
                                    <div className="order-item-details">
                                      {order.serviceProvider && (
                                        <div className="order-service-provider">
                                          <strong>Service Provider:</strong> {order.serviceProvider.name} 
                                          {order.serviceProvider.company && ` (${order.serviceProvider.company})`}
                                        </div>
                                      )}
                                      <div className="order-amount">
                                        <strong>Amount:</strong> ₹{order.totalAmount?.toLocaleString('en-IN') || '0'}
                                      </div>
                                      <div className="order-items">
                                        <strong>Items:</strong> {order.items || 0}
                                      </div>
                                      {order.createdAt && (
                                        <div className="order-date">
                                          <strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="supplier-orders-empty">
                                <p>No orders found</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailModal 
          product={selectedProduct}
          supplier={selectedSupplier}
          onClose={() => {
            setSelectedProduct(null);
            setSelectedSupplier(null);
          }}
          onUpdate={handleProductUpdate}
        />
      )}
    </div>
  );
};

export default AdminSuppliers;
