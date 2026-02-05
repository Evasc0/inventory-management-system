import React from 'react';

const QuickActionCard = ({ title, description, icon, color, onClick, showArrow = false }) => (
  <div className={`quick-action-card ${color}`} onClick={onClick}>
    <div className="action-icon">
      <i className={icon}></i>
    </div>
    <div className="action-content">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
    {showArrow && (
      <div className="action-arrow">
        <i className="fas fa-arrow-right"></i>
      </div>
    )}
  </div>
);

export default QuickActionCard;
