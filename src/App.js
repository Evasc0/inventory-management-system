import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AdminPanel from "./components/AdminPanel";
import EmployeePanel from "./components/EmployeePanel";
import SupervisorPanel from "./components/SupervisorPanel";
import Login from "./components/Login";
import ReturnsPanel from "./components/returnsPanel";
import EnhancedReturnsPanel from "./components/EnhancedReturnsPanel";
import "./App.css";
import EmployeeReceipts from "./components/EmployeeReceipts";
import EmployeeAddArticle from "./components/EmployeeAddArticle";
import EmployeeAddReturn from "./components/EmployeeAddReturn";
import ArticlesManagement from './components/ArticlesManagement';
import ReturnsManagement from './components/ReturnsManagement';


function App() {
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    const storedUser = localStorage.getItem("userName");
    if (storedRole) setUserRole(storedRole);
    if (storedUser) setUserName(storedUser);
  }, []);

  const handleLogin = (role, user, userData = {}) => {
    setUserRole(role);
    setUserName(user);
    localStorage.setItem("userRole", role);
    localStorage.setItem("userName", user);
    
    // Store additional user data if available
    if (userData.employeeId) {
      localStorage.setItem("employeeId", userData.employeeId);
    }
    if (userData.userId) {
      localStorage.setItem("userId", userData.userId);
    }
  };

  const handleLogout = () => {
    setUserRole("");
    setUserName("");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("employeeId");
    localStorage.removeItem("userId");
    navigate("/");
  };

  return (
    <>
      {userRole && (
        <div className="App">
          <header className="header">
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <i className="fas fa-boxes" style={{fontSize: '24px', color: '#667eea'}}></i>
              <span>BTS Inventory Management</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt" style={{marginRight: '6px'}}></i>
              Logout
            </button>
          </header>
        </div>
      )}
      <div className="content">
        <Routes>
          <Route
            path="/supervisor"
            element={userRole === "supervisor" ? <SupervisorPanel /> : <Navigate to="/" />}
          />
          <Route
            path="/"
            element={
              userRole === "admin" ? (
                <AdminPanel />
              ) : userRole === "employee" ? (
                <EmployeePanel userName={userName} />
              ) : userRole === "supervisor" ? (
                <Navigate to="/supervisor" />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route path="/manage-returns" element={<ReturnsManagement />} />
          <Route path="/manage-articles" element={<ArticlesManagement />} />
          <Route path="/employee-receipts" element={<EmployeeReceipts userName={userName} />} />
          <Route path="/returns-panel" element={<EnhancedReturnsPanel />} />
          <Route path="/returns-panel-old" element={<ReturnsPanel />} />
          <Route path="/add-article" element={<EmployeeAddArticle userName={userName} />} />
          <Route
            path="/admin"
            element={userRole === "admin" ? <AdminPanel /> : <Navigate to="/" />}
          />
          <Route
            path="/employee"
            element={userRole === "employee" ? <EmployeePanel userName={userName} /> : <Navigate to="/" />}
          />
          <Route
            path="/add-return"
            element={userRole === "employee" ? <EmployeeAddReturn userName={userName} /> : <Navigate to="/" />}
          />

        </Routes>
      </div>
    </>
  );
}

export default App;
