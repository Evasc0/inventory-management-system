import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ReturnsManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const ReturnsManagement = () => {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingReturn, setEditingReturn] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOption, setFilterOption] = useState('all');
  const [expandedReturns, setExpandedReturns] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all returns with complete details
      const response = await axios.get(`${API_BASE_URL}/api/returns/all`);
      let returnsData = Array.isArray(response.data) ? response.data : response.data.returns || [];
      
      // Format and validate data
      returnsData = returnsData.map(ret => ({
        ...ret,
        // Ensure properties match the server response
        end_user: ret.end_user || ret.endUser || '',
        ics_no: ret.ics_no || ret.icsNo || '',
        date_acquired: ret.date_acquired || ret.dateAcquired || '',
        amount: parseFloat(ret.amount) || 0,
        // Include all location data
        returned_by_location: ret.returned_by_location || '',
        received_by_location: ret.received_by_location || '',
        second_received_by_location: ret.second_received_by_location || ''
      }));
      
      // Sort returns by date, most recent first
      returnsData = returnsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Verify unique IDs to prevent toggle issues
      const uniqueIds = new Set(returnsData.map(r => r.id));
      if (uniqueIds.size !== returnsData.length) {
        console.warn('⚠️ Duplicate return IDs detected! This may cause toggle issues.');
      }
      
      console.log('Fetched returns:', returnsData); // For debugging
      setReturns(returnsData);
    } catch (error) {
      console.error('Error fetching returns:', error);
      alert('Failed to fetch returns. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      // Fetch all employees
      const response = await axios.get(`${API_BASE_URL}/get-employees`);
      
      // Sort employees by department and name
      const sortedEmployees = response.data.sort((a, b) => {
        if (a.department !== b.department) {
          return (a.department || '').localeCompare(b.department || '');
        }
        return a.name.localeCompare(b.name);
      });

      setEmployees(sortedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    const initialFetch = async () => {
      await Promise.all([fetchReturns(), fetchEmployees()]);
    };
    initialFetch();
    
    // WebSocket connection for real-time updates (if available)
    // Removed aggressive 3-second polling for performance
  }, [fetchReturns, fetchEmployees]);

  const handleEditReturn = (returnItem) => {
    console.log('Editing return item:', returnItem); // Debug log
    setEditingReturn({
      ...returnItem,
      // Map snake_case to camelCase for form fields
      rrspNo: returnItem.rrspNo || returnItem.rrsp_no || '',
      icsNo: returnItem.icsNo || returnItem.ics_no || '',
      dateAcquired: returnItem.dateAcquired || returnItem.date_acquired || '',
      endUser: returnItem.endUser || returnItem.end_user || '',
      amount: parseFloat(returnItem.amount) || 0,
      quantity: parseInt(returnItem.quantity) || 0,
      date: returnItem.date ? returnItem.date.split('T')[0] : '',
      description: returnItem.description || '',
      remarks: returnItem.remarks || '',
      // Returned By fields
      returnedBy: returnItem.returned_by || '',
      returnedByPosition: returnItem.returned_by_position || '',
      returnedByDate: returnItem.returned_by_date ? returnItem.returned_by_date.split('T')[0] : '',
      returnedByLocation: returnItem.returned_by_location || '',
      // Received By fields
      receivedBy: returnItem.received_by || '',
      receivedByPosition: returnItem.received_by_position || '',
      receivedByDate: returnItem.received_by_date ? returnItem.received_by_date.split('T')[0] : '',
      receivedByLocation: returnItem.received_by_location || '',
      // Second Receiver fields
      secondReceivedBy: returnItem.second_received_by || '',
      secondReceivedByPosition: returnItem.second_received_by_position || '',
      secondReceivedByDate: returnItem.second_received_by_date ? returnItem.second_received_by_date.split('T')[0] : '',
      secondReceivedByLocation: returnItem.second_received_by_location || ''
    });
  };

  const toggleReturnDetails = (returnId) => {
    setExpandedReturns(prev => ({
      ...prev,
      [returnId]: !prev[returnId]
    }));
  };

  const handleExportClick = () => {
    // Set default dates (last 6 months to capture more data)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    setExportStartDate(startDate.toISOString().split('T')[0]);
    setExportEndDate(endDate.toISOString().split('T')[0]);
    setShowExportModal(true);
  };

  const handleExport = (format) => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates');
      return;
    }

    const url = `${API_BASE_URL}/export-returns/${format}?startDate=${exportStartDate}&endDate=${exportEndDate}`;
    window.open(url, '_blank');
    setShowExportModal(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!editingReturn.endUser) {
        alert('Please select a user for this return');
        return;
      }

      const updatedReturn = {
        rrsp_no: editingReturn.rrspNo || editingReturn.rrsp_no || '',
        date: editingReturn.date || '',
        description: editingReturn.description || '',
        quantity: parseInt(editingReturn.quantity) || 0,
        ics_no: editingReturn.icsNo || editingReturn.ics_no || '',
        date_acquired: editingReturn.dateAcquired || editingReturn.date_acquired || '',
        amount: parseFloat(editingReturn.amount) || 0,
        end_user: editingReturn.endUser || editingReturn.end_user || '',
        remarks: editingReturn.remarks || '',
        // Returned By fields
        returned_by: editingReturn.returnedBy || '',
        returned_by_position: editingReturn.returnedByPosition || '',
        returned_by_date: editingReturn.returnedByDate || '',
        returned_by_location: editingReturn.returnedByLocation || '',
        // Received By fields
        received_by: editingReturn.receivedBy || '',
        received_by_position: editingReturn.receivedByPosition || '',
        received_by_date: editingReturn.receivedByDate || '',
        received_by_location: editingReturn.receivedByLocation || '',
        // Second Receiver fields
        second_received_by: editingReturn.secondReceivedBy || '',
        second_received_by_position: editingReturn.secondReceivedByPosition || '',
        second_received_by_date: editingReturn.secondReceivedByDate || '',
        second_received_by_location: editingReturn.secondReceivedByLocation || ''
      };

      console.log('Updating return with data:', updatedReturn);

      const response = await axios.put(
        `${API_BASE_URL}/api/returns/${editingReturn.id}`,
        updatedReturn,
        {
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (response.data) {
        alert('Return updated successfully!');
        setEditingReturn(null);
        // Refresh only after successful update
        fetchReturns();
      }
    } catch (error) {
      console.error('Error updating return:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        alert(`Update failed: ${error.response.data.error || error.response.data.message || 'Server error'}`);
      } else if (error.request) {
        alert('No response from server. Please check your connection.');
      } else {
        alert('Error setting up the request');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingReturn(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = 
      returnItem.rrspNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.end_user?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterOption === 'all') return matchesSearch;
    // Case-insensitive comparison for end_user
    return matchesSearch && returnItem.end_user?.toLowerCase() === filterOption.toLowerCase();
  });

  return (
    <div className="returns-management">
      <div className="returns-header">
        <h2>Returns Management</h2>
        <div className="header-actions">
          <button onClick={fetchReturns} className="refresh-btn-sm">
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
          <button onClick={handleExportClick} className="export-btn">
            <i className="fas fa-file-export"></i> Export Returns
          </button>
          <button onClick={() => navigate('/admin')} className="back-btn">
            ← Back to Admin Panel
          </button>
        </div>
      </div>

      <div className="search-filter-container">
        <input
          type="text"
          placeholder="Search returns by RRSP No, description, or user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select 
          value={filterOption} 
          onChange={(e) => setFilterOption(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Users</option>
          {employees
            .sort((a, b) => {
              if (a.department !== b.department) {
                return a.department?.localeCompare(b.department || '');
              }
              return a.name.localeCompare(b.name);
            })
            .map(emp => (
              <option key={emp.id} value={emp.name}>
                {emp.name} - {emp.department || 'No Department'}
              </option>
            ))
          }
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading returns...</div>
      ) : (
        <div className="returns-list">
          {filteredReturns.length === 0 ? (
            <div className="no-returns">No returns found</div>
          ) : (
            <div className="returns-grid">
              {filteredReturns.map(returnItem => (
                <div key={returnItem.id} className="return-card">
                  <div className="return-header">
                    <div className="return-title">RRSP No: {returnItem.rrspNo}</div>
                    <div className="card-actions">
                      <button 
                        onClick={() => toggleReturnDetails(returnItem.id)} 
                        className="details-btn"
                      >
                        <i className={`fas fa-${expandedReturns[returnItem.id] ? 'eye-slash' : 'eye'}`}></i>
                        {expandedReturns[returnItem.id] ? "Hide Details" : "Show Details"}
                      </button>
                      <button onClick={() => handleEditReturn(returnItem)} className="edit-btn">
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="return-details">
                    <div><strong>Date:</strong><div>{returnItem.date}</div></div>
                    <div><strong>Description:</strong><div>{returnItem.description}</div></div>
                    <div><strong>Quantity:</strong><div>{returnItem.quantity}</div></div>
                    <div><strong>End User:</strong><div>{returnItem.end_user}</div></div>
                    <div><strong>Amount:</strong><div>₱{parseFloat(returnItem.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
                    <div><strong>Remarks:</strong><div>{returnItem.remarks || "—"}</div></div>
                  </div>
                    
                  {expandedReturns[returnItem.id] && (
                    <div className="return-signatures">
                      <div className="signature-section">
                        <h4>📤 Returned By</h4>
                        <div><strong>Name:</strong> {returnItem.returned_by}</div>
                        <div><strong>Position:</strong> {returnItem.returned_by_position}</div>
                        <div><strong>Date:</strong> {returnItem.returned_by_date}</div>
                        <div><strong>Location:</strong> {returnItem.returned_by_location}</div>
                      </div>
                      
                      <div className="signature-section">
                        <h4>📥 Received By</h4>
                        <div><strong>Name:</strong> {returnItem.received_by}</div>
                        <div><strong>Position:</strong> {returnItem.received_by_position}</div>
                        <div><strong>Date:</strong> {returnItem.received_by_date}</div>
                        <div><strong>Location:</strong> {returnItem.received_by_location}</div>
                      </div>

                      {returnItem.second_received_by && (
                        <div className="signature-section">
                          <h4>📥 Second Receiver</h4>
                          <div><strong>Name:</strong> {returnItem.second_received_by}</div>
                          <div><strong>Position:</strong> {returnItem.second_received_by_position}</div>
                          <div><strong>Date:</strong> {returnItem.second_received_by_date}</div>
                          <div><strong>Location:</strong> {returnItem.second_received_by_location}</div>
                        </div>
                      )}
                      
                      <div className="signature-section">
                        <h4>📋 Additional Details</h4>
                        <div><strong>ICS No:</strong> {returnItem.ics_no || "—"}</div>
                        <div><strong>Date Acquired:</strong> {returnItem.date_acquired || "—"}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingReturn && (
        <div className="edit-modal" onClick={(e) => {
          if (e.target.className === 'edit-modal') {
            setEditingReturn(null);
          }
        }}>
          <div className="edit-modal-content">
            <h3>Edit Return</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>RRSP No:</label>
                <input
                  type="text"
                  name="rrspNo"
                  value={editingReturn.rrspNo || ''}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date:</label>
                <input
                  type="date"
                  name="date"
                  value={editingReturn.date ? editingReturn.date.split('T')[0] : ''}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description:</label>
                <input
                  type="text"
                  name="description"
                  value={editingReturn.description || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Quantity:</label>
                <input
                  type="number"
                  name="quantity"
                  value={editingReturn.quantity || ''}
                  onChange={handleInputChange}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>ICS No:</label>
                <input
                  type="text"
                  name="icsNo"
                  value={editingReturn.icsNo || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Date Acquired:</label>
                <input
                  type="date"
                  name="dateAcquired"
                  value={editingReturn.dateAcquired ? editingReturn.dateAcquired.split('T')[0] : ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Amount:</label>
                <input
                  type="number"
                  name="amount"
                  value={editingReturn.amount || ''}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label>End User:</label>
                <select
                  name="endUser"
                  value={editingReturn.endUser || ''}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select User</option>
                  {employees
                    .sort((a, b) => {
                      if (a.department !== b.department) {
                        return a.department?.localeCompare(b.department || '');
                      }
                      return a.name.localeCompare(b.name);
                    })
                    .map(emp => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name} - {emp.department || 'No Department'} ({emp.position || 'No Position'})
                      </option>
                    ))
                  }
                </select>
              </div>
              <div className="form-group">
                <label>Remarks:</label>
                <select
                  name="remarks"
                  value={editingReturn.remarks || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select Remark</option>
                  <option value="Functional">Functional</option>
                  <option value="Destroyed">Destroyed</option>
                  <option value="For Disposal">For Disposal</option>
                </select>
              </div>

              {/* Returned By Section */}
              <div className="form-section-header">
                <h4>📤 Returned By Information</h4>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="returnedBy"
                    value={editingReturn.returnedBy || ''}
                    onChange={handleInputChange}
                    placeholder="Name of person returning"
                  />
                </div>
                <div className="form-group">
                  <label>Position:</label>
                  <input
                    type="text"
                    name="returnedByPosition"
                    value={editingReturn.returnedByPosition || ''}
                    onChange={handleInputChange}
                    placeholder="Position/Title"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date:</label>
                  <input
                    type="date"
                    name="returnedByDate"
                    value={editingReturn.returnedByDate || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Location:</label>
                  <input
                    type="text"
                    name="returnedByLocation"
                    value={editingReturn.returnedByLocation || ''}
                    onChange={handleInputChange}
                    placeholder="Location/Office"
                  />
                </div>
              </div>

              {/* Received By Section */}
              <div className="form-section-header">
                <h4>📥 Received By Information</h4>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="receivedBy"
                    value={editingReturn.receivedBy || ''}
                    onChange={handleInputChange}
                    placeholder="Name of receiver"
                  />
                </div>
                <div className="form-group">
                  <label>Position:</label>
                  <input
                    type="text"
                    name="receivedByPosition"
                    value={editingReturn.receivedByPosition || ''}
                    onChange={handleInputChange}
                    placeholder="Position/Title"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date:</label>
                  <input
                    type="date"
                    name="receivedByDate"
                    value={editingReturn.receivedByDate || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Location:</label>
                  <input
                    type="text"
                    name="receivedByLocation"
                    value={editingReturn.receivedByLocation || ''}
                    onChange={handleInputChange}
                    placeholder="Location/Office"
                  />
                </div>
              </div>

              {/* Second Receiver Section */}
              <div className="form-section-header">
                <h4>📥 Second Receiver Information (Optional)</h4>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="secondReceivedBy"
                    value={editingReturn.secondReceivedBy || ''}
                    onChange={handleInputChange}
                    placeholder="Name of second receiver"
                  />
                </div>
                <div className="form-group">
                  <label>Position:</label>
                  <input
                    type="text"
                    name="secondReceivedByPosition"
                    value={editingReturn.secondReceivedByPosition || ''}
                    onChange={handleInputChange}
                    placeholder="Position/Title"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date:</label>
                  <input
                    type="date"
                    name="secondReceivedByDate"
                    value={editingReturn.secondReceivedByDate || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Location:</label>
                  <input
                    type="text"
                    name="secondReceivedByLocation"
                    value={editingReturn.secondReceivedByLocation || ''}
                    onChange={handleInputChange}
                    placeholder="Location/Office"
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button type="submit">Save Changes</button>
                <button type="button" onClick={() => setEditingReturn(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="export-modal" onClick={(e) => {
          if (e.target.className === 'export-modal') {
            setShowExportModal(false);
          }
        }}>
          <div className="export-modal-content">
            <h3>Export Returns Report</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px', textAlign: 'center' }}>
              Select date range to export returns. Includes ICS No, Date Acquired, and all return details.
            </p>
            <div className="date-range">
              <div className="form-group">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>End Date:</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ 
              padding: '10px', 
              background: '#e8f4f8', 
              borderRadius: '8px', 
              marginBottom: '15px',
              fontSize: '13px',
              color: '#1e3c72'
            }}>
              <strong>Note:</strong> Only returns between the selected dates will be exported. 
              Expand date range if records are missing.
            </div>
            <div className="export-buttons">
              <button onClick={() => handleExport('pdf')} className="export-option pdf">
                <i className="fas fa-file-pdf"></i> Export as PDF
              </button>
              <button onClick={() => handleExport('excel')} className="export-option excel">
                <i className="fas fa-file-excel"></i> Export as Excel
              </button>
              <button onClick={() => handleExport('csv')} className="export-option csv">
                <i className="fas fa-file-csv"></i> Export as CSV
              </button>
            </div>
            <button 
              onClick={() => setShowExportModal(false)} 
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsManagement;
