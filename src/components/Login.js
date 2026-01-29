  import axios from "axios";
import "./Login_new.css";
import React, { useState, useEffect, useRef } from "react";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useSimpleLogin, setUseSimpleLogin] = useState(false);
  const usernameInputRef = useRef(null);

  useEffect(() => {
    setUsername("");
    setPassword("");
    setError("");
    if (usernameInputRef.current) usernameInputRef.current.focus();
    
    // Detect if Login_new.css is properly loaded
    const testElement = document.createElement('div');
    testElement.className = 'login-container';
    testElement.style.visibility = 'hidden';
    testElement.style.position = 'absolute';
    document.body.appendChild(testElement);
    
    const styles = window.getComputedStyle(testElement);
    const hasAdvancedStyling = styles.backdropFilter && styles.backdropFilter !== 'none';
    
    document.body.removeChild(testElement);
    
    // Use simple login if advanced styling isn't available or on mobile
    setUseSimpleLogin(!hasAdvancedStyling || window.innerWidth <= 768);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!username || !password) {
      setError("Please enter both username and password");
      setIsLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/login`, { 
        name: username.trim(),  // ✅ Fixed: server expects 'name', not 'username'
        password 
      });

      if (res.data.role) {
        console.log("✅ Login successful:", res.data);
        onLogin(res.data.role, res.data.name, res.data);
      } else {
        setError("❌ Invalid username or password.");
        if (usernameInputRef.current) usernameInputRef.current.focus();
      }
    } catch (err) {
      console.error("Login error:", err.response?.data || err.message);
      
      if (err.response?.data?.needsSetup) {
        // Employee needs to set up password
        setError("Account needs setup. Please contact administrator.");
      } else {
        setError(err.response?.data?.error || "❌ Error connecting to the server.");
      }
      
      if (usernameInputRef.current) usernameInputRef.current.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Render simple login card if needed
  if (useSimpleLogin) {
    return (
      <div className="login-card">
        <div className="logo-section">
          <div className="logo-icon">
            <i className="fas fa-boxes"></i>
          </div>
          <h2>Inventory System</h2>
          <p className="subtitle">Sign in to access your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-message" style={{color: '#ff6b6b', marginBottom: '15px', fontSize: '14px'}}>
              <i className="fas fa-exclamation-triangle" style={{marginRight: '8px'}}></i>
              {error}
            </div>
          )}
          
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input
              ref={usernameInputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or Employee ID"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>
          
          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{marginRight: '8px'}}></i>
                Signing In...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt" style={{marginRight: '8px'}}></i>
                Sign In
              </>
            )}
          </button>
        </form>
        
        <div className="security-note">
          <i className="fas fa-shield-alt"></i>
          Secure access to your inventory management
        </div>
      </div>
    );
  }

  // Render advanced login with glassmorphism
  return (
    <div className="login">
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>
      
      <div className="login-container">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-icon">
              <i className="fas fa-boxes"></i>
            </div>
            <h1>Inventory System</h1>
          </div>
          <p className="login-subtitle">Sign in to access your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}
          
          <div className="form-group">
            <div className="input-container">
              <i className="fas fa-user input-icon"></i>
              <input
                ref={usernameInputRef}
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or Employee ID"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
          </div>
          
          <div className="form-group">
            <div className="input-container">
              <i className="fas fa-lock input-icon"></i>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            className={`login-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Signing In...
              </>
            ) : (
              <>
                <span>Sign In</span>
                <i className="fas fa-arrow-right"></i>
              </>
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <p>
            <i className="fas fa-shield-alt"></i>
            Secure access to your inventory management
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
