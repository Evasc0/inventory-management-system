import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EmployeeDashboard.css';
import { useNavigate } from 'react-router-dom';
import StatCard from './common/StatCard';
import QuickActionCard from './common/QuickActionCard';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const EmployeeDashboard = ({ userName, onViewChange }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    myProducts: 0,
    myReturns: 0,
    totalValue: 0,
    recentProducts: [],
    recentReturns: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [userName]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch employee-specific data
      const [productsRes, returnsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/get-products/${encodeURIComponent(userName)}`),
        axios.get(`${API_BASE_URL}/get-receipts/${encodeURIComponent(userName)}`)
      ]);

      const products = productsRes.data || [];
      const returns = returnsRes.data || [];

      // Calculate total value
      const totalValue = products.reduce((sum, product) => sum + (product.total_amount || 0), 0);

      setStats({
        myProducts: products.length,
        myReturns: returns.length,
        totalValue,
        recentProducts: products.slice(0, 5),
        recentReturns: returns.slice(0, 5)
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (action) => {
    switch (action) {
      case 'my-products':
      case 'articles':
        onViewChange('articles');
        break;
      case 'my-receipts':
      case 'receipts':
        onViewChange('receipts');
        break;
      case 'add-article':
        navigate('/add-article');
        break;
      case 'add-return':
        navigate('/add-return');
        break;
      case 'profile':
        onViewChange('profile');
        break;
      default:
        break;
    }
  };



  if (loading) {
    return (
      <div className="employee-dashboard">
        <div className="dashboard-header">
          <div className="header-info">
            <h1><i className="fas fa-tachometer-alt"></i> Dashboard</h1>
            <p>Welcome back, {userName}!</p>
          </div>
          <button className="refresh-btn" onClick={fetchDashboardData}>
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-dashboard">
      <div className="dashboard-header">
        <div className="header-info">
          <h1><i className="fas fa-tachometer-alt"></i> Dashboard</h1>
          <p>Welcome back, {userName}!</p>
        </div>
        <button className="refresh-btn" onClick={fetchDashboardData}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <StatCard
          title="My Products"
          value={stats.myProducts}
          icon="fas fa-boxes"
          color="blue"
          onClick={() => handleNavigation('my-products')}
        />
        <StatCard
          title="My Returns"
          value={stats.myReturns}
          icon="fas fa-undo"
          color="orange"
          onClick={() => handleNavigation('my-receipts')}
        />
        <StatCard
          title="Total Value"
          value={`₱${stats.totalValue.toLocaleString()}`}
          icon="fas fa-peso-sign"
          color="green"
          onClick={() => handleNavigation('my-products')}
        />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2><i className="fas fa-bolt"></i> Quick Actions</h2>
        <div className="actions-grid">
          <QuickActionCard
            title="Add New Article"
            description="Register new inventory item"
            icon="fas fa-plus-circle"
            color="blue"
            onClick={() => handleNavigation('add-article')}
          />
          <QuickActionCard
            title="Submit Return"
            description="Process item return"
            icon="fas fa-reply"
            color="orange"
            onClick={() => handleNavigation('add-return')}
          />
          <QuickActionCard
            title="View My Items"
            description="See all your assigned items"
            icon="fas fa-list"
            color="green"
            onClick={() => handleNavigation('my-products')}
          />
          <QuickActionCard
            title="My Returns"
            description="View return history"
            icon="fas fa-history"
            color="purple"
            onClick={() => handleNavigation('my-receipts')}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-content">
        <div className="content-section">
          <h2><i className="fas fa-clock"></i> Recent Products</h2>
          <div className="recent-items">
            {stats.recentProducts.length > 0 ? (
              stats.recentProducts.map((product, index) => (
                <div key={index} className="recent-item" onClick={() => handleNavigation('my-products')}>
                  <div className="item-icon">
                    <i className="fas fa-box"></i>
                  </div>
                  <div className="item-info">
                    <h4>{product.article}</h4>
                    <p>{product.description}</p>
                  </div>
                  <div className="item-meta">
                    <span className="item-value">₱{Number(product.unit_value).toLocaleString()}</span>
                    <span className="item-quantity">Qty: {product.balance_per_card || 0}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                <i className="fas fa-inbox"></i>
                <p>No products assigned yet</p>
                <button onClick={() => handleNavigation('add-article')} className="action-btn">
                  <i className="fas fa-plus"></i> Add First Product
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="content-section">
          <h2><i className="fas fa-receipt"></i> Recent Returns</h2>
          <div className="recent-items">
            {stats.recentReturns.length > 0 ? (
              stats.recentReturns.map((returnItem, index) => (
                <div key={index} className="recent-item" onClick={() => handleNavigation('my-receipts')}>
                  <div className="item-icon">
                    <i className="fas fa-undo"></i>
                  </div>
                  <div className="item-info">
                    <h4>{returnItem.description}</h4>
                    <p>RRSP: {returnItem.rrsp_no}</p>
                  </div>
                  <div className="item-meta">
                    <span className="item-value">₱{Number(returnItem.amount).toLocaleString()}</span>
                    <span className="item-date">{new Date(returnItem.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                <i className="fas fa-receipt"></i>
                <p>No recent returns</p>
                <button onClick={() => handleNavigation('add-return')} className="action-btn">
                  <i className="fas fa-reply"></i> Submit Return
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
