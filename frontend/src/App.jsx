import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ServiceProviderRoute from './components/ServiceProviderRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import ServiceProviderDashboard from './pages/ServiceProviderDashboard';
import SupplierDashboard from './pages/SupplierDashboard';
import SupplierProductSetup from './pages/SupplierProductSetup';
import ProductManagement from './pages/ProductManagement';
import AdminDashboardOverview from './pages/AdminDashboardOverview';
import AdminUsers from './pages/AdminUsers';
import AdminTransactions from './pages/AdminTransactions';
import AdminSuppliers from './pages/AdminSuppliers';
import AdminServiceProviders from './pages/AdminServiceProviders';
import AdminProductStatus from './pages/AdminProductStatus';
import BOQNormalize from './pages/BOQNormalize';
import VendorSelect from './pages/VendorSelect';
import Substitution from './pages/Substitution';
import CreatePO from './pages/CreatePO';
import { getApiUrl } from './config/api';

function App() {
  const [normalizedItems, setNormalizedItems] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState({});
  const [substitutions, setSubstitutions] = useState([]);
  const [boqId, setBoqId] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supplierSetupStatus, setSupplierSetupStatus] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Check supplier setup status if user is a supplier
        if (parsedUser.userType === 'supplier') {
          checkSupplierSetupStatus(token);
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Update document title based on logged-in user
  useEffect(() => {
    if (user && user.name) {
      // Get user type label
      let userTypeLabel = '';
      if (user.userType === 'admin') {
        userTypeLabel = 'Admin';
      } else if (user.userType === 'supplier') {
        userTypeLabel = 'Supplier';
      } else if (user.userType === 'service_provider') {
        userTypeLabel = 'Service Provider';
      }
      
      // Set title with user name and type
      if (userTypeLabel) {
        document.title = `${user.name} (${userTypeLabel}) - Tatva Direct`;
      } else {
        document.title = `${user.name} - Tatva Direct`;
      }
    } else {
      document.title = 'Tatva Direct';
    }
  }, [user]);

  const checkSupplierSetupStatus = async (token) => {
    try {
      const response = await fetch(getApiUrl('/api/supplier/setup-status'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSupplierSetupStatus(data.hasProducts);
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const handleLogin = async (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    
    // Check supplier setup status if user is a supplier
    if (userData.userType === 'supplier') {
      const token = localStorage.getItem('token');
      if (token) {
        await checkSupplierSetupStatus(token);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    resetWorkflow();
  };

  // Reset state when starting over
  const resetWorkflow = () => {
    setNormalizedItems([]);
    setSelectedVendors({});
    setSubstitutions([]);
    setBoqId(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            (user?.userType === 'admin' ? <Navigate to="/admin-dashboard" replace /> :
             user?.userType === 'service_provider' ? <Navigate to="/dashboard" replace /> :
             user?.userType === 'supplier' ? <Navigate to="/supplier-dashboard" replace /> :
             <Navigate to="/dashboard" replace />) : 
            <Login onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/admin-login" 
          element={
            isAuthenticated && user?.userType === 'admin' ? 
            <Navigate to="/admin-dashboard" replace /> : 
            isAuthenticated ? 
            <Navigate to="/" replace /> :
            <AdminLogin onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/signup" 
          element={
            isAuthenticated ? 
            (user?.userType === 'admin' ? <Navigate to="/admin-dashboard" replace /> :
             user?.userType === 'service_provider' ? <Navigate to="/dashboard" replace /> :
             user?.userType === 'supplier' ? <Navigate to="/supplier-dashboard" replace /> :
             <Navigate to="/dashboard" replace />) : 
            <Signup onLogin={handleLogin} />
          } 
        />
        
        {/* Protected Routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        >
          <Route 
            index 
            element={
              user?.userType === 'admin' ?
              <Navigate to="/admin-dashboard" replace /> :
              user?.userType === 'service_provider' ? 
              <Navigate to="/dashboard" replace /> : 
              user?.userType === 'supplier' ?
              (supplierSetupStatus === false ? 
                <Navigate to="/supplier-setup" replace /> :
                supplierSetupStatus === true ?
                <Navigate to="/supplier-dashboard" replace /> :
                <Navigate to="/supplier-dashboard" replace />) :
              <Navigate to="/boq-normalize" replace />
            } 
          />
          <Route 
            path="admin-dashboard" 
            element={
              <AdminRoute user={user} isAuthenticated={isAuthenticated}>
                <AdminDashboardOverview user={user} />
              </AdminRoute>
            } 
          />
          <Route 
            path="admin-users" 
            element={
              <AdminRoute user={user} isAuthenticated={isAuthenticated}>
                <AdminUsers user={user} />
              </AdminRoute>
            } 
          />
          <Route 
            path="admin-transactions" 
            element={
              <AdminRoute user={user} isAuthenticated={isAuthenticated}>
                <AdminTransactions user={user} />
              </AdminRoute>
            } 
          />
          <Route 
            path="admin-suppliers" 
            element={
              <AdminRoute user={user} isAuthenticated={isAuthenticated}>
                <AdminSuppliers user={user} />
              </AdminRoute>
            } 
          />
          <Route 
            path="admin-service-providers" 
            element={
              <AdminRoute user={user} isAuthenticated={isAuthenticated}>
                <AdminServiceProviders user={user} />
              </AdminRoute>
            } 
          />
          <Route 
            path="admin-product-status" 
            element={
              <AdminRoute user={user} isAuthenticated={isAuthenticated}>
                <AdminProductStatus user={user} />
              </AdminRoute>
            } 
          />
          <Route 
            path="dashboard" 
            element={<ServiceProviderDashboard user={user} />} 
          />
          <Route 
            path="supplier-setup" 
            element={<SupplierProductSetup user={user} />} 
          />
          <Route 
            path="supplier-dashboard" 
            element={<SupplierDashboard user={user} />} 
          />
          <Route 
            path="product-management" 
            element={<ProductManagement user={user} />} 
          />
          <Route 
            path="profile" 
            element={<Profile user={user} />} 
          />
          <Route 
            path="boq-normalize" 
            element={
              <ServiceProviderRoute user={user}>
                <BOQNormalize onComplete={(items, id) => { setNormalizedItems(items); setBoqId(id); }} />
              </ServiceProviderRoute>
            } 
          />
          <Route 
            path="supplier-select" 
            element={
              <ServiceProviderRoute user={user}>
                <VendorSelect items={normalizedItems} onComplete={setSelectedVendors} />
              </ServiceProviderRoute>
            } 
          />
          <Route 
            path="substitution" 
            element={
              <ServiceProviderRoute user={user}>
                <Substitution selectedVendors={selectedVendors} onComplete={setSubstitutions} items={normalizedItems} />
              </ServiceProviderRoute>
            } 
          />
          <Route 
            path="create-po" 
            element={
              <ServiceProviderRoute user={user}>
                <CreatePO selectedVendors={selectedVendors} substitutions={substitutions} boqId={boqId} items={normalizedItems} />
              </ServiceProviderRoute>
            } 
          />
        </Route>
        
        {/* Redirect to login if not authenticated */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
