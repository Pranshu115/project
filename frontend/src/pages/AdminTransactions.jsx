import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { 
  ShoppingCart, 
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Eye,
  RefreshCw
} from 'lucide-react';
import AdminNotifications from '../components/AdminNotifications';
import './AdminDashboard.css';

const AdminTransactions = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/admin/dashboard'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        const data = result.data;
        setTransactions(data.transactions || []);
      } else {
        console.error('Failed to fetch admin data:', result.message);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Transactions</h1>
          <p>View and manage all platform transactions</p>
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
        <div className="transactions-content">
          <div className="transactions-table">
            <table>
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Service Provider</th>
                  <th>Supplier</th>
                  <th>Products</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr 
                    key={transaction.id}
                    onClick={() => {
                      setSelectedTransaction(transaction);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="transaction-id">#{transaction.id}</span>
                    </td>
                    <td>
                      {transaction.serviceProvider ? (
                        <div className="transaction-party">
                          <div className="party-name">{transaction.serviceProvider.name}</div>
                          {transaction.serviceProvider.company && (
                            <div className="party-company">{transaction.serviceProvider.company}</div>
                          )}
                        </div>
                      ) : (
                        <span>N/A</span>
                      )}
                    </td>
                    <td>
                      {transaction.supplier ? (
                        <div className="transaction-party">
                          <div className="party-name">{transaction.supplier.name}</div>
                          {transaction.supplier.company && (
                            <div className="party-company">{transaction.supplier.company}</div>
                          )}
                        </div>
                      ) : (
                        <span>N/A</span>
                      )}
                    </td>
                    <td>
                      <div className="transaction-products">
                        <span className="product-names">{transaction.products}</span>
                        {transaction.productCount > 0 && (
                          <span className="product-count-badge">
                            {transaction.productCount} items
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="amount">₹{transaction.amount.toLocaleString()}</td>
                    <td>{transaction.date}</td>
                    <td>
                      <span className={`status-badge ${transaction.status}`}>
                        {transaction.status === 'delivered' ? <CheckCircle size={14} /> : 
                         transaction.status === 'pending' ? <Clock size={14} /> : 
                         transaction.status === 'cancelled' ? <X size={14} /> : <AlertTriangle size={14} />}
                        {transaction.status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${transaction.paymentStatus || 'pending'}`}>
                        {transaction.paymentStatus || 'pending'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTransaction(transaction);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {selectedTransaction && (
            <div className="modal-overlay" onClick={() => setSelectedTransaction(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Transaction Details - #{selectedTransaction.id}</h2>
                  <button onClick={() => setSelectedTransaction(null)} className="btn-close-modal">
                    <X size={24} />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="transaction-details-grid">
                    <div className="detail-section">
                      <h3>Service Provider</h3>
                      {selectedTransaction.serviceProvider ? (
                        <div>
                          <p><strong>Name:</strong> {selectedTransaction.serviceProvider.name}</p>
                          {selectedTransaction.serviceProvider.company && (
                            <p><strong>Company:</strong> {selectedTransaction.serviceProvider.company}</p>
                          )}
                          {selectedTransaction.serviceProvider.email && (
                            <p><strong>Email:</strong> {selectedTransaction.serviceProvider.email}</p>
                          )}
                        </div>
                      ) : (
                        <p>N/A</p>
                      )}
                    </div>
                    
                    <div className="detail-section">
                      <h3>Supplier</h3>
                      {selectedTransaction.supplier ? (
                        <div>
                          <p><strong>Name:</strong> {selectedTransaction.supplier.name}</p>
                          {selectedTransaction.supplier.company && (
                            <p><strong>Company:</strong> {selectedTransaction.supplier.company}</p>
                          )}
                          {selectedTransaction.supplier.email && (
                            <p><strong>Email:</strong> {selectedTransaction.supplier.email}</p>
                          )}
                        </div>
                      ) : (
                        <p>N/A</p>
                      )}
                    </div>
                    
                    <div className="detail-section">
                      <h3>Order Information</h3>
                      <p><strong>Amount:</strong> ₹{selectedTransaction.amount.toLocaleString()}</p>
                      <p><strong>Status:</strong> {selectedTransaction.status}</p>
                      <p><strong>Payment Status:</strong> {selectedTransaction.paymentStatus || 'pending'}</p>
                      <p><strong>Date:</strong> {selectedTransaction.date}</p>
                    </div>
                    
                    {selectedTransaction.boq && (
                      <div className="detail-section">
                        <h3>BOQ Information</h3>
                        <p><strong>Name:</strong> {selectedTransaction.boq.name}</p>
                        {selectedTransaction.boq.description && (
                          <p><strong>Description:</strong> {selectedTransaction.boq.description}</p>
                        )}
                      </div>
                    )}
                    
                    {selectedTransaction.items && selectedTransaction.items.length > 0 && (
                      <div className="detail-section full-width">
                        <h3>Order Items</h3>
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Quantity</th>
                              <th>Unit Price</th>
                              <th>Total Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTransaction.items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.product}</td>
                                <td>{item.quantity}</td>
                                <td>₹{item.unitPrice.toLocaleString()}</td>
                                <td>₹{item.totalPrice.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTransactions;
