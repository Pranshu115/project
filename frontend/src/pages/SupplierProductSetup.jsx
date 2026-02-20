import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, Box, Save, ArrowRight } from 'lucide-react';
import tatvaLogo from '../images/tatva_d.png';
import './Auth.css';
import './SupplierProductSetup.css';

const SupplierProductSetup = ({ user }) => {
  const [formData, setFormData] = useState({
    name: '', // Product name, not supplier name
    category: 'steel',
    price: '',
    unit: 'kg',
    stock: '',
    location: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate required fields
    if (!formData.name || !formData.price || !formData.stock || !formData.location) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/supplier/products'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          unit: formData.unit,
          stock: parseInt(formData.stock),
          location: formData.location,
          description: formData.description || ''
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // Redirect to supplier dashboard
        navigate('/supplier-dashboard');
      } else {
        setError(data.message || 'Failed to save product information');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card setup-card">
        <div className="auth-header">
          <img src={tatvaLogo} alt="Tatva Direct" className="auth-logo" />
          <h1>Welcome to Tatva Direct!</h1>
          <p>Let's set up your first product to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form setup-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {user?.name && (
            <div className="form-group" style={{ 
              padding: '1rem', 
              backgroundColor: '#f0f9ff', 
              borderRadius: '8px', 
              marginBottom: '1.5rem',
              border: '1px solid #bae6fd'
            }}>
              <label style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Supplier Information
              </label>
              <p style={{ fontSize: '1rem', fontWeight: '600', color: '#1e40af', margin: 0 }}>
                {user.name}
                {user.company && ` • ${user.company}`}
              </p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">
              <Package size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Product Name *
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="What product do you want to sell?"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <div className="input-wrapper">
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="select-input"
              >
                <option value="steel">Steel & Metal</option>
                <option value="cement">Cement & Concrete</option>
                <option value="aggregates">Aggregates</option>
                <option value="masonry">Masonry</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="hardware">Hardware</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price">
                Price *
              </label>
              <div className="input-wrapper">
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="unit">Unit *</label>
              <div className="input-wrapper">
                <select
                  id="unit"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  className="select-input"
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ton">Ton</option>
                  <option value="bag">Bag</option>
                  <option value="cft">Cubic Feet (cft)</option>
                  <option value="nos">Numbers (nos)</option>
                  <option value="sqft">Square Feet (sqft)</option>
                  <option value="meter">Meter</option>
                  <option value="liter">Liter</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="stock">
              <Box size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Available Stock *
            </label>
            <div className="input-wrapper">
              <input
                type="number"
                id="stock"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                placeholder="How many units are available?"
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">
              <MapPin size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Your Location *
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter your business location (e.g., Mumbai, Maharashtra)"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <div className="input-wrapper">
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add any additional details about your product..."
                rows="3"
                className="textarea-input"
              />
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <div className="spinner" />
            ) : (
              <>
                <Save size={20} />
                Save & Continue to Dashboard
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            You can add more products and edit this information later in your dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupplierProductSetup;
