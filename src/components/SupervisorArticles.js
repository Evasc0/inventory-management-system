import axios from "axios";
import React, { useState, useEffect } from "react";
import "./SupervisorArticles.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const SupervisorArticles = () => {
  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/products/all`) // ✅ Fetch all products
      .then((res) => {
        console.log("✅ Fetched Products:", res.data);
        setArticles(res.data);
      })
      .catch((err) => console.error("❌ Error fetching products:", err));
  }, []);

  const filteredArticles = articles.filter((article) =>
    Object.values(article).some((value) =>
      value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="supervisor-articles">
      <h2>All Articles (Supervisor View)</h2>
      <input
        type="text"
        placeholder="Search by Article, Username, Property No., Date..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Article</th>
            <th>Description</th>
            <th>Property No.</th>
            <th>Unit</th>
            <th>Unit Value</th>
            <th>On Hand</th>
            <th>Balance</th>
            <th>Total Amount</th>
            <th>Actual User</th>
            <th>Return Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {filteredArticles.map((article, index) => (
            <tr key={index} className={article.has_returns ? 'has-returns' : ''}>
              <td>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span>{article.article}</span>
                  {article.has_returns && (
                    <span className="return-badge" title={`${article.return_count} return(s) recorded`}>
                      <i className="fas fa-undo"></i> {article.return_count}
                    </span>
                  )}
                </div>
              </td>
              <td>{article.description}</td>
              <td>{article.property_number}</td>
              <td>{article.unit}</td>
              <td>₱{parseFloat(article.unit_value).toFixed(2)}</td>
              <td>{article.on_hand_per_count ?? "N/A"}</td>
              <td>{article.balance_per_card ?? "N/A"}</td>
              <td>₱{parseFloat(article.total_amount).toFixed(2)}</td>
              <td>{article.actual_user}</td>
              <td>
                {article.has_returns ? (
                  <span className="status-returned">
                    <i className="fas fa-check-circle"></i> Returned ({article.return_count}x)
                  </span>
                ) : (
                  <span className="status-active">
                    <i className="fas fa-circle"></i> Active
                  </span>
                )}
              </td>
              <td>{article.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SupervisorArticles;
