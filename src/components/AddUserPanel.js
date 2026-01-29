import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AddUserPanel.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const AddUserPanel = ({ onBack, onUserAdded }) => {
  const [userType, setUserType] = useState("employee"); // employee, supervisor, admin
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    role: "employee",
    // Employee-specific fields
    position: "",
    department: "",
    email: "",
    contact_number: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Reset form when user type changes
  useEffect(() => {
    setFormData({
      name: "",
      password: "",
      confirmPassword: "",
      role: userType === "employee" ? "employee" : userType,
      position: "",
      department: "",
      email: "",
      contact_number: "",
      address: "",
    });
    setFeedback(null);
  }, [userType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFeedback(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setFeedback({ type: "error", message: "Name is required" });
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setFeedback({ type: "error", message: "Password must be at least 6 characters" });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setFeedback({ type: "error", message: "Passwords do not match" });
      return false;
    }

    // Employee-specific validation
    if (userType === "employee") {
      if (!formData.position.trim()) {
        setFeedback({ type: "error", message: "Position is required for employees" });
        return false;
      }
      if (!formData.department.trim()) {
        setFeedback({ type: "error", message: "Department is required for employees" });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (userType === "employee") {
        // Create employee with user account
        const { confirmPassword, role, ...employeeData } = formData;
        const response = await axios.post(`${API_BASE_URL}/add-employee`, employeeData);
        
        if (response.data.error) {
          throw new Error(response.data.error);
        }

        setFeedback({ 
          type: "success", 
          message: "✅ Employee added successfully!" 
        });
      } else {
        // Create supervisor or admin user
        const { confirmPassword, position, department, email, contact_number, address, ...userData } = formData;
        const response = await axios.post(`${API_BASE_URL}/add-user`, userData);

        if (response.data.error) {
          throw new Error(response.data.error);
        }

        setFeedback({ 
          type: "success", 
          message: `✅ ${userType === "supervisor" ? "Supervisor" : "Admin"} added successfully!` 
        });
      }

      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          name: "",
          password: "",
          confirmPassword: "",
          role: userType === "employee" ? "employee" : userType,
          position: "",
          department: "",
          email: "",
          contact_number: "",
          address: "",
        });
        setFeedback(null);
        if (onUserAdded) onUserAdded();
      }, 1500);

    } catch (error) {
      console.error("Error adding user:", error);
      setFeedback({ 
        type: "error", 
        message: `❌ ${error.response?.data?.error || error.message || "Failed to add user"}` 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-user-panel">
      <div className="panel-header">
        <button className="back-btn" onClick={onBack}>
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
        <h2>
          <i className="fas fa-user-plus"></i> Add New User
        </h2>
      </div>

      {/* User Type Selector */}
      <div className="user-type-selector">
        <button
          className={`type-btn ${userType === "employee" ? "active" : ""}`}
          onClick={() => setUserType("employee")}
        >
          <i className="fas fa-user"></i>
          <span>Employee</span>
          <p>Regular system user with basic access</p>
        </button>
        <button
          className={`type-btn ${userType === "supervisor" ? "active" : ""}`}
          onClick={() => setUserType("supervisor")}
        >
          <i className="fas fa-user-tie"></i>
          <span>Supervisor</span>
          <p>Limited management access</p>
        </button>
        <button
          className={`type-btn ${userType === "admin" ? "active" : ""}`}
          onClick={() => setUserType("admin")}
        >
          <i className="fas fa-user-shield"></i>
          <span>Administrator</span>
          <p>Full system access and control</p>
        </button>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className={`feedback-message ${feedback.type}`}>
          <i className={`fas fa-${feedback.type === "success" ? "check-circle" : "exclamation-triangle"}`}></i>
          {feedback.message}
        </div>
      )}

      {/* User Form */}
      <form className="user-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>
            <i className="fas fa-id-card"></i> Basic Information
          </h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>
        </div>

        {/* Employee-specific fields */}
        {userType === "employee" && (
          <div className="form-section employee-section">
            <h3>
              <i className="fas fa-briefcase"></i> Employment Details
            </h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="position">
                  Position <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="Job title"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="department">
                  Department <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="Department name"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact_number">Contact Number</label>
                <input
                  type="text"
                  id="contact_number"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  placeholder="+63 XXX XXX XXXX"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Complete address"
                  rows="3"
                />
              </div>
            </div>
          </div>
        )}

        {/* Role Information Display */}
        {userType !== "employee" && (
          <div className="role-info">
            <i className="fas fa-info-circle"></i>
            <p>
              {userType === "supervisor" 
                ? "Supervisors can view all data, generate reports, but cannot delete critical information."
                : "Administrators have full system access including user management and system configuration."}
            </p>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onBack}>
            <i className="fas fa-times"></i> Cancel
          </button>
          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Adding...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i> Add {userType === "employee" ? "Employee" : userType === "supervisor" ? "Supervisor" : "Admin"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddUserPanel;
