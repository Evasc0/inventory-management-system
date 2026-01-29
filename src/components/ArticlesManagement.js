import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ArticlesManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const ArticlesManagement = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOption, setFilterOption] = useState('all');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch both products and employees
      const config = {
        headers: {
          'Accept': 'application/json'
        }
      };
      
      const [productsResponse, employeesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/get-products/all`, config),
        axios.get(`${API_BASE_URL}/get-employees`, config)
      ]);
      
      console.log('Fetched products:', productsResponse.data);
      let productsData = Array.isArray(productsResponse.data) 
        ? productsResponse.data 
        : productsResponse.data.products || [];
      
      // Create employee lookup map for quick access
      const employeeMap = {};
      employeesResponse.data.forEach(emp => {
        employeeMap[emp.name] = emp;
      });
      
      // Format the data to ensure consistent properties
      productsData = productsData.map(product => {
        console.log('Processing product:', product); // Debug log
        const actual_user = product.actual_user || '';
        const employee = employeeMap[actual_user] || {};
        console.log('Found employee:', employee); // Debug log
        return {
          ...product,
          unit_value: parseFloat(product.unit_value) || 0,
          balance_per_card: parseInt(product.balance_per_card) || 0,
          on_hand_per_count: parseInt(product.on_hand_per_count) || 0,
          total_amount: parseFloat(product.total_amount) || 0,
          actual_user: actual_user,
          // Include employee details
          employee_position: employee.position || '',
          employee_department: employee.department || '',
          // Format display strings
          user_display: actual_user ? 
            `${actual_user}${employee.position ? ` (${employee.position})` : ''}${employee.department ? ` - ${employee.department}` : ''}` : 
            'No User Assigned',
          unit_value_formatted: parseFloat(product.unit_value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          total_amount_formatted: parseFloat(product.total_amount).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        };
      });

      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to fetch products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
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
    fetchProducts();
    fetchEmployees();
    
    // Set up periodic refresh
    const refreshInterval = setInterval(fetchProducts, 5000);
    return () => clearInterval(refreshInterval);
  }, [fetchProducts, fetchEmployees]);

  const handleEditProduct = (product) => {
    // Ensure all numeric values are properly parsed
    const formattedProduct = {
      ...product,
      unit_value: parseFloat(product.unit_value) || 0,
      balance_per_card: parseFloat(product.balance_per_card) || 0,
      on_hand_per_count: parseFloat(product.on_hand_per_count) || 0,
      total_amount: parseFloat(product.total_amount) || 0
    };
    setEditingProduct(formattedProduct);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!editingProduct.actual_user) {
        alert('Please select a user for this article');
        return;
      }

      // Prepare the data for update
      const updatedProduct = {
        article: editingProduct.article,
        property_number: editingProduct.property_number || '',
        description: editingProduct.description || '',
        date_acquired: editingProduct.date_acquired || '',
        unit: editingProduct.unit || '',
        unit_value: parseFloat(editingProduct.unit_value) || 0,
        balance_per_card: parseFloat(editingProduct.balance_per_card) || 0,
        on_hand_per_count: parseFloat(editingProduct.on_hand_per_count) || 0,
        total_amount: parseFloat(editingProduct.unit_value * editingProduct.balance_per_card).toFixed(2),
        actual_user: editingProduct.actual_user,
        remarks: editingProduct.remarks || '',
        id: editingProduct.id
      };

      // Add headers to ensure proper content type
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const response = await axios.put(
        `${API_BASE_URL}/edit-product/${editingProduct.id}`,
        updatedProduct,
        config
      );

      if (response.data) {
        alert('Product updated successfully!');
        setEditingProduct(null);
        // Only refetch after successful update
        fetchProducts();
      }
    } catch (error) {
      console.error('Error updating product:', error);
      if (error.response) {
        // Server responded with an error
        alert(`Update failed: ${error.response.data.message || error.response.data || 'Server error'}`);
      } else if (error.request) {
        // Request was made but no response received
        alert('No response from server. Please check your connection and try again.');
      } else {
        // Error in request setup
        alert('Error updating product. Please try again.');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingProduct(prev => {
      const newProduct = { ...prev, [name]: value };
      
      // Recalculate total amount when unit value or balance changes
      if (name === 'unit_value' || name === 'balance_per_card') {
        const unitValue = parseFloat(name === 'unit_value' ? value : newProduct.unit_value) || 0;
        const balance = parseFloat(name === 'balance_per_card' ? value : newProduct.balance_per_card) || 0;
        newProduct.total_amount = (unitValue * balance).toFixed(2);
      }
      
      return newProduct;
    });
  };

  const filteredProducts = products.filter(product => {
    // Search term matching
    const matchesSearch = 
      product.article?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.actual_user?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by selected user
    let matchesFilter = true;
    if (filterOption !== 'all') {
      console.log('Filtering product:', product.article);
      console.log('Product actual_user:', product.actual_user);
      console.log('Filter option:', filterOption);
      // Case-insensitive comparison of actual user
      matchesFilter = product.actual_user && product.actual_user.toLowerCase() === filterOption.toLowerCase();
      console.log('Match result:', matchesFilter);
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="articles-management">
      <div className="articles-header">
        <h2>Articles Management</h2>
        <div className="header-actions">
          <button onClick={fetchProducts} className="refresh-btn-sm">
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
          <button onClick={() => navigate('/admin')} className="back-btn">
            ← Back to Admin Panel
          </button>
        </div>
      </div>

      <div className="search-filter-container">
        <input
          type="text"
          placeholder="Search articles by name, description, or user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select 
          value={filterOption} 
          onChange={(e) => {
            console.log('Selected filter:', e.target.value);
            setFilterOption(e.target.value);
          }}
          className="filter-select"
        >
          <option value="all">All Users</option>
          {employees
            .sort((a, b) => {
              if (a.department !== b.department) {
                return (a.department || '').localeCompare(b.department || '');
              }
              return a.name.localeCompare(b.name);
            })
            .map(emp => (
              <option 
                key={emp.id} 
                value={emp.name} // Use just the name as the value
              >
                {`${emp.name}${emp.department ? ` - ${emp.department}` : ''}${emp.position ? ` (${emp.position})` : ''}`}
              </option>
            ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading articles...</div>
      ) : (
        <div className="articles-list">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Property #</th>
                <th>Description</th>
                <th>Date Acquired</th>
                <th>Unit</th>
                <th>Unit Value</th>
                <th>Balance</th>
                <th>On Hand</th>
                <th>Total Amount</th>
                <th>User</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className={product.has_returns ? 'has-returns' : ''}>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span>{product.article}</span>
                      {product.has_returns && (
                        <span className="return-badge" title={`${product.return_count} return(s) recorded`}>
                          <i className="fas fa-undo"></i> {product.return_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{product.property_number || '-'}</td>
                  <td>{product.description || '-'}</td>
                  <td>{product.date_acquired ? new Date(product.date_acquired).toLocaleDateString() : '-'}</td>
                  <td>{product.unit || '-'}</td>
                  <td>₱{product.unit_value_formatted}</td>
                  <td>{product.balance_per_card || '0'}</td>
                  <td>{product.on_hand_per_count || '0'}</td>
                  <td>₱{product.total_amount_formatted}</td>
                  <td className="user-cell">
                    {product.actual_user && product.actual_user !== 'No User Assigned' ? (
                      <>
                        <div className="user-name" style={{fontWeight: 'bold', color: '#000'}}>
                          {product.actual_user}
                        </div>
                        <div className="user-details">
                          {product.employee_position && (
                            <div className="user-position" style={{color: '#666', fontSize: '12px'}}>
                              {product.employee_position}
                            </div>
                          )}
                          {product.employee_department && (
                            <div className="user-department" style={{color: '#666', fontSize: '12px'}}>
                              {product.employee_department}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="no-user" style={{color: '#999'}}>No User Assigned</div>
                    )}
                  </td>
                  <td>{product.remarks || '-'}</td>
                  <td>
                    <button 
                      onClick={() => handleEditProduct(product)}
                      className="edit-btn"
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingProduct && (
        <div className="edit-modal" onClick={(e) => {
          if (e.target.className === 'edit-modal') {
            setEditingProduct(null);
          }
        }}>
          <div className="edit-modal-content">
            <h3>Edit Article</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Article Name:</label>
                <input
                  type="text"
                  name="article"
                  value={editingProduct.article || ''}
                  onChange={handleInputChange}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Property Number:</label>
                <input
                  type="text"
                  name="property_number"
                  value={editingProduct.property_number || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Description:</label>
                <input
                  type="text"
                  name="description"
                  value={editingProduct.description || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Date Acquired:</label>
                <input
                  type="date"
                  name="date_acquired"
                  value={editingProduct.date_acquired ? editingProduct.date_acquired.split('T')[0] : ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Unit:</label>
                <input
                  type="text"
                  name="unit"
                  value={editingProduct.unit}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Unit Value:</label>
                <input
                  type="number"
                  name="unit_value"
                  value={editingProduct.unit_value}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Balance Per Card:</label>
                <input
                  type="number"
                  name="balance_per_card"
                  value={editingProduct.balance_per_card}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>On Hand Count:</label>
                <input
                  type="number"
                  name="on_hand_per_count"
                  value={editingProduct.on_hand_per_count}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Total Amount:</label>
                <input
                  type="number"
                  name="total_amount"
                  value={editingProduct.total_amount}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label>Actual User:</label>
                <select
                  name="actual_user"
                  value={editingProduct.actual_user}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select User</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.position || 'No Position'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Remarks:</label>
                <textarea
                  name="remarks"
                  value={editingProduct.remarks}
                  onChange={handleInputChange}
                />
              </div>
              <div className="modal-buttons">
                <button type="submit">Save Changes</button>
                <button type="button" onClick={() => setEditingProduct(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticlesManagement;
