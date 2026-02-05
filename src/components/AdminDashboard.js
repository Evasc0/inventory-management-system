import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';
import StatCard from './common/StatCard';
import QuickActionCard from './common/QuickActionCard';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const AdminDashboard = ({ onViewChange }) => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalEmployees: 0,
    totalReturns: 0,
    totalUsers: 0,
    recentProducts: [],
    recentReturns: [],
    lowStockItems: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [productsRes, employeesRes, returnsRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/products/all`),
        axios.get(`${API_BASE_URL}/get-all-employees`),
        axios.get(`${API_BASE_URL}/api/returns/all`),
        axios.get(`${API_BASE_URL}/get-users`)
      ]);

      const products = productsRes.data || [];
      const employees = employeesRes.data || [];
      const returns = returnsRes.data || [];
      const users = usersRes.data || [];

      // Calculate stats
      const lowStockItems = products.filter(p => p.on_hand_per_count <= 5);
      const recentProducts = products.slice(0, 5);
      const recentReturns = returns.slice(0, 5);

      setStats({
        totalProducts: products.length,
        totalEmployees: employees.length,
        totalReturns: returns.length,
        totalUsers: users.length,
        recentProducts,
        recentReturns,
        lowStockItems
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <p>Welcome back, Administrator!</p>
        </div>
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back, Administrator!</p>
        <div className="header-actions">
          <button className="add-article-btn" onClick={() => onViewChange('articles')}>
            <i className="fas fa-plus-circle"></i> Add Article
          </button>
          <button className="refresh-btn" onClick={fetchDashboardData}>
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon="fas fa-boxes"
          color="blue"
          onClick={() => onViewChange('articles')}
        />
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon="fas fa-users"
          color="green"
          onClick={() => onViewChange('users')}
        />
        <StatCard
          title="Total Returns"
          value={stats.totalReturns}
          icon="fas fa-undo"
          color="orange"
          onClick={() => onViewChange('returns')}
        />
        <StatCard
          title="System Users"
          value={stats.totalUsers}
          icon="fas fa-user-cog"
          color="purple"
          onClick={() => onViewChange('users')}
        />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <QuickActionCard
            title="Add New Product"
            description="Register new inventory item"
            icon="fas fa-plus-circle"
            color="blue"
            onClick={() => onViewChange('articles')}
          />
          <QuickActionCard
            title="Add New User"
            description="Register employee/supervisor/admin"
            icon="fas fa-user-plus"
            color="green"
            onClick={() => onViewChange('addUser')}
          />
          <QuickActionCard
            title="Manage System Users"
            description="Edit/delete users and employees"
            icon="fas fa-users-cog"
            color="purple"
            onClick={() => onViewChange('users')}
          />
          <QuickActionCard
            title="Export Reports"
            description="Generate inventory reports"
            icon="fas fa-file-export"
            color="orange"
            onClick={() => onViewChange('reports')}
          />
          <QuickActionCard
            title="View Returns"
            description="Process return requests"
            icon="fas fa-undo"
            color="red"
            onClick={() => onViewChange('returns')}
          />
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="dashboard-content">
        <div className="content-section">
          <h2>Recent Products</h2>
          <div className="recent-items">
            {stats.recentProducts.length > 0 ? (
              stats.recentProducts.map((product, index) => (
                <div key={index} className="recent-item">
                  <div className="item-info">
                    <h4>{product.article}</h4>
                    <p>{product.description}</p>
                  </div>
                  <div className="item-meta">
                    <span className="item-value">₱{product.unit_value}</span>
                    <span className="item-date">{new Date(product.date_acquired).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">No recent products</p>
            )}
          </div>
        </div>

        <div className="content-section">
          <h2>Low Stock Alert</h2>
          <div className="alert-items">
            {stats.lowStockItems.length > 0 ? (
              stats.lowStockItems.map((item, index) => (
                <div key={index} className="alert-item">
                  <div className="alert-icon">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <div className="alert-info">
                    <h4>{item.article}</h4>
                    <p>Only {item.on_hand_per_count} left in stock</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">All items are well stocked</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
