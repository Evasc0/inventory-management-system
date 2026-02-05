import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SupervisorDashboard.css';
import StatCard from './common/StatCard';
import QuickActionCard from './common/QuickActionCard';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const SupervisorDashboard = ({ userName, onNavigate }) => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalEmployees: 0,
    totalReturns: 0,
    pendingReturns: 0,
    recentProducts: [],
    recentReturns: [],
    topEmployees: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [productsRes, employeesRes, returnsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/products/all`),
        axios.get(`${API_BASE_URL}/get-all-employees`),
        axios.get(`${API_BASE_URL}/api/returns/all`)
      ]);

      const products = productsRes.data || [];
      const employees = employeesRes.data || [];
      const returns = returnsRes.data || [];

      // Calculate employee stats
      const employeeStats = {};
      products.forEach(product => {
        if (product.employee_name) {
          if (!employeeStats[product.employee_name]) {
            employeeStats[product.employee_name] = { count: 0, value: 0 };
          }
          employeeStats[product.employee_name].count++;
          employeeStats[product.employee_name].value += product.total_amount || 0;
        }
      });

      const topEmployees = Object.entries(employeeStats)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const pendingReturns = returns.filter(r => !r.second_received_by).length;

      setStats({
        totalProducts: products.length,
        totalEmployees: employees.length,
        totalReturns: returns.length,
        pendingReturns,
        recentProducts: products.slice(0, 5),
        recentReturns: returns.slice(0, 5),
        topEmployees
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="supervisor-dashboard">
        <div className="dashboard-header">
          <h1>Supervisor Dashboard</h1>
          <p>Welcome, {userName}!</p>
        </div>
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="supervisor-dashboard">
      <div className="dashboard-header">
        <h1>Supervisor Dashboard</h1>
        <p>Welcome, {userName}!</p>
        <button className="refresh-btn" onClick={fetchDashboardData}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon="fas fa-boxes"
          color="blue"
          onClick={() => onNavigate('articles')}
        />
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon="fas fa-users"
          color="green"
          onClick={() => onNavigate('employees')}
        />
        <StatCard
          title="Total Returns"
          value={stats.totalReturns}
          icon="fas fa-undo"
          color="orange"
          onClick={() => onNavigate('returns')}
        />
        <StatCard
          title="Pending Returns"
          value={stats.pendingReturns}
          icon="fas fa-clock"
          color="red"
          onClick={() => onNavigate('returns')}
        />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <QuickActionCard
            title="Review Articles"
            description="Manage inventory items"
            icon="fas fa-list-check"
            color="blue"
            onClick={() => onNavigate('articles')}
          />
          <QuickActionCard
            title="Review Returns"
            description="Process pending returns"
            icon="fas fa-clipboard-check"
            color="orange"
            onClick={() => onNavigate('returns')}
          />
          <QuickActionCard
            title="Generate Reports"
            description="Export inventory reports"
            icon="fas fa-chart-bar"
            color="green"
            onClick={() => onNavigate('reports')}
          />
          <QuickActionCard
            title="Manage Employees"
            description="View employee performance"
            icon="fas fa-users-cog"
            color="purple"
            onClick={() => onNavigate('employees')}
          />
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="dashboard-content">
        <div className="content-section">
          <h2>Recent Products</h2>
          <div className="recent-items">
            {stats.recentProducts.length > 0 ? (
              stats.recentProducts.map((product, index) => (
                <div key={index} className="recent-item">
                  <div className="item-info">
                    <h4>{product.article}</h4>
                    <p>{product.employee_name || 'No User Assigned'}</p>
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
          <h2>Top Employees</h2>
          <div className="employee-stats">
            {stats.topEmployees.length > 0 ? (
              stats.topEmployees.map((employee, index) => (
                <div key={index} className="employee-item">
                  <div className="employee-info">
                    <div className="employee-rank">#{index + 1}</div>
                    <div className="employee-details">
                      <h4>{employee.name}</h4>
                      <p>{employee.count} items assigned</p>
                    </div>
                  </div>
                  <div className="employee-value">
                    ₱{employee.value.toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">No employee data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
