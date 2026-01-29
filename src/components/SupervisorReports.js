import React, { useState } from 'react';
import axios from 'axios';
import './SupervisorReports.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const SupervisorReports = () => {
  const [reportType, setReportType] = useState('products');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [includeReturns, setIncludeReturns] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Set default dates (last 6 months for better data coverage)
  React.useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    setDateRange({
      startDate: sixMonthsAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    });
  }, []);

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateReport = async (format) => {
    if (!dateRange.startDate || !dateRange.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
      alert('Start date cannot be after end date');
      return;
    }

    setIsGenerating(true);
    
    try {
      let url = '';
      let filename = '';
      
      if (reportType === 'products') {
        const params = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          includeReturns: includeReturns.toString()
        });
        url = `${API_BASE_URL}/export-products/${format}?${params}`;
        filename = `inventory_report_${dateRange.startDate}_to_${dateRange.endDate}.${format}`;
      } else if (reportType === 'returns') {
        const params = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
        url = `${API_BASE_URL}/export-returns/${format}?${params}`;
        filename = `returns_report_${dateRange.startDate}_to_${dateRange.endDate}.${format}`;
      } else if (reportType === 'combined') {
        const params = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          includeReturns: 'true'
        });
        url = `${API_BASE_URL}/export-products/${format}?${params}`;
        filename = `combined_report_${dateRange.startDate}_to_${dateRange.endDate}.${format}`;
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ ${format.toUpperCase()} report generated successfully`);
    } catch (error) {
      console.error(`❌ Error generating ${format} report:`, error);
      alert(`Failed to generate ${format.toUpperCase()} report. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const reportOptions = [
    {
      id: 'products',
      title: 'Inventory Products Report',
      description: 'Complete list of all inventory items with details',
      icon: 'fas fa-boxes',
      color: 'blue'
    },
    {
      id: 'returns',
      title: 'Returns Report',
      description: 'All returned items and receipts data',
      icon: 'fas fa-undo',
      color: 'orange'
    },
    {
      id: 'combined',
      title: 'Combined Report',
      description: 'Products and returns in a single comprehensive report',
      icon: 'fas fa-file-alt',
      color: 'purple'
    }
  ];

  return (
    <div className="supervisor-reports">
      <div className="reports-header">
        <h2>
          <i className="fas fa-chart-bar"></i>
          Generate Reports
        </h2>
        <p>Export comprehensive inventory and returns reports for analysis</p>
      </div>

      <div className="reports-content">
        {/* Report Type Selection */}
        <div className="report-options">
          <h3>Select Report Type</h3>
          <div className="options-grid">
            {reportOptions.map(option => (
              <div
                key={option.id}
                className={`option-card ${option.color} ${reportType === option.id ? 'active' : ''}`}
                onClick={() => setReportType(option.id)}
              >
                <div className="option-icon">
                  <i className={option.icon}></i>
                </div>
                <div className="option-content">
                  <h4>{option.title}</h4>
                  <p>{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="date-range-section">
          <h3>Select Date Range</h3>
          <div className="date-inputs">
            <div className="date-group">
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                id="startDate"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>
            <div className="date-group">
              <label htmlFor="endDate">End Date:</label>
              <input
                type="date"
                id="endDate"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Additional Options */}
        {reportType === 'products' && (
          <div className="additional-options">
            <h3>Additional Options</h3>
            <div className="options-list">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={includeReturns}
                  onChange={(e) => setIncludeReturns(e.target.checked)}
                />
                <span className="checkmark"></span>
                Include Returns Data (for inventory reports)
              </label>
            </div>
          </div>
        )}

        {/* Export Buttons */}
        <div className="export-section">
          <h3>Export Report</h3>
          <div className="export-buttons">
            <button
              className="export-btn pdf"
              onClick={() => generateReport('pdf')}
              disabled={isGenerating}
            >
              <i className="fas fa-file-pdf"></i>
              {isGenerating ? 'Generating...' : 'Export as PDF'}
            </button>
            <button
              className="export-btn excel"
              onClick={() => generateReport('excel')}
              disabled={isGenerating}
            >
              <i className="fas fa-file-excel"></i>
              {isGenerating ? 'Generating...' : 'Export as Excel'}
            </button>
          </div>
        </div>

        {/* Report Summary */}
        <div className="report-summary">
          <h3>Report Summary</h3>
          <div className="summary-content">
            <div className="summary-item">
              <strong>Report Type:</strong> {reportOptions.find(opt => opt.id === reportType)?.title}
            </div>
            <div className="summary-item">
              <strong>Date Range:</strong> {dateRange.startDate} to {dateRange.endDate}
            </div>
            {reportType === 'products' && (
              <div className="summary-item">
                <strong>Include Returns:</strong> {includeReturns ? 'Yes' : 'No'}
              </div>
            )}
            {reportType === 'combined' && (
              <div className="summary-item">
                <strong>Data Included:</strong> Products and Returns
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorReports;
