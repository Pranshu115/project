import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { FileText, Users, RefreshCw, ShoppingCart, User, LogOut, ChevronDown, BarChart3, Package, Building, CheckCircle } from 'lucide-react';
import tatvaLogo from '../images/tatva_d.png';
import './Layout.css';

const Layout = ({ user, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  

  const steps = [
    ...(user?.userType === 'admin' ? [
      {
        path: '/admin-dashboard', 
        label: 'Admin Dashboard', 
        icon: BarChart3 
      },
      {
        path: '/admin-users',
        label: 'Users',
        icon: Users
      },
      {
        path: '/admin-transactions',
        label: 'Transactions',
        icon: ShoppingCart
      },
      {
        path: '/admin-suppliers',
        label: 'Suppliers',
        icon: Package
      },
      {
        path: '/admin-service-providers',
        label: 'Service Providers',
        icon: Building
      },
      {
        path: '/admin-product-status',
        label: 'Product Status',
        icon: CheckCircle
      }
    ] : user?.userType === 'service_provider' ? [{
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: BarChart3 
    }] : user?.userType === 'supplier' ? [
      {
        path: '/supplier-dashboard', 
        label: 'Dashboard', 
        icon: BarChart3 
      },
      {
        path: '/product-management', 
        label: 'Manage Your Product', 
        icon: Package
      }
    ] : []),
    // Only show workflow steps for service providers
    ...(user?.userType === 'service_provider' ? [
      { path: '/boq-normalize', label: 'BOQ Normalize', icon: FileText },
      { path: '/supplier-select', label: 'Supplier Select', icon: Users },
      { path: '/substitution', label: 'Substitution', icon: RefreshCw },
      { path: '/create-po', label: 'Create PO', icon: ShoppingCart }
    ] : [])
  ];

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="logo">
          <img src={tatvaLogo} alt="Tatva Direct" className="logo-image" />
        </div>
        <div className="nav-steps">
          {steps.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            
            return (
              <div
                key={path + label}
                className="nav-step-wrapper"
              >
                <NavLink 
                  to={path} 
                  className={`nav-step ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </NavLink>
              </div>
            );
          })}
        </div>
        
        {/* User Profile Section */}
        <div className="user-section">
          <div 
            className="user-profile"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              <User size={20} />
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-company">
                {user?.userType === 'admin' ? '🔐 Admin' :
                 user?.userType === 'service_provider' ? '🏢 Service Provider' : 
                 user?.userType === 'supplier' ? '🚛 Supplier' : 
                 '👤 User'}
              </div>
            </div>
            <ChevronDown size={16} className={`chevron ${showUserMenu ? 'rotated' : ''}`} />
          </div>
          
          {showUserMenu && (
            <div className="user-menu">
              <NavLink 
                to="/profile" 
                className="user-menu-item"
                onClick={() => setShowUserMenu(false)}
              >
                <User size={16} />
                <span>Profile</span>
              </NavLink>
              <button className="user-menu-item" onClick={onLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
