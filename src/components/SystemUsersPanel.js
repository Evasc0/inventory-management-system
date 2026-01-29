import React, { useState, useEffect } from "react";
import axios from "axios";
import "./SystemUsersPanel.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const SystemUsersPanel = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, employeesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/get-users`),
        axios.get(`${API_BASE_URL}/get-employees`)
      ]);
      
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setFeedback({ type: "error", message: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  // User Operations
  const handleEditUser = (user) => {
    setEditingUser({ ...user });
  };

  const handleEditUserChange = (e) => {
    setEditingUser({ ...editingUser, [e.target.name]: e.target.value });
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE_URL}/edit-user/${editingUser.id}`, editingUser);
      showFeedback("success", "✅ User updated successfully!");
      setEditingUser(null);
      fetchData();
    } catch (error) {
      console.error("Error updating user:", error);
      showFeedback("error", "❌ Failed to update user");
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      try {
        await axios.delete(`${API_BASE_URL}/delete-user/${userId}`);
        showFeedback("success", "✅ User deleted successfully!");
        fetchData();
      } catch (error) {
        console.error("Error deleting user:", error);
        showFeedback("error", "❌ Failed to delete user");
      }
    }
  };

  // Employee Operations
  const handleEditEmployee = (employee) => {
    setEditingEmployee({ ...employee });
  };

  const handleEditEmployeeChange = (e) => {
    setEditingEmployee({ ...editingEmployee, [e.target.name]: e.target.value });
  };

  const handleEditEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE_URL}/edit-employee/${editingEmployee.id}`, editingEmployee);
      showFeedback("success", "✅ Employee updated successfully!");
      setEditingEmployee(null);
      fetchData();
    } catch (error) {
      console.error("Error updating employee:", error);
      showFeedback("error", "❌ Failed to update employee");
    }
  };

  const handleDeleteEmployee = async (employeeId, employeeName) => {
    if (window.confirm(`Are you sure you want to delete employee "${employeeName}"? This will also remove their user account.`)) {
      try {
        await axios.delete(`${API_BASE_URL}/delete-employee/${employeeId}`);
        showFeedback("success", "✅ Employee deleted successfully!");
        fetchData();
      } catch (error) {
        console.error("Error deleting employee:", error);
        showFeedback("error", "❌ Failed to delete employee");
      }
    }
  };

  // Filter and search
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="system-users-panel">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i> Loading users...
        </div>
      </div>
    );
  }

  return (
    <div className="system-users-panel">
      <div className="panel-header">
        <button className="back-btn" onClick={onBack}>
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
        <h2>
          <i className="fas fa-users-cog"></i> System Users Management
        </h2>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className={`feedback-message ${feedback.type}`}>
          <i className={`fas fa-${feedback.type === "success" ? "check-circle" : "exclamation-triangle"}`}></i>
          {feedback.message}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="controls-bar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search by name, position, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <label>Filter by Role:</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="supervisor">Supervisors</option>
            <option value="employee">Employees</option>
          </select>
        </div>
      </div>

      {/* System Users Section */}
      <div className="users-section">
        <div className="section-header">
          <h3>
            <i className="fas fa-user-shield"></i> System Users ({filteredUsers.length})
          </h3>
          <p className="section-description">Administrators and Supervisors with login access</p>
        </div>

        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Employee Link</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name">
                        <i className={`fas fa-${user.role === 'admin' ? 'user-shield' : user.role === 'supervisor' ? 'user-tie' : 'user'}`}></i>
                        {user.name}
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td>{user.employee_name || "—"}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="edit-btn" onClick={() => handleEditUser(user)}>
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        {user.role !== "admin" && (
                          <button className="delete-btn" onClick={() => handleDeleteUser(user.id, user.name)}>
                            <i className="fas fa-trash"></i> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-data">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employees Section */}
      <div className="employees-section">
        <div className="section-header">
          <h3>
            <i className="fas fa-id-card"></i> Employees ({filteredEmployees.length})
          </h3>
          <p className="section-description">All registered employees in the system</p>
        </div>

        <div className="table-container">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Position</th>
                <th>Department</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="employee-name">
                        <i className="fas fa-user"></i>
                        {employee.name}
                      </div>
                    </td>
                    <td>{employee.employee_id || "—"}</td>
                    <td>{employee.position || "—"}</td>
                    <td>{employee.department || "—"}</td>
                    <td>{employee.contact_number || "—"}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="edit-btn" onClick={() => handleEditEmployee(employee)}>
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        <button className="delete-btn" onClick={() => handleDeleteEmployee(employee.id, employee.name)}>
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="no-data">No employees found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fas fa-edit"></i> Edit User</h3>
              <button className="close-btn" onClick={() => setEditingUser(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleEditUserSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={editingUser.name}
                  onChange={handleEditUserChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={editingUser.role} onChange={handleEditUserChange} required>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  <i className="fas fa-check"></i> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="modal-overlay" onClick={() => setEditingEmployee(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fas fa-edit"></i> Edit Employee</h3>
              <button className="close-btn" onClick={() => setEditingEmployee(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleEditEmployeeSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={editingEmployee.name}
                  onChange={handleEditEmployeeChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Position</label>
                <input
                  type="text"
                  name="position"
                  value={editingEmployee.position || ""}
                  onChange={handleEditEmployeeChange}
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={editingEmployee.department || ""}
                  onChange={handleEditEmployeeChange}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={editingEmployee.email || ""}
                  onChange={handleEditEmployeeChange}
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="text"
                  name="contact_number"
                  value={editingEmployee.contact_number || ""}
                  onChange={handleEditEmployeeChange}
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  value={editingEmployee.address || ""}
                  onChange={handleEditEmployeeChange}
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setEditingEmployee(null)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  <i className="fas fa-check"></i> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemUsersPanel;
