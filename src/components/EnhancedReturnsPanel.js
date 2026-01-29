import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./EnhancedReturnsPanel.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const EnhancedReturnsPanel = () => {
  const navigate = useNavigate();
  const firstInputRef = useRef(null);

  // Search and selection state
  const [searchMode, setSearchMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFilter, setSearchFilter] = useState("all"); // all, article, property_number, end_user
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showSecondReceiver, setShowSecondReceiver] = useState(false);

  // Form state - simplified for returns
  const [form, setForm] = useState({
    rrspNo: "",
    date: new Date().toISOString().split('T')[0],
    quantity: "1",
    remarks: "",
    returnedBy: { name: "", position: "", returnDate: new Date().toISOString().split('T')[0], location: "" },
    receivedBy: { name: "", position: "", receiveDate: new Date().toISOString().split('T')[0], location: "" },
    secondReceivedBy: { name: "", position: "", receiveDate: "", location: "" },
  });

  // Fetch all articles on component mount
  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/all`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setArticles(Array.isArray(data) ? data : []);
      setFilteredArticles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Error fetching articles:", err);
      alert("Failed to load articles. Please refresh the page.");
    }
  };

  // Search and filter logic
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredArticles(articles);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = articles.filter(article => {
      switch (searchFilter) {
        case "article":
          return article.article?.toLowerCase().includes(searchLower);
        case "property_number":
          return article.property_number?.toLowerCase().includes(searchLower);
        case "end_user":
          return article.actual_user?.toLowerCase().includes(searchLower) ||
                 article.employee_name?.toLowerCase().includes(searchLower);
        case "date":
          return article.date_acquired?.includes(searchTerm);
        default: // "all"
          return article.article?.toLowerCase().includes(searchLower) ||
                 article.property_number?.toLowerCase().includes(searchLower) ||
                 article.actual_user?.toLowerCase().includes(searchLower) ||
                 article.employee_name?.toLowerCase().includes(searchLower) ||
                 article.description?.toLowerCase().includes(searchLower);
      }
    });
    setFilteredArticles(filtered);
  }, [searchTerm, searchFilter, articles]);

  const handleArticleSelect = (article) => {
    setSelectedArticle(article);
    setSearchMode(false);
    // Optionally pre-fill quantity based on available stock
    if (article.on_hand_per_count) {
      setForm(prev => ({ ...prev, quantity: "1" }));
    }
  };

  const handleBackToSearch = () => {
    setSelectedArticle(null);
    setSearchMode(true);
    setForm({
      rrspNo: "",
      date: new Date().toISOString().split('T')[0],
      quantity: "1",
      remarks: "",
      returnedBy: { name: "", position: "", returnDate: new Date().toISOString().split('T')[0], location: "" },
      receivedBy: { name: "", position: "", receiveDate: new Date().toISOString().split('T')[0], location: "" },
      secondReceivedBy: { name: "", position: "", receiveDate: "", location: "" },
    });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNestedChange = (e, category) => {
    setForm(prev => ({
      ...prev,
      [category]: { ...prev[category], [e.target.name]: e.target.value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedArticle) {
      alert("❌ Please select an article first");
      return;
    }

    // Validate quantity
    const returnQuantity = parseInt(form.quantity);
    if (returnQuantity <= 0) {
      alert("❌ Quantity must be greater than 0");
      return;
    }
    if (selectedArticle.on_hand_per_count && returnQuantity > selectedArticle.on_hand_per_count) {
      if (!window.confirm(`⚠️ Return quantity (${returnQuantity}) exceeds available stock (${selectedArticle.on_hand_per_count}). Continue?`)) {
        return;
      }
    }

    // Validate required fields
    if (!form.rrspNo || !form.date ||
        !form.returnedBy.name || !form.returnedBy.position || !form.returnedBy.returnDate ||
        !form.receivedBy.name || !form.receivedBy.position || !form.receivedBy.receiveDate) {
      alert("❌ Missing required fields. Please fill out all required fields.");
      return;
    }

    // Construct payload using selected article data
    const payload = {
      rrspNo: form.rrspNo,
      date: form.date,
      description: selectedArticle.article, // Use article name
      quantity: returnQuantity,
      icsNo: selectedArticle.property_number || "N/A",
      dateAcquired: selectedArticle.date_acquired || new Date().toISOString().split('T')[0],
      amount: selectedArticle.unit_value || 0,
      endUser: selectedArticle.actual_user || selectedArticle.employee_name || "Unknown",
      remarks: form.remarks,
      returnedBy: form.returnedBy,
      receivedBy: form.receivedBy,
      secondReceivedBy: showSecondReceiver ? form.secondReceivedBy : {}
    };

    console.log("🔍 Submitting return:", payload);

    try {
      const response = await fetch(`${API_BASE_URL}/add-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Return successfully recorded!");
        handleBackToSearch();
        fetchArticles(); // Refresh article list
      } else {
        alert(`❌ Error: ${data.error}\n${data.details || ""}`);
      }
    } catch (err) {
      console.error("❌ Network Error:", err);
      alert("❌ Network error. Unable to reach the server.");
    }
  };

  return (
    <div className="enhanced-returns-panel">
      <div className="panel-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
        <h2>
          <i className="fas fa-undo"></i> Add Return (Receipt of Returned Property)
        </h2>
        <button className="manage-btn" onClick={() => navigate("/manage-returns")}>
          <i className="fas fa-list"></i> Manage Returns
        </button>
      </div>

      {/* Search Mode */}
      {searchMode && (
        <div className="search-section">
          <div className="search-header">
            <h3><i className="fas fa-search"></i> Search for Article to Return</h3>
            <p className="search-subtitle">Find the article you want to process a return for</p>
          </div>

          <div className="search-controls">
            <div className="search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search by article name, property number, employee, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button className="clear-search" onClick={() => setSearchTerm("")}>
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            <div className="filter-selector">
              <label>Filter:</label>
              <select value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}>
                <option value="all">All Fields</option>
                <option value="article">Article Name</option>
                <option value="property_number">Property Number</option>
                <option value="end_user">Employee/User</option>
                <option value="date">Date Acquired</option>
              </select>
            </div>
          </div>

          <div className="search-results">
            <div className="results-header">
              <span>{filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} found</span>
            </div>

            {filteredArticles.length > 0 ? (
              <div className="articles-grid">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="article-card"
                    onClick={() => handleArticleSelect(article)}
                  >
                    <div className="article-header">
                      <h4>{article.article}</h4>
                      <span className="property-badge">{article.property_number || 'No Property #'}</span>
                    </div>
                    <div className="article-details">
                      <div className="detail-row">
                        <i className="fas fa-user"></i>
                        <span>{article.actual_user || article.employee_name || 'No User'}</span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-calendar"></i>
                        <span>Acquired: {article.date_acquired ? new Date(article.date_acquired).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-box"></i>
                        <span>On Hand: {article.on_hand_per_count || 0} {article.unit || 'units'}</span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-peso-sign"></i>
                        <span>₱{Number(article.unit_value || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    {article.description && (
                      <div className="article-description">
                        <i className="fas fa-info-circle"></i>
                        {article.description}
                      </div>
                    )}
                    <button className="select-btn">
                      <i className="fas fa-check"></i> Select for Return
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">
                <i className="fas fa-search"></i>
                <p>No articles found matching your search</p>
                <span>Try adjusting your search terms or filters</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return Form Mode */}
      {!searchMode && selectedArticle && (
        <div className="return-form-section">
          <div className="selected-article-summary">
            <button className="change-article-btn" onClick={handleBackToSearch}>
              <i className="fas fa-exchange-alt"></i> Change Article
            </button>
            <div className="summary-content">
              <h3>Selected Article</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <label>Article:</label>
                  <span>{selectedArticle.article}</span>
                </div>
                <div className="summary-item">
                  <label>Property #:</label>
                  <span>{selectedArticle.property_number || 'N/A'}</span>
                </div>
                <div className="summary-item">
                  <label>End User:</label>
                  <span>{selectedArticle.actual_user || selectedArticle.employee_name}</span>
                </div>
                <div className="summary-item">
                  <label>Date Acquired:</label>
                  <span>{selectedArticle.date_acquired ? new Date(selectedArticle.date_acquired).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="summary-item">
                  <label>Available:</label>
                  <span>{selectedArticle.on_hand_per_count || 0} {selectedArticle.unit || 'units'}</span>
                </div>
                <div className="summary-item">
                  <label>Unit Value:</label>
                  <span>₱{Number(selectedArticle.unit_value || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="return-form">
            <div className="form-section">
              <h3><i className="fas fa-file-alt"></i> Return Information</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>RRSP No. <span className="required">*</span></label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    name="rrspNo"
                    value={form.rrspNo}
                    onChange={handleChange}
                    placeholder="Enter RRSP Number"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Return Date <span className="required">*</span></label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quantity <span className="required">*</span></label>
                  <input
                    type="number"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleChange}
                    min="1"
                    max={selectedArticle.on_hand_per_count || 9999}
                    required
                  />
                  <span className="field-hint">Available: {selectedArticle.on_hand_per_count || 0}</span>
                </div>
                <div className="form-group">
                  <label>Remarks</label>
                  <select name="remarks" value={form.remarks} onChange={handleChange}>
                    <option value="">Select Condition</option>
                    <option value="Functional">Functional</option>
                    <option value="Destroyed">Destroyed</option>
                    <option value="For Disposal">For Disposal</option>
                    <option value="For Repair">For Repair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Returned By Section */}
            <div className="form-section">
              <h3><i className="fas fa-user-minus"></i> Returned By</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Name <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={form.returnedBy.name}
                    onChange={(e) => handleNestedChange(e, "returnedBy")}
                    placeholder="Person returning the item"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Position <span className="required">*</span></label>
                  <input
                    type="text"
                    name="position"
                    value={form.returnedBy.position}
                    onChange={(e) => handleNestedChange(e, "returnedBy")}
                    placeholder="Position/Title"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Return Date <span className="required">*</span></label>
                  <input
                    type="date"
                    name="returnDate"
                    value={form.returnedBy.returnDate}
                    onChange={(e) => handleNestedChange(e, "returnedBy")}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.returnedBy.location}
                    onChange={(e) => handleNestedChange(e, "returnedBy")}
                    placeholder="Where item was sent from"
                  />
                </div>
              </div>
            </div>

            {/* Received By Section */}
            <div className="form-section">
              <h3><i className="fas fa-user-check"></i> Received By</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Name <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={form.receivedBy.name}
                    onChange={(e) => handleNestedChange(e, "receivedBy")}
                    placeholder="Person receiving the item"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Position <span className="required">*</span></label>
                  <input
                    type="text"
                    name="position"
                    value={form.receivedBy.position}
                    onChange={(e) => handleNestedChange(e, "receivedBy")}
                    placeholder="Position/Title"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Receive Date <span className="required">*</span></label>
                  <input
                    type="date"
                    name="receiveDate"
                    value={form.receivedBy.receiveDate}
                    onChange={(e) => handleNestedChange(e, "receivedBy")}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.receivedBy.location}
                    onChange={(e) => handleNestedChange(e, "receivedBy")}
                    placeholder="Where item was received"
                  />
                </div>
              </div>
            </div>

            {/* Second Receiver Toggle */}
            <div className="form-section">
              <button
                type="button"
                className="toggle-second-receiver"
                onClick={() => setShowSecondReceiver(!showSecondReceiver)}
              >
                <i className={`fas fa-${showSecondReceiver ? 'minus' : 'plus'}-circle`}></i>
                {showSecondReceiver ? "Remove Second Receiver" : "Add Second Receiver"}
              </button>

              {showSecondReceiver && (
                <>
                  <h3><i className="fas fa-user-plus"></i> Second Receiver (Optional)</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        name="name"
                        value={form.secondReceivedBy.name}
                        onChange={(e) => handleNestedChange(e, "secondReceivedBy")}
                        placeholder="Second receiver name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Position</label>
                      <input
                        type="text"
                        name="position"
                        value={form.secondReceivedBy.position}
                        onChange={(e) => handleNestedChange(e, "secondReceivedBy")}
                        placeholder="Position/Title"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Receive Date</label>
                      <input
                        type="date"
                        name="receiveDate"
                        value={form.secondReceivedBy.receiveDate}
                        onChange={(e) => handleNestedChange(e, "secondReceivedBy")}
                      />
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <input
                        type="text"
                        name="location"
                        value={form.secondReceivedBy.location}
                        onChange={(e) => handleNestedChange(e, "secondReceivedBy")}
                        placeholder="Where item was received"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={handleBackToSearch}>
                <i className="fas fa-times"></i> Cancel
              </button>
              <button type="submit" className="submit-btn">
                <i className="fas fa-check"></i> Submit Return
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EnhancedReturnsPanel;
