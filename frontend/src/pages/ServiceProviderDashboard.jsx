import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../config/api';
import { 
  FileText, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Plus,
  Eye,
  X,
  Trash2,
  QrCode,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const ServiceProviderDashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalBOQs: 0,
    activePOs: 0,
    totalSpent: 0,
    pendingApprovals: 0
  });
  const [recentBOQs, setRecentBOQs] = useState([]);
  const [recentPOs, setRecentPOs] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const orderPollIntervalRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    
    // Set up automatic polling to get updated supplier data every 30 seconds
    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // Poll every 30 seconds
    
    // Refresh dashboard data when component becomes visible
    const handleFocus = () => {
      fetchDashboardData();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      // Add cache-busting parameters to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`${getApiUrl('/api/dashboard/service-provider')}?_t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      if (data.stats) {
        setStats({
          totalBOQs: data.stats.totalBOQs || 0,
          activePOs: data.stats.activePOs || 0,
          totalSpent: data.stats.totalSpent || 0,
          pendingApprovals: data.stats.pendingApprovals || 0
        });
      }
      setRecentBOQs(data.recentBOQs || []);
      setRecentPOs(data.recentPOs || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchOrderDetails = async (orderId, forceRefresh = false) => {
    if (!orderId) {
      alert('Invalid order ID');
      return;
    }
    
    setLoadingOrderDetails(true);
    if (forceRefresh) {
      setOrderDetails(null); // Clear previous details only on force refresh
    }
    
    try {
      const token = localStorage.getItem('token');
      // Encode the orderId to handle special characters
      const encodedOrderId = encodeURIComponent(orderId);
      // Add cache-busting parameters to ensure fresh supplier data
      const timestamp = Date.now();
      const response = await fetch(`${getApiUrl(`/api/dashboard/service-provider/orders/${encodedOrderId}`)}?_t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const data = await response.json();
      console.log('Order details response:', data);
      console.log('Supplier in response:', data.order?.supplier);
      
      if (data.status === 'success' && data.order) {
        console.log('Order details loaded:', data.order);
        console.log('Supplier information:', {
          hasSupplier: !!data.order.supplier,
          supplierType: typeof data.order.supplier,
          supplierName: data.order.supplier?.name,
          supplierCompany: data.order.supplier?.company
        });
        setOrderDetails(data.order);
      } else {
        console.error('Order details response error:', data);
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
    console.log('Viewing order:', orderId);
    if (!orderId) {
      console.error('No order ID provided');
      alert('Invalid order ID');
      return;
    }
    
    // Clear any existing polling interval
    if (orderPollIntervalRef.current) {
      clearInterval(orderPollIntervalRef.current);
      orderPollIntervalRef.current = null;
    }
    
    setSelectedOrder(orderId);
    fetchOrderDetails(orderId);
    
    // Set up polling for order details to get updated supplier information
    // Poll every 30 seconds when order details modal is open
    orderPollIntervalRef.current = setInterval(() => {
      fetchOrderDetails(orderId, false); // Don't clear details, just refresh
    }, 30000);
  };

  const handleCloseOrderDetails = () => {
    // Clear polling interval when closing modal
    if (orderPollIntervalRef.current) {
      clearInterval(orderPollIntervalRef.current);
      orderPollIntervalRef.current = null;
    }
    setSelectedOrder(null);
    setOrderDetails(null);
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
      const response = await fetch(getApiUrl(`/api/dashboard/service-provider/orders/${encodedOrderId}`), {
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

  const handleMarkAsPaid = async () => {
    if (!selectedOrder) return;
    
    const confirmed = window.confirm(
      `Mark payment as paid for Order ${orderDetails?.orderNumber}?\nAmount: ₹${orderDetails?.totalAmount?.toLocaleString()}`
    );
    
    if (!confirmed) return;
    
    setUpdatingPayment(true);
    try {
      const token = localStorage.getItem('token');
      const encodedOrderId = encodeURIComponent(selectedOrder);
      const response = await fetch(getApiUrl(`/api/dashboard/service-provider/orders/${encodedOrderId}/payment`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: 'online'
        })
      });
      
      const data = await response.json();
      console.log('Update payment response:', data);
      
      if (data.status === 'success') {
        alert('Payment status updated to paid successfully');
        // Refresh order details
        await fetchOrderDetails(selectedOrder);
        // Refresh dashboard
        fetchDashboardData();
      } else {
        console.error('Update payment error:', data);
        alert(data.message || 'Failed to update payment status. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update payment status:', error);
      alert('Failed to update payment status. Please check your connection and try again.');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleDeleteBOQ = async (boqId) => {
    if (!boqId) return;
    
    // Confirm deletion
    const confirmed = window.confirm(
      'Are you sure you want to delete this BOQ? This action cannot be undone and will also delete the uploaded file.'
    );
    
    if (!confirmed) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/boq/${boqId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert('BOQ deleted successfully');
        // Refresh dashboard data
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to delete BOQ');
      }
    } catch (error) {
      console.error('Failed to delete BOQ:', error);
      alert('Failed to delete BOQ. Please try again.');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.name}!</h1>
          <p>Here's what's happening with your procurement activities</p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => navigate('/boq-normalize')}
        >
          <Plus size={18} />
          New BOQ
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon boq">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalBOQs}</h3>
            <p>Total BOQs</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon po">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.activePOs}</h3>
            <p>Active POs</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon spent">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalSpent.toLocaleString()}</h3>
            <p>Total Spent</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pendingApprovals}</h3>
            <p>Pending Approvals</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Recent BOQs */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent BOQs</h2>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/boq-normalize')}
            >
              View All
            </button>
          </div>
          
          <div className="items-list">
            {recentBOQs.length > 0 ? (
              recentBOQs.map((boq) => (
                <div key={boq.id} className="item-card">
                  <div className="item-info">
                    <h4>{boq.name}</h4>
                    <p>{boq.itemCount} items • Created {boq.createdAt}</p>
                  </div>
                  <div className="item-status">
                    <span className={`status ${boq.status}`}>
                      {boq.status === 'completed' ? <CheckCircle size={16} /> : <Clock size={16} />}
                      {boq.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn-icon"
                      title="View BOQ"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBOQ(boq.id);
                      }}
                      title="Delete BOQ"
                      style={{ color: '#dc2626' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No BOQs yet</h3>
                <p>Create your first BOQ to get started</p>
                <button 
                  className="btn-primary"
                  onClick={() => navigate('/boq-normalize')}
                >
                  Create BOQ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Purchase Orders */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Live Purchase Orders</h2>
            <button className="btn-secondary">View All</button>
          </div>
          
          <div className="items-list">
            {recentPOs.length > 0 ? (
              recentPOs.map((po) => (
                <div 
                  key={po.id} 
                  className="item-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleViewOrder(po.orderNumber || po.id)}
                  title="Click to view order details"
                >
                  <div className="item-info">
                    <h4>Order {po.orderNumber || po.id}</h4>
                    <p>
                      {po.vendor}
                      {po.vendorCompany && ` • ${po.vendorCompany}`}
                      {po.itemCount > 0 && ` • ${po.itemCount} item${po.itemCount > 1 ? 's' : ''}`}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Amount: ₹{po.amount.toLocaleString()}
                      {po.createdAt && ` • ${po.createdAt}`}
                    </p>
                  </div>
                  <div className="item-status">
                    <span className={`status ${po.status}`}>
                      {po.status === 'delivered' ? <CheckCircle size={16} /> : 
                       po.status === 'pending' ? <Clock size={16} /> : 
                       po.status === 'confirmed' ? <CheckCircle size={16} /> :
                       <AlertCircle size={16} />}
                      {po.status === 'confirmed' ? 'Confirmed' : po.status}
                    </span>
                  </div>
                  <button 
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewOrder(po.orderNumber || po.id);
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
                <h3>No Purchase Orders</h3>
                <p>Your live purchase orders will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={handleCloseOrderDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Order Details - {orderDetails?.orderNumber || 'Loading...'}</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  className="btn-icon" 
                  onClick={() => fetchOrderDetails(selectedOrder, true)}
                  disabled={loadingOrderDetails}
                  title="Refresh to get latest supplier information"
                  style={{ 
                    opacity: loadingOrderDetails ? 0.5 : 1,
                    cursor: loadingOrderDetails ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw 
                    size={18} 
                    style={{ 
                      animation: loadingOrderDetails ? 'spin 1s linear infinite' : 'none' 
                    }} 
                  />
                </button>
                <button className="btn-icon" onClick={handleCloseOrderDetails}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {loadingOrderDetails ? (
              <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner" />
                <p>Loading order details...</p>
              </div>
            ) : orderDetails ? (
              <div className="modal-body">
                <div className="order-info-section">
                  <h3>Supplier Information</h3>
                  {orderDetails.supplier ? (
                    <>
                      <p><strong>Name:</strong> {orderDetails.supplier.name || 'N/A'}</p>
                      <p><strong>Company:</strong> {orderDetails.supplier.company || 'N/A'}</p>
                  {orderDetails.supplier?.email && (
                    <p><strong>Email:</strong> {orderDetails.supplier.email}</p>
                  )}
                  {orderDetails.supplier?.phone && (
                    <p><strong>Phone:</strong> {orderDetails.supplier.phone}</p>
                  )}
                  {orderDetails.supplier?.address && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p><strong>Address:</strong></p>
                      <p style={{ marginLeft: '1rem', color: '#64748b' }}>
                        {[
                          orderDetails.supplier.address.street,
                          orderDetails.supplier.address.city,
                          orderDetails.supplier.address.state,
                          orderDetails.supplier.address.zipCode
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                    </>
                  ) : (
                    <p style={{ color: '#64748b' }}>Supplier information not available</p>
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
                  <p><strong>Status:</strong> {orderDetails.status || 'pending'}</p>
                  <p><strong>Payment Status:</strong> {orderDetails.paymentStatus || 'pending'}</p>
                  {orderDetails.paymentMethod && (
                    <p><strong>Payment Method:</strong> {orderDetails.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                  )}
                  {orderDetails.createdAt && (
                    <p><strong>Order Date:</strong> {(() => {
                      const date = new Date(orderDetails.createdAt);
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      const hours = String(date.getHours()).padStart(2, '0');
                      const minutes = String(date.getMinutes()).padStart(2, '0');
                      const seconds = String(date.getSeconds()).padStart(2, '0');
                      return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
                    })()}</p>
                  )}
                  {orderDetails.expectedDeliveryDate && (
                    <p><strong>Expected Delivery:</strong> {new Date(orderDetails.expectedDeliveryDate).toLocaleDateString()}</p>
                  )}
                  {orderDetails.actualDeliveryDate && (
                    <p><strong>Actual Delivery:</strong> {new Date(orderDetails.actualDeliveryDate).toLocaleDateString()}</p>
                  )}
                </div>

                {/* Payment QR Code - Show only when order is delivered */}
                {orderDetails.status === 'delivered' && (
                  <div className="order-info-section" style={{
                    textAlign: 'center',
                    padding: '2rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <QrCode size={20} color="#4f46e5" />
                      <h3 style={{ margin: 0, color: '#1e293b' }}>Payment QR Code</h3>
                    </div>
                    <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                      Scan this QR code to pay ₹{orderDetails.totalAmount?.toLocaleString()}
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      padding: '1.5rem',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      {(() => {
                        // Generate QR code data
                        const paymentData = {
                          orderNumber: orderDetails.orderNumber,
                          amount: orderDetails.totalAmount,
                          supplier: orderDetails.supplier?.name || orderDetails.supplier?.company,
                          serviceProvider: user?.name || user?.company,
                          paymentType: 'order_payment',
                          timestamp: new Date().toISOString()
                        };
                        
                        // Create QR code URL using API
                        const qrData = JSON.stringify(paymentData);
                        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
                        
                        return (
                          <img 
                            src={qrCodeUrl}
                            alt="Payment QR Code"
                            style={{
                              width: '200px',
                              height: '200px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px'
                            }}
                          />
                        );
                      })()}
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#64748b',
                      lineHeight: '1.6',
                      marginBottom: '1rem'
                    }}>
                      <p style={{ margin: '0.25rem 0' }}><strong>Order:</strong> {orderDetails.orderNumber}</p>
                      <p style={{ margin: '0.25rem 0' }}><strong>Amount:</strong> ₹{orderDetails.totalAmount?.toLocaleString()}</p>
                      <p style={{ margin: '0.25rem 0' }}><strong>Supplier:</strong> {orderDetails.supplier?.name || orderDetails.supplier?.company || 'N/A'}</p>
                    </div>
                    {orderDetails.paymentStatus !== 'paid' && (
                      <button
                        className="btn-primary"
                        onClick={handleMarkAsPaid}
                        disabled={updatingPayment}
                        style={{
                          width: '100%',
                          marginTop: '1rem',
                          padding: '0.75rem 1.5rem',
                          fontSize: '1rem',
                          fontWeight: '600'
                        }}
                      >
                        {updatingPayment ? (
                          <>Processing...</>
                        ) : (
                          <>✓ Mark Payment as Paid</>
                        )}
                      </button>
                    )}
                    {orderDetails.paymentStatus === 'paid' && (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#d1fae5',
                        borderRadius: '8px',
                        color: '#065f46',
                        fontWeight: '600',
                        textAlign: 'center',
                        marginTop: '1rem'
                      }}>
                        ✓ Payment Completed
                      </div>
                    )}
                  </div>
                )}

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

export default ServiceProviderDashboard;