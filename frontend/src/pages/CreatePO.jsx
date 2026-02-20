import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import './CreatePO.css';

const CreatePO = ({ selectedVendors, substitutions, boqId, items }) => {
  const [poGroups, setPoGroups] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Validate that we have the required data
    if (!items || items.length === 0) {
      setError('No items found. Please go back and upload a BOQ file.');
      setLoading(false);
      return;
    }

    if (!selectedVendors || Object.keys(selectedVendors).length === 0) {
      setError('No suppliers selected. Please go back and select suppliers for your items.');
      setLoading(false);
      return;
    }

    // Group by vendor
    groupByVendor();
  }, [selectedVendors, substitutions, items]);

  const groupByVendor = async () => {
    setLoading(true);
    setError(null);
    
    // Get auth token
    const token = localStorage.getItem('token');
    
    try {
      console.log('Grouping POs with data:', {
        selectedVendors,
        itemsCount: items?.length,
        substitutionsCount: substitutions?.length
      });

      const res = await fetch('/api/po/group', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ selectedVendors, substitutions, items })
      });
      
      // Check if response is ok
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Failed to group purchase orders';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Check if response has content
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(text);
      console.log('PO groups response:', data);
      
      if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
        setPoGroups(data.groups);
        setError(null);
      } else {
        const errorMsg = data.message || 'No purchase order groups were created. Please ensure all items have selected suppliers and matching products.';
        console.error('No groups returned:', data);
        setError(errorMsg);
        setPoGroups([]);
      }
    } catch (error) {
      console.error('Failed to group POs:', error);
      setError(error.message || 'Failed to group purchase orders. Please try again.');
      setPoGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    // Validate poGroups before submitting
    if (!poGroups || poGroups.length === 0) {
      alert('No purchase order groups available. Please ensure all items have selected suppliers.');
      // Try to regroup
      await groupByVendor();
      return;
    }

    // Get auth token
    const token = localStorage.getItem('token');
    
    try {
      console.log('Creating POs with groups:', poGroups);
      
      const res = await fetch('/api/po/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ poGroups, boqId })
      });
      
      // Check if response is ok
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Failed to create purchase orders';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Check if response has content
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(text);
      
      if (data.success) {
        setConfirmed(true);
        // Redirect to service provider dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        alert(data.message || 'Failed to create purchase orders');
      }
    } catch (error) {
      console.error('Failed to create POs:', error);
      alert(error.message || 'Failed to create purchase orders. Please try again.');
    }
  };

  if (confirmed) {
    return (
      <div className="page">
        <div className="success-state">
          <Check size={64} className="success-icon" />
          <h2>Purchase Orders Created!</h2>
          <p>All POs have been successfully generated and sent to vendors.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Create Purchase Orders</h1>
          <p>Grouping items by vendor...</p>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p>Please wait while we group your purchase orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Create Purchase Orders</h1>
          <p>Error grouping purchase orders</p>
        </div>
        <div style={{ 
          background: '#fee2e2', 
          border: '1px solid #fca5a5', 
          borderRadius: '8px', 
          padding: '1.5rem', 
          margin: '2rem 0',
          color: '#991b1b'
        }}>
          <h3 style={{ marginTop: 0, color: '#991b1b' }}>Error</h3>
          <p>{error}</p>
          <button 
            className="btn-primary" 
            onClick={groupByVendor}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Create Purchase Orders</h1>
        <p>Review and confirm POs grouped by vendor</p>
      </div>

      {poGroups.length === 0 ? (
        <div style={{ 
          background: '#fef3c7', 
          border: '1px solid #fcd34d', 
          borderRadius: '8px', 
          padding: '1.5rem', 
          margin: '2rem 0',
          color: '#92400e'
        }}>
          <h3 style={{ marginTop: 0, color: '#92400e' }}>No Purchase Orders to Create</h3>
          <p>No purchase order groups were created. This might happen if:</p>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>No suppliers were selected for the items</li>
            <li>The selected suppliers don't have matching products in the database</li>
            <li>There was an error processing the items</li>
          </ul>
          <button 
            className="btn-primary" 
            onClick={groupByVendor}
            style={{ marginTop: '1rem' }}
          >
            Retry Grouping
          </button>
        </div>
      ) : (
        <>
          <div className="po-list">
            {poGroups.map((group) => (
              <div key={group.vendorId} className="po-card">
                <div className="po-header">
                  <h3>{group.vendorName}</h3>
                  <div className="po-total">₹{group.total?.toLocaleString() || '0'}</div>
                </div>
                <table className="po-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td>{item.quantity} {item.unit || ''}</td>
                        <td>₹{item.price?.toLocaleString() || '0'}</td>
                        <td>₹{((item.quantity || 0) * (item.price || 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <button 
            className="btn-primary btn-large" 
            onClick={handleConfirm}
            disabled={poGroups.length === 0}
          >
            Confirm & Create All POs
          </button>
        </>
      )}
    </div>
  );
};

export default CreatePO;
