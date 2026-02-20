import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import { 
  Package,
  TrendingUp,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  X,
  Save,
  Bell,
  DollarSign,
  Trash2
} from 'lucide-react';
import './Dashboard.css';

const SupplierDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeOrders: 0,
    totalRevenue: 0,
    pendingQuotes: 0
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        await checkSetupStatus();
        await fetchDashboardData();
        await fetchNotifications();
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        setLoading(false);
      }
    };
    
    initializeDashboard();
    
    // Removed automatic polling - notifications will only be fetched on initial load
    // Users can manually refresh if needed
  }, []);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('[data-notification-container]')) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const checkSetupStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/supplier/setup-status'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success' && !data.hasProducts) {
        navigate('/supplier-setup');
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/dashboard/supplier'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setStats(data.stats || {
          totalProducts: 0,
          activeOrders: 0,
          totalRevenue: 0,
          pendingQuotes: 0
        });
        setOrders(data.orders || []);
      } else {
        console.error('Failed to fetch dashboard data:', data.message);
        setStats({
          totalProducts: 0,
          activeOrders: 0,
          totalRevenue: 0,
          pendingQuotes: 0
        });
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setStats({
        totalProducts: 0,
        activeOrders: 0,
        totalRevenue: 0,
        pendingQuotes: 0
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    if (!orderId) {
      alert('Invalid order ID');
      return;
    }
    
    setLoadingOrderDetails(true);
    setOrderDetails(null); // Clear previous details
    
    try {
      const token = localStorage.getItem('token');
      // Encode the orderId to handle special characters
      const encodedOrderId = encodeURIComponent(orderId);
      const response = await fetch(getApiUrl(`/api/supplier/orders/${encodedOrderId}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      console.log('Supplier order details response:', data);
      
      if (data.status === 'success' && data.order) {
        console.log('Supplier order details loaded:', data.order);
        setOrderDetails(data.order);
        setNewStatus(data.order.status);
      } else {
        console.error('Supplier order details response error:', data);
        alert(data.message || 'Failed to load order details. Please try again.');
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      alert('Failed to load order details. Please check your connection and try again.');
      setSelectedOrder(null);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const handleViewOrder = (orderId) => {
    console.log('Viewing supplier order:', orderId);
    if (!orderId) {
      console.error('No order ID provided');
      alert('Invalid order ID');
      return;
    }
    setSelectedOrder(orderId);
    fetchOrderDetails(orderId);
  };

  const handleCloseOrderDetails = () => {
    setSelectedOrder(null);
    setOrderDetails(null);
    setNewStatus('');
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder || !orderDetails) {
      alert('No order selected for deletion');
      return;
    }
    
    const orderNumber = orderDetails.orderNumber || selectedOrder;
    const confirmed = window.confirm(
      `Are you sure you want to delete Order ${orderNumber}?\n\n` +
      `This action cannot be undone. The order will be permanently removed from the system.\n\n` +
      `Note: Orders that have been delivered and paid cannot be deleted.`
    );
    
    if (!confirmed) return;
    
    setDeletingOrder(true);
    try {
      const token = localStorage.getItem('token');
      const encodedOrderId = encodeURIComponent(orderNumber);
      const response = await fetch(getApiUrl(`/api/dashboard/supplier/orders/${encodedOrderId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(`Order ${orderNumber} deleted successfully`);
        // Close the modal
        handleCloseOrderDetails();
        // Refresh dashboard to update order list
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to delete order. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete order:', error);
      alert('Failed to delete order. Please check your connection and try again.');
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) {
      alert('Please select a status to update');
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem('token');
      // Encode the orderId to handle special characters
      const encodedOrderId = encodeURIComponent(selectedOrder);
      const response = await fetch(getApiUrl(`/api/supplier/orders/${encodedOrderId}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          notes: `Status updated to ${newStatus} by supplier`
        })
      });
      
      const data = await response.json();
      console.log('Update status response:', data);
      
      if (data.status === 'success') {
        alert('Order status updated successfully');
        // Refresh order details to show updated status
        await fetchOrderDetails(selectedOrder);
        // Refresh dashboard to update order list
        fetchDashboardData();
      } else {
        console.error('Update status error:', data);
        alert(data.message || 'Failed to update order status. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status. Please check your connection and try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/supplier/notifications'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status === 'success') {
        console.log('Notifications fetched:', data.notifications?.length || 0, 'notifications,', data.unreadCount || 0, 'unread');
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        console.error('Failed to fetch notifications:', data.message);
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
        await fetch(getApiUrl(`/api/supplier/notifications/${notificationId}/read`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      fetchNotifications(); // Refresh notifications
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Format: "DD/MM/YYYY, HH:MM:SS" (e.g., "12/02/2026, 10:56:58")
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  };


  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Safety check - if user is not available, show error
  if (!user) {
    return (
      <div className="dashboard-container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>Error</h2>
          <p>User information not available. Please log in again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.name || 'Supplier'}!</h1>
          <p>Manage your products and track incoming orders</p>
        </div>
        <div style={{ position: 'relative' }} data-notification-container>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              position: 'relative',
              padding: '0.5rem',
              background: 'transparent',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div 
              data-notification-container
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                width: '350px',
                maxHeight: '500px',
                overflowY: 'auto',
                zIndex: 1000
              }}
            >
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        await fetch(getApiUrl('/api/supplier/notifications/read-all'), {
                          method: 'PATCH',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        fetchNotifications();
                      } catch (error) {
                        console.error('Failed to mark all as read:', error);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification._id}
                      onClick={() => {
                        if (!notification.isRead) {
                          markNotificationAsRead(notification._id);
                        }
                        if (notification.relatedOrder) {
                          setSelectedOrder(notification.relatedOrder.orderNumber || notification.relatedOrder._id);
                          fetchOrderDetails(notification.relatedOrder.orderNumber || notification.relatedOrder._id);
                          setShowNotifications(false);
                        }
                      }}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        backgroundColor: notification.isRead ? 'white' : '#f0f9ff',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (notification.isRead) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (notification.isRead) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '8px',
                          background: notification.type === 'payment_received' ? '#d1fae5' : '#dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {notification.type === 'payment_received' ? (
                            <DollarSign size={20} color="#059669" />
                          ) : (
                            <Bell size={20} color="#3b82f6" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: notification.isRead ? '500' : '600',
                            marginBottom: '0.25rem',
                            color: notification.isRead ? '#374151' : '#111827'
                          }}>
                            {notification.title}
                          </div>
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#64748b',
                            marginBottom: '0.25rem'
                          }}>
                            {notification.message}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#9ca3af'
                          }}>
                            {formatDate(notification.createdAt)}
                          </div>
                        </div>
                        {!notification.isRead && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#3b82f6',
                            marginTop: '0.5rem'
                          }} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon products">
            <Package size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalProducts}</h3>
            <p>Total Products</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orders">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.activeOrders}</h3>
            <p>Active Orders</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon revenue">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalRevenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon quotes">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pendingQuotes}</h3>
            <p>Pending Quotes</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Live Orders */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Live Orders</h2>
            <button className="btn-secondary">View All</button>
          </div>
          
          <div className="items-list">
            {orders.length > 0 ? (
              orders.map((order) => (
                <div 
                  key={order.id} 
                  className="item-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleViewOrder(order.orderNumber || order.id)}
                  title="Click to view order details"
                >
                  <div className="item-info">
                    <h4>Order {order.orderNumber || `#${order.id}`}</h4>
                    <p>
                      {order.customer}
                      {order.company && ` • ${order.company}`}
                      {order.itemCount > 0 && ` • ${order.itemCount} item${order.itemCount > 1 ? 's' : ''}`}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Amount: ₹{order.amount.toLocaleString()}
                      {order.createdAt && ` • ${order.createdAt}`}
                    </p>
                  </div>
                  <div className="item-status">
                    <span className={`status ${order.status}`}>
                      {order.status === 'delivered' ? <CheckCircle size={16} /> : 
                       order.status === 'confirmed' ? <CheckCircle size={16} /> :
                       order.status === 'pending' ? <Clock size={16} /> : <AlertTriangle size={16} />}
                      {order.status === 'confirmed' ? 'Confirmed' : order.status}
                    </span>
                  </div>
                  <button 
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewOrder(order.orderNumber || order.id);
                    }}
                    title="View order details"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <ShoppingCart size={48} />
                <h3>No orders yet</h3>
                <p>Orders from service providers will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={handleCloseOrderDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Order Details - {orderDetails?.orderNumber || 'Loading...'}</h2>
              <button className="btn-icon" onClick={handleCloseOrderDetails}>
                <X size={20} />
              </button>
            </div>
            
            {loadingOrderDetails ? (
              <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner" />
                <p>Loading order details...</p>
              </div>
            ) : orderDetails ? (
              <div className="modal-body">
                <div className="order-info-section">
                  <h3>Customer Information</h3>
                  <p><strong>Name:</strong> {orderDetails.serviceProvider?.name || 'N/A'}</p>
                  <p><strong>Company:</strong> {orderDetails.serviceProvider?.company || 'N/A'}</p>
                  {orderDetails.serviceProvider?.email && (
                    <p><strong>Email:</strong> {orderDetails.serviceProvider.email}</p>
                  )}
                  {orderDetails.serviceProvider?.phone && (
                    <p><strong>Phone:</strong> {orderDetails.serviceProvider.phone}</p>
                  )}
                  {orderDetails.serviceProvider?.address && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p><strong>Address:</strong></p>
                      <p style={{ marginLeft: '1rem', color: '#64748b' }}>
                        {[
                          orderDetails.serviceProvider.address.street,
                          orderDetails.serviceProvider.address.city,
                          orderDetails.serviceProvider.address.state,
                          orderDetails.serviceProvider.address.zipCode
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="order-info-section">
                  <h3>Order Items</h3>
                  {orderDetails.items && orderDetails.items.length > 0 ? (
                    <table className="order-items-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetails.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <div>
                                <strong>{item.product?.name || item.name || 'Product'}</strong>
                                {item.product?.category && (
                                  <span className="product-category"> ({item.product.category})</span>
                                )}
                              </div>
                              {item.product?.description && (
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                                  {item.product.description}
                                </div>
                              )}
                              {item.specifications && (
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                                  <strong>Specs:</strong> {item.specifications}
                                </div>
                              )}
                            </td>
                            <td>{item.quantity} {item.product?.unit || item.unit || 'units'}</td>
                            <td>₹{item.unitPrice?.toLocaleString()}</td>
                            <td>₹{item.totalPrice?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3"><strong>Total Amount</strong></td>
                          <td><strong>₹{orderDetails.totalAmount?.toLocaleString()}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <p style={{ color: '#64748b' }}>No items found in this order.</p>
                  )}
                </div>

                {orderDetails.deliveryAddress && (
                  <div className="order-info-section">
                    <h3>Delivery Address</h3>
                    <p>
                      {[
                        orderDetails.deliveryAddress.street,
                        orderDetails.deliveryAddress.city,
                        orderDetails.deliveryAddress.state,
                        orderDetails.deliveryAddress.zipCode,
                        orderDetails.deliveryAddress.country
                      ].filter(Boolean).join(', ')}
                    </p>
                    {orderDetails.deliveryAddress.contactPerson && (
                      <p><strong>Contact Person:</strong> {orderDetails.deliveryAddress.contactPerson}</p>
                    )}
                    {orderDetails.deliveryAddress.contactPhone && (
                      <p><strong>Contact Phone:</strong> {orderDetails.deliveryAddress.contactPhone}</p>
                    )}
                  </div>
                )}

                <div className="order-info-section">
                  <h3>Order Status & Dates</h3>
                  <div className="status-update-section">
                    <label>
                      <strong>Current Status:</strong>
                      <select 
                        value={newStatus} 
                        onChange={(e) => setNewStatus(e.target.value)}
                        disabled={updatingStatus}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <button 
                      className="btn-primary"
                      onClick={handleUpdateStatus}
                      disabled={updatingStatus || newStatus === orderDetails.status}
                    >
                      {updatingStatus ? 'Updating...' : <><Save size={16} /> Update Status</>}
                    </button>
                  </div>
                  <p><strong>Payment Status:</strong> {orderDetails.paymentStatus || 'pending'}</p>
                  {orderDetails.paymentMethod && (
                    <p><strong>Payment Method:</strong> {orderDetails.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                  )}
                  {orderDetails.createdAt && (
                    <p><strong>Order Date:</strong> {formatDate(orderDetails.createdAt)}</p>
                  )}
                  {orderDetails.expectedDeliveryDate && (
                    <p><strong>Expected Delivery:</strong> {new Date(orderDetails.expectedDeliveryDate).toLocaleDateString()}</p>
                  )}
                  {orderDetails.actualDeliveryDate && (
                    <p><strong>Actual Delivery:</strong> {new Date(orderDetails.actualDeliveryDate).toLocaleDateString()}</p>
                  )}
                </div>

                {orderDetails.boq && (
                  <div className="order-info-section">
                    <h3>Related BOQ</h3>
                    <p><strong>BOQ Name:</strong> {orderDetails.boq.name || 'N/A'}</p>
                    {orderDetails.boq.itemCount && (
                      <p><strong>Total Items:</strong> {orderDetails.boq.itemCount}</p>
                    )}
                  </div>
                )}

                {orderDetails.notes && (
                  <div className="order-info-section">
                    <h3>Notes</h3>
                    <p>{orderDetails.notes}</p>
                  </div>
                )}

                {orderDetails.internalNotes && (
                  <div className="order-info-section">
                    <h3>Internal Notes</h3>
                    <p>{orderDetails.internalNotes}</p>
                  </div>
                )}

                {/* Delete Order Section */}
                <div className="order-info-section" style={{ 
                  borderTop: '2px solid #fee2e2',
                  paddingTop: '1.5rem',
                  marginTop: '1.5rem'
                }}>
                  <h3 style={{ color: '#dc2626' }}>Danger Zone</h3>
                  <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    Deleting an order will permanently remove it from the system. This action cannot be undone.
                    {orderDetails.status === 'delivered' && orderDetails.paymentStatus === 'paid' && (
                      <span style={{ display: 'block', color: '#dc2626', marginTop: '0.5rem', fontWeight: '600' }}>
                        ⚠️ This order has been delivered and paid. Deletion may not be allowed.
                      </span>
                    )}
                  </p>
                  <button
                    className="btn-secondary"
                    onClick={handleDeleteOrder}
                    disabled={deletingOrder || (orderDetails.status === 'delivered' && orderDetails.paymentStatus === 'paid')}
                    style={{
                      backgroundColor: deletingOrder ? '#9ca3af' : '#fee2e2',
                      color: deletingOrder ? '#6b7280' : '#dc2626',
                      border: '1px solid #dc2626',
                      cursor: deletingOrder || (orderDetails.status === 'delivered' && orderDetails.paymentStatus === 'paid') ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: deletingOrder || (orderDetails.status === 'delivered' && orderDetails.paymentStatus === 'paid') ? 0.6 : 1
                    }}
                  >
                    <Trash2 size={16} />
                    {deletingOrder ? 'Deleting...' : 'Delete Order'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#dc2626' }}>Failed to load order details. Please try again.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default SupplierDashboard;