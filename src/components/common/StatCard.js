import React from 'react';

const StatCard = ({ title, value, icon, color, onClick, showArrow = false }) => (
  <div className={`stat-card ${color}`} onClick={onClick}>
    <div className="stat-icon">
      <i className={icon}></i>
    </div>
    <div className="stat-content">
      <h3>{value}</h3>
      <p>{title}</p>
    </div>
    {showArrow && (
      <div className="stat-arrow">
        <i className="fas fa-chevron-right"></i>
      </div>
    )}
  </div>
);

export default StatCard;
