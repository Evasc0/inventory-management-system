require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose(); // ✅ Using SQLite3
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");
const http = require("http");  // Simple in-memory cache implementation
  const cache = {
    data: new Map(),
    timeout: new Map(),
    
    set: function(key, value, ttl = 60000) { // Default TTL: 60 seconds
      if (this.timeout.has(key)) {
        clearTimeout(this.timeout.get(key));
      }
      
      this.data.set(key, value);
      this.timeout.set(key, setTimeout(() => {
        this.data.delete(key);
        this.timeout.delete(key);
      }, ttl));
    },
    
    get: function(key) {
      return this.data.get(key);
    },
    
    has: function(key) {
      return this.data.has(key);
    },
    
    invalidate: function(pattern) {
      for (let key of this.data.keys()) {
        if (key.includes(pattern)) {
          this.data.delete(key);
          if (this.timeout.has(key)) {
            clearTimeout(this.timeout.get(key));
            this.timeout.delete(key);
          }
        }
      }
    }
  };
  
  // Cache middleware
  const cacheMiddleware = (ttl) => (req, res, next) => {
    const key = `${req.method}:${req.url}`;
    
    if (req.method === 'GET' && cache.has(key)) {
      return res.json(cache.get(key));
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      if (req.method === 'GET') {
        cache.set(key, data, ttl);
      }
      originalJson.call(this, data);
    };
    
    next();
  };
  const server = express();
  const PDFDocument = require("pdfkit");
  const ExcelJS = require("exceljs");
  
  // Detect if running in packaged mode
  const isPackaged = (
    process.env.NODE_ENV === "production" ||
    (typeof process.pkg !== 'undefined') ||
    (process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1) ||
    __dirname.indexOf('app.asar') !== -1
  );
  
  const isDev = !isPackaged;
  process.env.NODE_ENV = isDev ? "development" : "production";
  
  // Critical: Handle uncaught exceptions to prevent silent crashes
  process.on('uncaughtException', (error) => {
    console.error("\n" + "=".repeat(80));
    console.error("❌ FATAL: Uncaught Exception in Server");
    console.error("=".repeat(80));
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    console.error("=".repeat(80));
    // Flush stdout/stderr before exiting
    if (process.stdout.flush) process.stdout.flush();
    if (process.stderr.flush) process.stderr.flush();
    setTimeout(() => process.exit(1), 1000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error("\n" + "=".repeat(80));
    console.error("❌ FATAL: Unhandled Promise Rejection");
    console.error("=".repeat(80));
    console.error("Reason:", reason);
    console.error("=".repeat(80));
  });
  
  // Log server startup info
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 SERVER STARTING");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Environment:", process.env.NODE_ENV);
  console.log("📦 Is Packaged:", isPackaged);
  console.log("📦 Is Dev:", isDev);
  console.log("📁 __dirname:", __dirname);
  console.log("📁 process.cwd():", process.cwd());
  console.log("📁 process.execPath:", process.execPath);
  console.log("📁 BUILD_PATH (from env):", process.env.BUILD_PATH || "NOT SET");
  console.log("📁 RESOURCES_PATH (from env):", process.env.RESOURCES_PATH || "NOT SET");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Middleware
  server.use(cors());
  server.use(express.json({ limit: "50mb" }));
  server.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Logging middleware
  const logRequest = (req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // Log request
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    }));

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`
      }));
    });
    next();
  };

  // Audit logging middleware for sensitive operations
  const auditLog = (action) => (req, res, next) => {
    const originalSend = res.json;
    res.json = function(data) {
      db.run(
        `INSERT INTO activity_logs (action, user_id, details) VALUES (?, ?, ?)`,
        [
          action,
          req.user?.id || null,
          JSON.stringify({
            method: req.method,
            url: req.url,
            body: req.body,
            result: data
          })
        ]
      );
      originalSend.call(this, data);
    };
    next();
  };

  // ✅ Enable CORS and configure limits
  server.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));
  
  // Add logging middleware
  server.use(logRequest);
  
  // Configure express limits for larger requests
  server.use(express.json({limit: '50mb'}));
  server.use(express.urlencoded({limit: '50mb', extended: true}));
  
  // Serve static files in production
  let buildPath = null; // Declare at module scope for logging
  
  if (!isDev) {
    // First, check if BUILD_PATH was provided by Electron main process
    if (process.env.BUILD_PATH && process.env.BUILD_PATH !== '' && fs.existsSync(process.env.BUILD_PATH)) {
      buildPath = process.env.BUILD_PATH;
      console.log('✅ Using BUILD_PATH from environment:', buildPath);
    } else {
      // Determine if we're in an asar archive
      const isInAsar = __dirname.includes('app.asar');
      
      // Try multiple possible build paths for production
      const possibleBuildPaths = [
        // From environment (may be empty string)
        process.env.BUILD_PATH,
        // For asar: Check app.asar.unpacked first (highest priority)
        isInAsar && __dirname.replace('app.asar', 'app.asar.unpacked') && path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'build'),
        // For asar: Also check if build is inside asar itself
        isInAsar && path.join(__dirname, 'build'),
        // Relative to server.js location (for non-asar or unpacked)
        path.join(__dirname, 'build'),
        path.join(__dirname, '..', 'build'),
        // From current working directory
        path.join(process.cwd(), 'build'),
        // From app root if provided
        process.env.APP_ROOT && path.join(process.env.APP_ROOT, 'build'),
        // From process.resourcesPath (Electron-specific)
        process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'build'),
        process.resourcesPath && path.join(process.resourcesPath, 'build')
      ].filter(p => p && p !== '');
      
      console.log('🔍 Searching for build folder...');
      console.log('   __dirname:', __dirname);
      console.log('   process.cwd():', process.cwd());
      console.log('   Is in asar:', isInAsar);
      console.log('   process.resourcesPath:', process.resourcesPath || 'NOT SET');
      console.log('   BUILD_PATH env:', process.env.BUILD_PATH || 'NOT SET');
      console.log('');
      
      for (let i = 0; i < possibleBuildPaths.length; i++) {
        const p = possibleBuildPaths[i];
        const exists = fs.existsSync(p);
        const hasIndex = exists && fs.existsSync(path.join(p, 'index.html'));
        
        console.log(`${i + 1}. ${exists ? (hasIndex ? '✅ VALID' : '⚠️  EXISTS (no index.html)') : '❌ NOT FOUND'}: ${p}`);
        
        if (exists && hasIndex && !buildPath) {
          buildPath = p;
        }
      }
      
      if (!buildPath) {
        console.error('❌ Build directory not found! Static files will not be served.');
        console.error('   Application may fail to load in production.');
        // Use the first path as fallback even if it doesn't exist
        buildPath = possibleBuildPaths.find(p => p) || path.join(__dirname, 'build');
        console.error('   Using fallback:', buildPath);
      }
    }
    
    console.log('📁 Serving static files from:', buildPath);
    
    // Only serve static files if directory exists
    if (fs.existsSync(buildPath)) {
      server.use(express.static(buildPath));
    } else {
      console.error('⚠️  WARNING: Build directory does not exist!');
      console.error('   Static files will not be served.');
    }
    
    console.log('');
    
    // Serve index.html for all routes not starting with /api or /get-
    server.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || 
          req.path.startsWith('/get-') || 
          req.path.startsWith('/add-') || 
          req.path.startsWith('/edit-') || 
          req.path.startsWith('/delete-') ||
          req.path.startsWith('/login') ||
          req.path.startsWith('/employee-login') ||
          req.path.startsWith('/export-') ||
          req.path.startsWith('/ping')) {
        return next();
      }
      const indexPath = path.join(buildPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error('❌ index.html not found at:', indexPath);
        res.status(404).send('Application files not found. Please reinstall the application.');
      }
    });
  }
  
  // 🚀 Connect to SQLite Database (Creates file if not exists)

function getDatabasePath() {
  // Check for network database path from environment variable
  const networkDbPath = process.env.NETWORK_DB_PATH;
  
  if (networkDbPath && fs.existsSync(path.dirname(networkDbPath))) {
    console.log("🌐 Using network database path:", networkDbPath);
    return networkDbPath;
  }
  
  if (isDev) {
    const devDir = path.join(__dirname, "resources");
    if (!fs.existsSync(devDir)) fs.mkdirSync(devDir, { recursive: true });
    return path.join(devDir, "database.sqlite");
  } else {
    // In production, try multiple paths with better validation
    const possiblePaths = [
      // 1. Resources path from Electron main process (MOST RELIABLE)
      process.env.RESOURCES_PATH && path.join(process.env.RESOURCES_PATH, "database.sqlite"),
      
      // 2. User data directory (RECOMMENDED for production)
      path.join(require('os').homedir(), "AppData", "Local", "BTS-Inventory", "database.sqlite"),
      
      // 3. Network drive (if specified)
      process.env.DB_NETWORK_PATH && path.join(process.env.DB_NETWORK_PATH, "inventory_database.sqlite"),
      
      // 4. Current working directory (where node.exe was spawned)
      path.join(process.cwd(), "resources", "database.sqlite"),
      
      // 5. Relative to server.js location
      path.join(__dirname, "resources", "database.sqlite"),
      path.join(__dirname, "..", "resources", "database.sqlite"),
      
      // 6. Fallback to current directory
      path.join(__dirname, "database.sqlite")
    ].filter(Boolean);
    
    console.log("🔍 Searching for database location...");
    console.log("   RESOURCES_PATH env:", process.env.RESOURCES_PATH || "NOT SET");
    console.log("   __dirname:", __dirname);
    console.log("   process.cwd():", process.cwd());
    console.log("");
    
    for (let i = 0; i < possiblePaths.length; i++) {
      const dbPath = possiblePaths[i];
      const dir = path.dirname(dbPath);
      
      try {
        // Check if we can create/access the directory
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Test write permissions
        const testFile = path.join(dir, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        console.log(`${i + 1}. ✅ SELECTED: ${dbPath}`);
        console.log(`   Directory is writable: ${dir}`);
        return dbPath;
      } catch (err) {
        console.log(`${i + 1}. ❌ FAILED: ${dbPath}`);
        console.log(`   Error: ${err.message}`);
      }
    }
    
    // Final fallback
    const fallbackPath = path.join(__dirname, "database.sqlite");
    console.log(`⚠️  Using FINAL FALLBACK: ${fallbackPath}`);
    return fallbackPath;
  }
}

const dbPath = getDatabasePath();

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log("✅ Created database directory:", dbDir);
  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ CRITICAL: Failed to create database directory");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Path:", dbDir);
    console.error("Error:", err.message);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Flush output and exit
    if (process.stderr.flush) process.stderr.flush();
    setTimeout(() => process.exit(1), 500);
  }
}

console.log("📁 Database path:", dbPath);
console.log("📁 Database directory:", dbDir);

// Track if server has already started to prevent multiple instances
let serverStarted = false;

// Enable WAL mode for better concurrency
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error("❌ Error opening database:", err.message);
    console.error("❌ Database path was:", dbPath);
    console.error("❌ Check if the directory has write permissions.");
    process.exit(1);
  }
  
  // Enable WAL mode and foreign keys
  db.serialize(() => {
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA busy_timeout = 6000");
    console.log(`✅ Connected to database at ${dbPath}`);
    
    // Initialize database and start server after database is ready
    createTables(() => {
      if (serverStarted) {
        console.log("⚠️ Server already started, skipping...");
        return;
      }
      
      serverStarted = true;
      insertSampleData();
      
      const PORT = 5001; // Always use 5001 for backend
      
      // Create HTTP server for both Express and WebSocket
      const httpServer = http.createServer(server);
      
      // Create WebSocket server
      const wss = new WebSocket.Server({ 
        server: httpServer,
        path: '/ws'
      });
      
      // Store connected clients
      const connectedClients = new Set();
      
      wss.on('connection', (ws, req) => {
        console.log('🔗 New WebSocket connection from:', req.socket.remoteAddress);
        connectedClients.add(ws);
        
        ws.on('close', () => {
          console.log('🔗 WebSocket connection closed');
          connectedClients.delete(ws);
        });
        
        ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          connectedClients.delete(ws);
        });
      });
      
      // Broadcast function for real-time updates
      const broadcast = (eventType, data) => {
        const message = JSON.stringify({ eventType, data, timestamp: new Date().toISOString() });
        connectedClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(message);
            } catch (error) {
              console.error('❌ Error sending WebSocket message:', error);
              connectedClients.delete(client);
            }
          }
        });
      };
      
      // Make broadcast function available globally
      global.broadcast = broadcast;
      
      // Start the HTTP server with both Express and WebSocket
      httpServer.listen(PORT, '0.0.0.0', () => {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🚀 SERVER READY AND LISTENING`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🌐 Server URL: http://localhost:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`📁 Database: ${dbPath}`);
        console.log(`🔗 WebSocket: ws://localhost:${PORT}/ws`);
        console.log(`📂 Build Path: ${buildPath || 'Not set'}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        // CRITICAL: Send startup signal to stdout for Electron to detect
        // Use console.log AND process.stdout.write for redundancy
        const startupSignal = `SERVER_READY:${PORT}`;
        console.log(startupSignal);
        process.stdout.write(startupSignal + '\n');
        
        // Force flush stdout/stderr immediately (critical for Windows)
        if (process.stdout.flush) {
          process.stdout.flush();
        }
        if (process.stderr.flush) {
          process.stderr.flush();
        }
        
        // Additional redundant signal after 100ms
        setTimeout(() => {
          process.stdout.write(startupSignal + '\n');
          if (process.stdout.flush) process.stdout.flush();
        }, 100);
      }).on('error', (err) => {
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("❌ SERVER FAILED TO START");
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use!`);
          console.error("💡 Solution: Close any other instances of the application.");
          console.error("💡 Or check Task Manager for node.exe processes.");
        } else {
          console.error("❌ Server error:", err.message);
          console.error("❌ Error code:", err.code);
          console.error("❌ Error stack:", err.stack);
        }
        
        // Flush error output
        if (process.stderr.flush) {
          process.stderr.flush();
        }
        
        // Exit with error code
        setTimeout(() => process.exit(1), 500);
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        process.exit(1);
      });
    });
  });
});

// Helper function for running queries in a transaction
const runInTransaction = async (queries) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      try {
        queries.forEach(query => {
          if (Array.isArray(query.params)) {
            db.run(query.sql, query.params);
          } else {
            db.run(query.sql);
          }
        });
        
        db.run("COMMIT", (err) => {
          if (err) {
            console.error("❌ Transaction failed:", err);
            db.run("ROLLBACK");
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error("❌ Transaction error:", err);
        db.run("ROLLBACK");
        reject(err);
      }
    });
  });
};
  
// API Routes and other middleware configurations follow here...

// 🔍 Data integrity check endpoint
server.get('/api/returns/validate', (req, res) => {
  const validationSql = `
    SELECT 
      COUNT(*) as total_returns,
      COUNT(ics_no) as returns_with_ics,
      COUNT(date_acquired) as returns_with_date,
      COUNT(CASE WHEN ics_no IS NULL OR ics_no = '' THEN 1 END) as missing_ics,
      COUNT(CASE WHEN date_acquired IS NULL OR date_acquired = '' THEN 1 END) as missing_date,
      MIN(date) as oldest_return,
      MAX(date) as newest_return
    FROM returns
  `;
  
  db.get(validationSql, [], (err, stats) => {
    if (err) {
      console.error("❌ Validation query error:", err);
      return res.status(500).json({ error: "Database error during validation" });
    }
    
    const issues = [];
    if (stats.missing_ics > 0) {
      issues.push(`${stats.missing_ics} return(s) missing ICS No (property number)`);
    }
    if (stats.missing_date > 0) {
      issues.push(`${stats.missing_date} return(s) missing Date Acquired`);
    }
    
    res.json({
      healthy: issues.length === 0,
      statistics: {
        total: stats.total_returns,
        withIcsNo: stats.returns_with_ics,
        withDateAcquired: stats.returns_with_date,
        missingIcsNo: stats.missing_ics,
        missingDateAcquired: stats.missing_date,
        dateRange: {
          oldest: stats.oldest_return,
          newest: stats.newest_return
        }
      },
      issues: issues.length > 0 ? issues : ['No data integrity issues detected'],
      message: issues.length === 0 
        ? '✅ All returns have complete data' 
        : `⚠️ ${issues.length} data quality issue(s) found`
    });
  });
});

// Health check endpoint for Electron app
server.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// TESTING: Simple test route to debug routing issues
server.get('/test-new-route', (req, res) => {
  res.status(200).json({ 
    message: 'New route is working!', 
    timestamp: new Date().toISOString() 
  });
});

// Get users with proper filtering (for AdminPanel.js) - MOVED HERE FOR TESTING
server.get('/get-users', (req, res) => {
  db.all(
    `SELECT u.*, e.name as employee_name
     FROM users u
     LEFT JOIN employee e ON u.FK_employee = e.id
     ORDER BY u.role, u.name`,
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ Error fetching users:", err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows || []);
    }
  );
});

// Get employee profile (for EmployeePanel.js) - MOVED HERE FOR TESTING
server.get("/get-employee-profile/:userName", (req, res) => {
  const userName = decodeURIComponent(req.params.userName);
  console.log("🔍 Fetching employee profile for:", userName);
  
  if (!userName || userName.trim() === '') {
    return res.status(400).json({ error: "Username is required" });
  }
  
  db.get(
    `SELECT e.*, u.role 
     FROM employee e 
     LEFT JOIN users u ON e.id = u.FK_employee 
     WHERE e.name = ? COLLATE NOCASE`,
    [userName.trim()],
    (err, employee) => {
      if (err) {
        console.error("❌ Error fetching employee profile:", err.message);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      if (!employee) {
        console.log("⚠️ Employee not found:", userName);
        // Return a default profile structure for new employees
        return res.json({
          id: null,
          name: userName,
          position: '',
          department: '',
          email: '',
          contact_number: '',
          address: '',
          role: 'employee'
        });
      }
      
      console.log("✅ Found employee profile:", employee.name);
      res.json({
        ...employee,
        position: employee.position || '',
        department: employee.department || '',
        email: employee.email || '',
        contact_number: employee.contact_number || '',
        address: employee.address || ''
      });
    }
  );
});

// Edit employee profile (for EmployeePanel.js)
server.put("/edit-employee-profile/:id", (req, res) => {
  const { id } = req.params;
  const { name, position, department, email, contact_number, address } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  console.log("🔄 Updating employee profile:", { id, name, position, department, email, contact_number, address });

  // If id is null, create a new employee record
  if (!id || id === 'null') {
    console.log("🆕 Creating new employee profile for:", name);
    
    db.run(
      `INSERT INTO employee (name, position, department, email, contact_number, address, employee_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), position || '', department || '', email || '', contact_number || '', address || '', `EMP${Date.now()}`],
      function(err) {
        if (err) {
          console.error("❌ Error creating employee profile:", err.message);
          return res.status(500).json({ error: "Failed to create employee profile", details: err.message });
        }
        console.log("✅ Created new employee profile with ID:", this.lastID);
        res.json({ message: "Employee profile created successfully", id: this.lastID });
      }
    );
  } else {
    // Update existing employee
    db.run(
      `UPDATE employee 
       SET name = ?, position = ?, department = ?, email = ?, contact_number = ?, address = ?
       WHERE id = ?`,
      [name.trim(), position || '', department || '', email || '', contact_number || '', address || '', id],
      function(err) {
        if (err) {
          console.error("❌ Error updating employee profile:", err.message);
          return res.status(500).json({ error: "Failed to update employee profile", details: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Employee not found" });
        }
        console.log("✅ Updated employee profile for ID:", id);
        res.json({ message: "Employee profile updated successfully" });
      }
    );
  }
});

// Update product route (for editing products)
server.put("/edit-product/:id", (req, res) => {
  const { id } = req.params;
  const {
    article, description, date_acquired, property_number, unit, unit_value,
    balance_per_card, on_hand_per_count, total_amount, remarks, actual_user
  } = req.body;

  if (!article || !unit_value) {
    return res.status(400).json({ error: "Article and unit value are required" });
  }

  // Get employee ID for the actual user
  db.get("SELECT id FROM employee WHERE name = ?", [actual_user], (err, employee) => {
    if (err) {
      console.error("❌ Error finding employee:", err.message);
      return res.status(500).json({ error: "Database error", details: err.message });
    }

    const employeeId = employee ? employee.id : null;

    db.run(
      `UPDATE products SET 
       article = ?, description = ?, date_acquired = ?, property_number = ?, 
       unit = ?, unit_value = ?, balance_per_card = ?, on_hand_per_count = ?, 
       total_amount = ?, remarks = ?, actual_user = ?, FK_employee = ?
       WHERE id = ?`,
      [
        article, description || '', date_acquired, property_number || '',
        unit || '', parseFloat(unit_value), parseInt(balance_per_card) || 0,
        parseInt(on_hand_per_count) || 0, parseFloat(total_amount) || 0,
        remarks || '', actual_user, employeeId, id
      ],
      function(err) {
        if (err) {
          console.error("❌ Error updating product:", err.message);
          return res.status(500).json({ error: "Failed to update product", details: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Product not found" });
        }
        res.json({ message: "Product updated successfully" });
      }
    );
  });
});

// Delete product route
server.delete("/delete-product/:id", (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM products WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("❌ Error deleting product:", err.message);
      return res.status(500).json({ error: "Failed to delete product", details: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  });
});

// API Routes
server.get('/get-products/all', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'date_acquired';
  const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;
  
  console.log("🔍 Fetching all products");
  
  try {
    // Get total count with search
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM products 
      WHERE article LIKE ? OR description LIKE ?
    `;
    const searchParam = `%${search}%`;
    
    db.get(countQuery, [searchParam, searchParam], (countErr, { total }) => {
      if (countErr) {
        console.error("❌ Error counting products:", countErr);
        return res.status(500).json({ error: "Database error", details: countErr.message });
      }

      // Get paginated and filtered results
      const query = `
        SELECT p.*, 
               e.name as employee_name,
               e.position as employee_position,
               e.department as employee_department
        FROM products p
        LEFT JOIN employee e ON p.FK_employee = e.id
        WHERE p.article LIKE ? OR p.description LIKE ?
        ORDER BY p.${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      db.all(query, [searchParam, searchParam, limit, offset], (err, products) => {
        if (err) {
          console.error("❌ Error fetching products:", err);
          return res.status(500).json({ error: "Database error", details: err.message });
        }

        console.log(`Found ${products.length} products`);
        
        // Map the products to include proper user information
        const mappedProducts = products.map(product => ({
          ...product,
          actual_user: product.employee_name || '',
          employee_name: product.employee_name || '',
          employee_position: product.employee_position || '',
          employee_department: product.employee_department || ''
        }));

        // Send paginated response
        res.json({
          total,
          page,
          totalPages: Math.ceil(total / limit),
          products: mappedProducts || [],
          hasMore: offset + mappedProducts.length < total
        });
      });
    });
  } catch (err) {
    console.error("❌ Error in get-products:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error", details: err.message });
    }
  }
});

server.get('/get-employees', (req, res) => {
  console.log("🔍 Fetching all employees");
  db.all(`
    SELECT e.*, 
           COALESCE(u.role, 'employee') as role
    FROM employee e
    LEFT JOIN users u ON e.id = u.FK_employee
    ORDER BY e.name ASC`, 
    [], 
    (err, rows) => {
      if (err) {
        console.error("❌ Error fetching employees:", err);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`✅ Found ${rows.length} employees`);
      res.json(rows || []);
    });
});

// MOVED: Get all employees for dropdowns (no pagination) - TESTING IF LOCATION MATTERS
server.get("/get-all-employees", (req, res) => {
  db.all(
    `SELECT e.*, COALESCE(u.role, 'employee') as role
     FROM employee e
     LEFT JOIN users u ON e.id = u.FK_employee
     ORDER BY e.name ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ Error fetching all employees:", err.message);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      res.json(rows || []);
    }
  );
});

// TEST: Add a simple test route here to confirm this section works
server.get("/test-working-section", (req, res) => {
  console.log("🧪 Test route in working section reached!");
  res.json({ message: "Working section test successful", timestamp: new Date().toISOString() });
});

// MOVED: API route for supervisor view - testing if location fixes 404
server.get("/api/products/all", async (req, res) => {
  console.log("🔍 Fetching all products for supervisor view");
  
  try {
    // First clear any cached data to ensure fresh results
    cache.invalidate('products');
    cache.invalidate('get-products');
    cache.invalidate('api/products');

    const query = `
      SELECT 
        p.*,
        e.name as employee_name,
        e.employee_id,
        e.position as employee_position,
        e.department as employee_department,
        e.email as employee_email,
        e.contact_number as employee_contact,
        e.address as employee_address,
        COALESCE(e.name, 'No User Assigned') as actual_user,
        CASE 
          WHEN p.FK_employee IS NOT NULL THEN COALESCE(e.name, 'No User Assigned')
          ELSE 'Admin'
        END as assigned_to,
        (SELECT COUNT(*) FROM returns r 
         WHERE r.ics_no = p.property_number 
         OR r.description = p.article) as return_count
      FROM products p
      LEFT JOIN employee e ON p.FK_employee = e.id
      ORDER BY p.date_acquired DESC NULLS LAST, p.id DESC`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching articles:", err.message);
        return res.status(500).json({ error: "Database error", details: err.message });
      }

      // Process the rows to ensure all fields are properly formatted
      const processedRows = rows.map(row => ({
        ...row,
        date_acquired: row.date_acquired || null,
        property_number: row.property_number || '',
        unit: row.unit || '',
        balance_per_card: row.balance_per_card || 0,
        on_hand_per_count: row.on_hand_per_count || 0,
        total_amount: row.total_amount || 0,
        remarks: row.remarks || '',
        employee_name: row.employee_name || 'No User Assigned',
        employee_id: row.employee_id || '',
        employee_position: row.employee_position || '',
        employee_department: row.employee_department || '',
        employee_email: row.employee_email || '',
        employee_contact: row.employee_contact || '',
        employee_address: row.employee_address || '',
        user: row.assigned_to || 'No User Assigned', // This will be used for filtering
        return_count: row.return_count || 0,
        has_returns: (row.return_count || 0) > 0
      }));

      console.log(`✅ Found ${processedRows.length} articles`);
      res.status(200).json(processedRows);
    });
  } catch (error) {
    console.error("❌ Error in /api/products/all:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// MOVED: Add Employee - testing if location fixes 404
server.post("/add-employee", async (req, res) => {
  const { name, position, department, email, contact_number, address, password } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  db.serialize(async () => {
    db.run(
      `INSERT INTO employee (name, position, department, email, contact_number, address) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, position, department, email, contact_number, address],
      async function (err) {
        if (err) {
          console.error("❌ Error adding employee:", err.message);
          return res.status(500).json({ error: "Database error", details: err.message });
        }
        const employeeId = this.lastID;
        
        // Generate an employee ID (e.g., EMP001)
        const paddedId = String(employeeId).padStart(3, '0');
        const generatedEmployeeId = `EMP${paddedId}`;
        
        // Update the employee record with the generated ID
        db.run(
          `UPDATE employee SET employee_id = ? WHERE id = ?`,
          [generatedEmployeeId, employeeId],
          async (updateErr) => {
            if (updateErr) {
              console.error("❌ Error updating employee ID:", updateErr.message);
              return res.status(500).json({ error: "Database error", details: updateErr.message });
            }
            
            // Create user account if password is provided
            if (password) {
              try {
                const hashedPassword = await bcrypt.hash(password, 10);
                db.run(
                  `INSERT INTO users (name, role, password, FK_employee) VALUES (?, ?, ?, ?)`,
                  [name, 'employee', hashedPassword, employeeId],
                  function (userErr) {
                    if (userErr) {
                      console.error("❌ Error creating user account:", userErr.message);
                      // Still return success for employee creation, but note the user creation failure
                      return res.status(200).json({
                        message: "✅ Employee added successfully (user account creation failed)",
                        id: employeeId,
                        employee_id: generatedEmployeeId,
                        warning: "User account could not be created"
                      });
                    }
                    res.status(200).json({
                      message: "✅ Employee and user account added successfully",
                      id: employeeId,
                      employee_id: generatedEmployeeId,
                      user_id: this.lastID
                    });
                  }
                );
              } catch (hashErr) {
                console.error("❌ Error hashing password:", hashErr);
                return res.status(500).json({ error: "Password processing error" });
              }
            } else {
              res.status(200).json({
                message: "✅ Employee added successfully",
                id: employeeId,
                employee_id: generatedEmployeeId
              });
            }
          }
        );
      }
    );
  });
});

// Testing route relocation theory - this should work if location fixes 404
server.get("/test-relocated-route", (req, res) => {
  res.status(200).json({ 
    message: "✅ Route relocation successful!", 
    timestamp: new Date().toISOString(),
    relocated: true 
  });
});

// MOVED: Get ALL receipts (For Supervisor View) - testing if location fixes 404
server.get("/api/returns/all", (req, res) => {
  console.log("🔍 Fetching all returns for supervisor view");
  const query = `
    SELECT 
      r.*,
      e.name as creator_name,
      e.position as creator_position,
      e.department as creator_department,
      e.employee_id as creator_employee_id,
      e.email as creator_email,
      e.contact_number as creator_contact,
      e.address as creator_address,
      eu.name as end_user_name,
      eu.position as end_user_position,
      eu.department as end_user_department,
      eu.employee_id as end_user_employee_id,
      eu.email as end_user_email,
      eu.contact_number as end_user_contact,
      eu.address as end_user_address
    FROM returns r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN employee e ON u.FK_employee = e.id
    LEFT JOIN employee eu ON r.end_user = eu.name
    ORDER BY r.date DESC, r.id DESC`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Error fetching receipts:", err.message);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    console.log("✅ Supervisor Viewing Receipts:", rows.length, "receipts found.");
    
    // Map rows to ensure location fields are properly set
    const processedRows = rows.map(row => ({
      ...row,
      returned_by_location: row.returned_by_location || '',
      received_by_location: row.received_by_location || '',
      second_received_by_location: row.second_received_by_location || ''
    }));
    
    // Clear any cached data to ensure fresh results
    cache.invalidate('returns');
    res.status(200).json(processedRows);
  });
});

// MOVED: Get activity logs - testing if location fixes 404
server.get("/api/logs", (req, res) => {
  console.log("🔍 Fetching activity logs");
  db.all(
    `SELECT al.*, u.name as user_name, u.role as user_role
     FROM activity_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.timestamp DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ Error fetching logs:", err.message);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      console.log(`✅ Found ${rows.length} activity logs`);
      res.status(200).json(rows || []);
    }
  );
});

// Edit user
server.put("/edit-user/:id", (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: "Name and role are required" });
  }

  db.run(
    `UPDATE users SET name = ?, role = ? WHERE id = ?`,
    [name, role, id],
    function (err) {
      if (err) {
        console.error("❌ Error updating user:", err.message);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "User updated successfully" });
    }
  );
});

// Delete user
server.delete("/delete-user/:id", (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error("❌ Error deleting user:", err.message);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});

// Employee Login endpoint
server.post('/employee-login', (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) {
    return res.status(400).json({ error: "Employee ID is required" });
  }

  db.get(
    `SELECT e.*, u.role 
     FROM employee e 
     LEFT JOIN users u ON e.id = u.FK_employee 
     WHERE e.employee_id = ?`,
    [employeeId],
    (err, employee) => {
      if (err) {
        console.error("❌ Error during employee login:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (!employee) {
        return res.status(401).json({ error: "Invalid Employee ID" });
      }

      // If no user account exists for this employee, create one
      if (!employee.role) {
        const createUserQuery = `
          INSERT INTO users (name, role, password, FK_employee)
          VALUES (?, 'employee', '', ?)
        `;
        
        db.run(createUserQuery, [employee.name, employee.id], function(err) {
          if (err) {
            console.error("❌ Error creating user account for employee:", err);
            return res.status(500).json({ error: "Error creating user account" });
          }
          
          // Successfully created user account
          res.json({
            role: "employee",
            name: employee.name,
            employeeId: employee.employee_id
          });
        });
      } else {
        // User account already exists
        res.json({
          role: "employee",
          name: employee.name,
          employeeId: employee.employee_id
        });
      }
    }
  );
});

// FIND YOUR EXISTING createTables FUNCTION (around line 35-90) AND REPLACE IT WITH THIS:

const createTables = (callback) => {
  db.serialize(() => {
    console.log("ℹ️ Checking/Creating tables...");

    // ⚠️ NEVER drop tables in production - this would delete all data!
    // Tables are created with IF NOT EXISTS, so they're safe
    
    // Track how many async table creations are complete
    let completed = 0;
    const total = 5; // Updated to 5 tables (including activity_logs)

    const checkDone = () => {
      completed += 1;
      if (completed === total) {
        console.log("✅ All tables checked/created.");
        // Add missing columns after all tables are created
        addMissingColumns(() => {
          if (callback) callback();
        });
      }
    };

    // Employee table
    db.run(
      `CREATE TABLE IF NOT EXISTS employee (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT,
        department TEXT,
        email TEXT,
        contact_number TEXT,
        address TEXT,
        employee_id TEXT UNIQUE
      )`,
      (err) => {
        if (err) console.error("❌ Error creating 'employee' table:", err.message);
        else console.log("✅ 'employee' table ready!");
        checkDone();
      }
    );

    // Users table
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        FK_employee INTEGER,
        role TEXT CHECK(role IN ('admin', 'employee', 'supervisor')) NOT NULL,
        password TEXT NOT NULL,
        FOREIGN KEY (FK_employee) REFERENCES employee(id) ON DELETE SET NULL
      )`,
      (err) => {
        if (err) console.error("❌ Error creating 'users' table:", err.message);
        else console.log("✅ 'users' table ready!");
        checkDone();
      }
    );

    // Products table
    db.run(
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article TEXT NOT NULL,
        description TEXT,
        date_acquired TEXT,
        property_number TEXT,
        unit TEXT,
        unit_value REAL NOT NULL,
        balance_per_card INTEGER,
        on_hand_per_count INTEGER,
        total_amount REAL,
        FK_employee INTEGER,
        remarks TEXT,
        FOREIGN KEY (FK_employee) REFERENCES employee(id) ON DELETE SET NULL
      )`,
      (err) => {
        if (err) console.error("❌ Error creating 'products' table:", err.message);
        else console.log("✅ 'products' table ready!");
        checkDone();
      }
    );

    // Activity Logs table
    db.run(
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user_id INTEGER,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      (err) => {
        if (err) console.error("❌ Error creating 'activity_logs' table:", err.message);
        else console.log("✅ 'activity_logs' table ready!");
        checkDone();
      }
    );

    // Returns table with all columns
    db.run(
      `CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rrsp_no TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        ics_no TEXT NOT NULL,
        date_acquired TEXT NOT NULL,
        amount REAL NOT NULL,
        end_user TEXT,
        remarks TEXT,
        returned_by TEXT NOT NULL,
        returned_by_position TEXT NOT NULL,
        returned_by_date TEXT NOT NULL,
        returned_by_location TEXT,
        received_by TEXT NOT NULL,
        received_by_position TEXT NOT NULL,
        received_by_date TEXT NOT NULL,
        received_by_location TEXT,
        second_received_by TEXT,
        second_received_by_position TEXT,
        second_received_by_date TEXT,
        second_received_by_location TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )`,
      (err) => {
        if (err) console.error("❌ Error creating 'returns' table:", err.message);
        else console.log("✅ 'returns' table ready!");
        checkDone();
      }
    );
  });
};

// ADD THIS NEW FUNCTION RIGHT AFTER createTables:
function addMissingColumns(callback) {
  const columnsToAdd = [
    { table: "returns", column: "returned_by_location", type: "TEXT" },
    { table: "returns", column: "received_by_location", type: "TEXT" },
    { table: "returns", column: "second_received_by_location", type: "TEXT" },
    { table: "returns", column: "created_by", type: "INTEGER REFERENCES users(id)" },
    { table: "employee", column: "employee_id", type: "TEXT UNIQUE" },
    { table: "products", column: "actual_user", type: "TEXT" }
  ];

  let completed = 0;
  const total = columnsToAdd.length;

  function checkDone() {
    completed += 1;
    if (completed === total) {
      console.log("✅ All missing columns checked/added.");
      // Verify system readiness
      verifySystemReadiness(() => {
        if (callback) callback();
      });
    }
  }

  // Process each column
  columnsToAdd.forEach(({ table, column, type }) => {
    db.get(
      `SELECT COUNT(*) as count FROM pragma_table_info('${table}') WHERE name='${column}'`,
      [],
      (err, result) => {
        if (err) {
          console.error(`❌ Error checking column ${column}:`, err.message);
          checkDone();
          return;
        }

        if (result.count === 0) {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
            if (err) {
              console.error(`❌ Error adding column ${column}:`, err.message);
            } else {
              console.log(`✅ Added ${column} to ${table}`);
            }
            checkDone();
          });
        } else {
          console.log(`✅ Column ${column} already exists in ${table}`);
          checkDone();
        }
      }
    );
  });
}

// Function to verify system readiness (removed test employee creation for production)
function verifySystemReadiness(callback) {
  // Simply callback - no test data in production
  if (callback) callback();
}

// 🚀 User Login
server.post("/login", (req, res) => {
  const { name, password, employeeId } = req.body;
  
  console.log("🔑 Login attempt:", { name, employeeId, hasPassword: !!password });

  // Employee login with employee ID only
  if (employeeId) {
    db.get(
      `SELECT e.*, u.role
       FROM employee e
       LEFT JOIN users u ON u.FK_employee = e.id
       WHERE e.employee_id = ?`,
      [employeeId],
      (err, employee) => {
        if (err) return res.status(500).json({ error: "Database error", details: err.message });
        if (!employee) return res.status(401).json({ error: "Invalid Employee ID" });
        
        res.status(200).json({
          role: "employee",
          employeeId: employeeId,
          name: employee.name,
          position: employee.position
        });
      }
    );
    return;
  }

  // Administrator/Supervisor login with username
  console.log("🔍 Looking for user:", name);
  db.get(
    `SELECT role, password FROM users WHERE LOWER(name) = LOWER(?)`,
    [name],
    (err, user) => {
      if (err) {
        console.error("❌ Database error:", err);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      
      console.log("🔍 User found:", user ? `${user.role}` : 'null');
      
      if (!user) {
        console.log("❌ Invalid username:", name);
        return res.status(401).json({ error: "Invalid username" });
      }

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error("❌ Password comparison error:", err);
          return res.status(500).json({ error: "Error checking password" });
        }
        
        console.log("🔐 Password match:", isMatch);
        
        if (!isMatch) {
          console.log("❌ Invalid password for user:", name);
          return res.status(401).json({ error: "Invalid password" });
        }
        
        console.log("✅ Login successful:", name);
        res.status(200).json({ role: user.role, name: name });
      });
    }
  );
});
  // 🚀 Insert Sample Users (If None Exist)
  const insertSampleData = async () => {
    db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", async (err, row) => {
      if (err) {
        console.error("❌ Error checking users table:", err);
        return;
      }

      if (row.count === 0) {
        console.log("ℹ️ No admin found, creating default admin...");

        // Hash the default password ("password123")
        const adminPassword = await bcrypt.hash("password123", 10);

        // Insert the default Administrator account
        db.run(
          `INSERT INTO users (name, role, password) VALUES (?, ?, ?)`,
          ["Administrator", "admin", adminPassword],
          (err) => {
            if (err) {
              console.error("❌ Error adding default admin:", err);
            } else {
              console.log("✅ Default admin account created (Username: Administrator, Password: password123)");
            }
          }
        );
      } else {
        console.log("✅ Admin account already exists.");
      }
    });
  };




  // 🚀 Register User
  server.post("/add-user", async (req, res) => {
    try {
      const { name, role, password, FK_employee, employeeData } = req.body;
      
      if (!name || !role || !password) {
        return res.status(400).json({ error: "Name, role, and password are required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // For supervisor/admin users, we don't need employee data
      if (role === 'supervisor' || role === 'admin') {
        db.run(
          `INSERT INTO users (name, role, password) VALUES (?, ?, ?)`,
          [name, role, hashedPassword],
          function (err) {
            if (err) {
              console.error("❌ Error adding supervisor/admin:", err.message);
              return res.status(500).json({ error: "Database error", details: err.message });
            }
            res.status(200).json({ 
              message: "✅ User added successfully",
              userId: this.lastID 
            });
          }
        );
        return;
      }

      // For employee users
      if (FK_employee) {
        db.run(
          `INSERT INTO users (name, role, password, FK_employee) VALUES (?, ?, ?, ?)`,
          [name, role, hashedPassword, FK_employee],
          function (err) {
            if (err) {
              console.error("❌ Error adding user:", err.message);
              return res.status(500).json({ error: "Database error", details: err.message });
            }
            res.status(200).json({ 
              message: "✅ User added successfully",
              userId: this.lastID 
            });
          }
        );
      } else if (employeeData && employeeData.name) {
        // Create new employee first
        db.run(
          `INSERT INTO employee (name, position, department, email, contact_number, address) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            employeeData.name,
            employeeData.position || "",
            employeeData.department || "",
            employeeData.email || "",
            employeeData.contact_number || "",
            employeeData.address || ""
          ],
          function (err) {
            if (err) {
              console.error("❌ Error creating employee:", err.message);
              return res.status(500).json({ error: "Database error", details: err.message });
            }
            
            // Then create user account
            const empId = this.lastID;
            db.run(
              `INSERT INTO users (name, role, password, FK_employee) VALUES (?, ?, ?, ?)`,
              [name, role, hashedPassword, empId],
              function (err) {
                if (err) {
                  console.error("❌ Error adding user:", err.message);
                  return res.status(500).json({ error: "Database error", details: err.message });
                }
                res.status(200).json({ 
                  message: "✅ User and employee added successfully",
                  userId: this.lastID,
                  employeeId: empId
                });
              }
            );
          }
        );
      } else {
        return res.status(400).json({ error: "No employee selected or provided" });
      }
    } catch (err) {
      console.error("❌ Error in add-user:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  });

  // 🚀 Add Product
server.post("/add-product", auditLog('add_product'), async (req, res) => {
  // Set proper headers
  res.setHeader('Content-Type', 'application/json');
  const {
    article,
    description,
    date_acquired,
    property_number,
    unit,
    unit_value,
    balance_per_card,
    on_hand_per_count,
    total_amount,
    remarks,
    userName
  } = req.body;

  // Use userName as actual_user if actual_user is not provided
  const actual_user = req.body.actual_user || userName;

  // Log the received data for debugging
  console.log("📦 Received product data:", req.body);

  // Validate required fields
  if (!article || !unit_value || (!actual_user && !userName)) {
    return res.status(400).json({ 
      message: "Missing required fields",
      required: ['article', 'unit_value', 'actual_user or userName']
    });
  }

  // Log the validated data
  console.log("📦 Validated product data:", {
    ...req.body,
    actual_user: actual_user
  });

  // First get the employee ID for the actual user
  console.log("🔍 Looking up employee by name:", actual_user);
  db.get(
    "SELECT id, name, position, department FROM employee WHERE name = ?",
    [actual_user],
    (err, employee) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!employee) {
        console.error("Employee not found:", actual_user);
        return res.status(400).json({ message: "Employee not found" });
      }

      console.log("Found employee:", employee);

      // Create the product with employee association
      const insertQuery = `
        INSERT INTO products (
          article,
          description,
          date_acquired,
          property_number,
          unit,
          unit_value,
          balance_per_card,
          on_hand_per_count,
          total_amount,
          remarks,
          actual_user,
          FK_employee
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        article,
        description || '',
        date_acquired || new Date().toISOString().split('T')[0],
        property_number || '',
        unit || '',
        parseFloat(unit_value) || 0,
        parseInt(balance_per_card) || 0,
        parseInt(on_hand_per_count) || 0,
        parseFloat(total_amount) || 0,
        remarks || '',
        actual_user,
        employee.id
      ];

      db.run(insertQuery, values, function(err) {
        if (err) {
          console.error("Error inserting product:", err);
          return res.status(500).json({ message: "Error creating product" });
        }

        console.log("Product added successfully with ID:", this.lastID);
        
        // Broadcast real-time update to all connected clients
        if (global.broadcast) {
          global.broadcast('product_added', {
            id: this.lastID,
            article,
            actual_user,
            employee: employee?.name
          });
        }
        
        res.json({
          message: "Product added successfully",
          productId: this.lastID,
          employee: employee
        });
      });
    });
});

// 🚀 Add Receipt (Return)
server.post("/add-receipt", (req, res) => {
  const {
    rrspNo, date, description, quantity, icsNo, dateAcquired, amount, endUser, remarks,
    returnedBy,
    receivedBy,
    secondReceivedBy = {}
  } = req.body;

  // Get the employee ID directly
  db.get(
    `SELECT e.id 
     FROM employee e 
     WHERE e.name = ?`,
    [endUser],
    (err, employee) => {
      if (err) {
        console.error("❌ Error finding employee:", err.message);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      if (!employee) {
        return res.status(400).json({ error: "Employee not found" });
      }

      // Log the received data for debugging
      console.log("📝 Received return data:", {
        rrspNo, date, description, quantity, icsNo, dateAcquired, 
        amount, endUser, returnedBy, receivedBy
      });

      // ✅ Validate required fields
      const missingFields = [];
      if (!rrspNo) missingFields.push("RRSP Number");
      if (!date) missingFields.push("Date");
      if (!description) missingFields.push("Description");
      if (!quantity) missingFields.push("Quantity");
      if (!icsNo) missingFields.push("ICS Number");
      if (!dateAcquired) missingFields.push("Date Acquired");
      if (!amount) missingFields.push("Amount");
      if (!endUser) missingFields.push("End User");
      if (!returnedBy?.name) missingFields.push("Returned By Name");
      if (!returnedBy?.position) missingFields.push("Returned By Position");
      if (!returnedBy?.returnDate) missingFields.push("Return Date");
      if (!returnedBy?.location) missingFields.push("Return Location");
      if (!receivedBy?.name) missingFields.push("Received By Name");
      if (!receivedBy?.position) missingFields.push("Received By Position");
      if (!receivedBy?.receiveDate) missingFields.push("Receive Date");
      if (!receivedBy?.location) missingFields.push("Receive Location");

  if (missingFields.length > 0) {
    console.error("❌ Missing Fields:", missingFields);
    return res.status(400).json({ 
      error: "Missing required fields", 
      details: `Missing: ${missingFields.join(", ")}` 
    });
  }

      const sql = `
        INSERT INTO returns (
          rrsp_no, date, description, quantity, ics_no, date_acquired, amount, end_user, remarks,
          returned_by, returned_by_position, returned_by_date, returned_by_location,
          received_by, received_by_position, received_by_date, received_by_location,
          second_received_by, second_received_by_position, second_received_by_date, second_received_by_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Ensure all locations are properly formatted or null
      const returnedLocation = returnedBy.location?.trim() || null;
      const receivedLocation = receivedBy.location?.trim() || null;
      const secondReceivedLocation = secondReceivedBy?.location?.trim() || null;

      // Validate that locations are not just single characters
      if (returnedLocation && returnedLocation.length < 2) {
        return res.status(400).json({ 
          error: "Invalid location", 
          details: "Returned By Location must be at least 2 characters long" 
        });
      }
      if (receivedLocation && receivedLocation.length < 2) {
        return res.status(400).json({ 
          error: "Invalid location", 
          details: "Received By Location must be at least 2 characters long" 
        });
      }
      if (secondReceivedLocation && secondReceivedLocation.length < 2) {
        return res.status(400).json({ 
          error: "Invalid location", 
          details: "Second Received By Location must be at least 2 characters long" 
        });
      }

      const values = [
        rrspNo, date, description, quantity, icsNo, dateAcquired, amount, endUser, remarks || null,
        returnedBy.name, returnedBy.position?.trim() || null, returnedBy.returnDate, returnedLocation,
        receivedBy.name, receivedBy.position?.trim() || null, receivedBy.receiveDate, receivedLocation,
        secondReceivedBy?.name?.trim() || null, secondReceivedBy?.position?.trim() || null,
        secondReceivedBy?.receiveDate?.trim() || null, secondReceivedLocation
      ];

  db.run(sql, values, function (err) {
    if (err) {
      console.error("❌ Database Error:", err.message);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    
    // Broadcast real-time update to all connected clients
    if (global.broadcast) {
      global.broadcast('receipt_added', {
        id: this.lastID,
        rrspNo,
        endUser,
        description,
        amount
      });
    }
    
    res.status(200).json({ message: "✅ Receipt added successfully", receiptId: this.lastID });
  });
});

// 🚀 Update Return (PUT endpoint for editing returns)
server.put("/api/returns/:id", (req, res) => {
  const { id } = req.params;
  const {
    rrsp_no, date, description, quantity, ics_no, date_acquired, amount, end_user, remarks,
    returned_by, returned_by_position, returned_by_date, returned_by_location,
    received_by, received_by_position, received_by_date, received_by_location,
    second_received_by, second_received_by_position, second_received_by_date, second_received_by_location
  } = req.body;

  console.log("🔄 Updating return with ID:", id);
  console.log("📝 Update data:", req.body);

  if (!rrsp_no || !date || !description || !quantity || !end_user) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  db.run(
    `UPDATE returns SET 
     rrsp_no = ?, date = ?, description = ?, quantity = ?, ics_no = ?, 
     date_acquired = ?, amount = ?, end_user = ?, remarks = ?,
     returned_by = ?, returned_by_position = ?, returned_by_date = ?, returned_by_location = ?,
     received_by = ?, received_by_position = ?, received_by_date = ?, received_by_location = ?,
     second_received_by = ?, second_received_by_position = ?, second_received_by_date = ?, second_received_by_location = ?
     WHERE id = ?`,
    [
      rrsp_no, date, description, parseInt(quantity), ics_no || '', 
      date_acquired || '', parseFloat(amount) || 0, end_user, remarks || '',
      returned_by || '', returned_by_position || '', returned_by_date || '', returned_by_location || '',
      received_by || '', received_by_position || '', received_by_date || '', received_by_location || '',
      second_received_by || '', second_received_by_position || '', second_received_by_date || '', second_received_by_location || '',
      id
    ],
    function(err) {
      if (err) {
        console.error("❌ Error updating return:", err.message);
        return res.status(500).json({ error: "Failed to update return", details: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Return not found" });
      }
      
      console.log("✅ Return updated successfully (including sender/receiver fields)");
      
      // Broadcast real-time update to all connected clients
      if (global.broadcast) {
        global.broadcast('return_updated', { id, rrsp_no, end_user });
      }
      
      // Invalidate cache
      cache.invalidate('returns');
      
      res.json({ message: "Return updated successfully" });
    }
  );
});

  // 🚀 Get Products for Employee
  server.get("/get-products/:user", (req, res) => {
    const userName = decodeURIComponent(req.params.user);
    console.log("🔍 Fetching products for user:", userName);
    
    // Set JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    if (!userName) {
      return res.status(400).json({ message: "User name is required" });
    }

    const query = `
      SELECT p.*, 
             e.name as employee_name,
             e.position as employee_position,
             e.department as employee_department,
             e.employee_id
      FROM products p
      LEFT JOIN employee e ON p.FK_employee = e.id
      WHERE e.name = ?
      ORDER BY p.date_acquired DESC, p.id DESC
    `;

    db.all(query, [userName], (err, products) => {
      if (err) {
        console.error("❌ Error fetching products:", err);
        return res.status(500).json({ error: "Database error", details: err.message });
      }
      
      console.log(`✅ Found ${products.length} products for user ${userName}`);
      
      // Map and format the products
      const formattedProducts = products.map(product => ({
        ...product,
        unit_value: parseFloat(product.unit_value) || 0,
        balance_per_card: parseInt(product.balance_per_card) || 0,
        on_hand_per_count: parseInt(product.on_hand_per_count) || 0,
        total_amount: parseFloat(product.total_amount) || 0,
        employee_name: product.employee_name || userName,
        employee_id: product.employee_id || '',
        employee_position: product.employee_position || '',
        employee_department: product.employee_department || ''
      }));
      
      res.json(formattedProducts);
    });
  });

  // 🚀 Get Receipts for Employee
  server.get("/get-receipts/:endUser", (req, res) => {
    const endUser = decodeURIComponent(req.params.endUser);
    console.log("🔍 Fetching receipts for user:", endUser);
    
    if (!endUser) {
      console.error("❌ No endUser provided");
      return res.status(400).json({ error: "End user is required" });
    }

    db.all(
      `SELECT r.*,
              c.name as creator_name,
              c.position as creator_position,
              c.department as creator_department,
              e.name as employee_name,
              e.position as employee_position,
              e.department as employee_department
       FROM returns r 
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN employee c ON u.FK_employee = c.id
       LEFT JOIN employee e ON e.name = r.end_user
       WHERE r.end_user = ? 
       ORDER BY r.date DESC, r.id DESC`,
      [req.params.endUser],
      (err, results) => {
        if (err) {
          console.error("❌ Database error fetching receipts:", err);
          return res.status(500).json({ error: "Database error", details: err.message });
        }
        console.log(`✅ Found ${results.length} receipts for user ${req.params.endUser}`);
        res.status(200).json(results);
      }
    );
  });

  // 🚀 Export Products as PDF
  server.get("/export-products/pdf", (req, res) => {
  const { startDate, endDate, includeReturns } = req.query;
  const doc = new PDFDocument();
  
  const filename = includeReturns === 'true' ? 'inventory_and_returns_report.pdf' : 'inventory_report.pdf';
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  // Helper function to create a simple table
  const createTable = (data, headers, title) => {
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();
    
    // Table settings
    const tableTop = doc.y;
    const itemCodeX = 50;
    const descriptionX = 120;
    const unitX = 250;
    const valueX = 300;
    const balanceX = 370;
    const onHandX = 430;
    const userX = 480;
    
    // Draw headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(headers[0], itemCodeX, tableTop);
    doc.text(headers[1], descriptionX, tableTop);
    doc.text(headers[2], unitX, tableTop);
    doc.text(headers[3], valueX, tableTop);
    doc.text(headers[4], balanceX, tableTop);
    doc.text(headers[5], onHandX, tableTop);
    doc.text(headers[6], userX, tableTop);
    
    doc.moveDown();
    
    // Draw data rows
    doc.font('Helvetica').fontSize(8);
    data.forEach((row, i) => {
      const y = doc.y;
      doc.text(row[0] || '', itemCodeX, y);
      doc.text(row[1] || '', descriptionX, y);
      doc.text(row[2] || '', unitX, y);
      doc.text(row[3] || '', valueX, y);
      doc.text(row[4] || '', balanceX, y);
      doc.text(row[5] || '', onHandX, y);
      doc.text(row[6] || '', userX, y);
      doc.moveDown(0.5);
    });
    doc.moveDown();
  };

  // Products section
  doc.fontSize(20).text('Inventory Report', { align: 'center' });
  doc.moveDown();

  const productsSql = `
    SELECT products.*, employee.name AS employee_name
    FROM products
    LEFT JOIN employee ON products.FK_employee = employee.id
    WHERE date_acquired BETWEEN ? AND ?
  `;

  db.all(productsSql, [startDate, endDate], (err, products) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).send("Error generating report");
    }

    // Add products table
    if (products.length > 0) {
      const headers = ['Article', 'Description', 'Unit', 'Value', 'Balance', 'On Hand', 'User'];
      const rows = products.map(p => [
        p.article,
        p.description || '',
        p.unit || '',
        `₱${Number(p.unit_value).toLocaleString()}`,
        p.balance_per_card || 0,
        p.on_hand_per_count || 0,
        p.employee_name || 'Unassigned'
      ]);
      
      createTable(rows, headers, 'Products');
    }

    // If includeReturns is true, add returns section
    if (includeReturns === 'true') {
      const returnsSql = `
        SELECT r.*, e.name as employee_name
        FROM returns r
        LEFT JOIN employee e ON r.end_user = e.name
        WHERE r.date BETWEEN ? AND ?
      `;

      db.all(returnsSql, [startDate, endDate], (returnErr, returns) => {
        if (returnErr) {
          console.error("Error fetching returns:", returnErr);
          doc.end();
          return;
        }

        if (returns.length > 0) {
          doc.addPage();
          doc.fontSize(20).text('Returns Report', { align: 'center' });
          doc.moveDown();

          // Simple returns table
          doc.fontSize(16).text('Returns', { align: 'center' });
          doc.moveDown();
          
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('RRSP No', 50, doc.y);
          doc.text('Date', 120, doc.y);
          doc.text('Description', 180, doc.y);
          doc.text('Quantity', 300, doc.y);
          doc.text('Amount', 360, doc.y);
          doc.text('End User', 420, doc.y);
          doc.moveDown();
          
          doc.font('Helvetica').fontSize(8);
          returns.forEach((r) => {
            const y = doc.y;
            doc.text(r.rrsp_no || '', 50, y);
            doc.text(new Date(r.date).toLocaleDateString(), 120, y);
            doc.text(r.description || '', 180, y);
            doc.text(r.quantity || '', 300, y);
            doc.text(`₱${Number(r.amount).toLocaleString()}`, 360, y);
            doc.text(r.end_user || '', 420, y);
            doc.moveDown(0.5);
          });
        }
        doc.end();
      });
    } else {
      doc.end();
    }
  });
});
  
  
 server.get("/export-products/excel", (req, res) => {
  const { startDate, endDate, includeReturns } = req.query;
  const workbook = new ExcelJS.Workbook();
  
  // Products worksheet
  const productsSheet = workbook.addWorksheet("Products Report");
  productsSheet.columns = [
    { header: "ID", key: "id", width: 5 },
    { header: "Article", key: "article", width: 20 },
    { header: "Description", key: "description", width: 30 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Unit Value", key: "unit_value", width: 15 },
    { header: "Balance Per Card", key: "balance_per_card", width: 20 },
    { header: "On Hand", key: "on_hand_per_count", width: 15 },
    { header: "Total Amount", key: "total_amount", width: 15 },
    { header: "Actual User", key: "employee_name", width: 20 }
  ];

  // Products query
  const productsSql = `
    SELECT products.*, employee.name AS employee_name
    FROM products
    LEFT JOIN employee ON products.FK_employee = employee.id
    WHERE date_acquired BETWEEN ? AND ?
  `;

  // Execute products query
  db.all(productsSql, [startDate, endDate], (err, products) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).send("Error generating report");
    }

    // Add products data
    productsSheet.addRows(products);

    // If includeReturns is true, add returns worksheet
    if (includeReturns === 'true') {
      const returnsSheet = workbook.addWorksheet("Returns Report");
      returnsSheet.columns = [
        { header: "RRSP No", key: "rrsp_no", width: 15 },
        { header: "Date", key: "date", width: 12 },
        { header: "Description", key: "description", width: 30 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "End User", key: "end_user", width: 20 },
        { header: "Returned By", key: "returned_by", width: 20 },
        { header: "Received By", key: "received_by", width: 20 }
      ];

      // Returns query
      const returnsSql = `
        SELECT r.*, e.name as employee_name
        FROM returns r
        LEFT JOIN employee e ON r.end_user = e.name
        WHERE r.date BETWEEN ? AND ?
      `;

      // Execute returns query
      db.all(returnsSql, [startDate, endDate], (returnErr, returns) => {
        if (returnErr) {
          console.error("Error fetching returns:", returnErr);
          return res.status(500).send("Error generating report");
        }

        // Add returns data
        returnsSheet.addRows(returns);

        // Send the workbook
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory_and_returns_report.xlsx');
        
        workbook.xlsx.write(res)
          .then(() => {
            res.end();
          })
          .catch(err => {
            console.error("Error writing excel:", err);
            res.status(500).send("Error generating excel file");
          });
      });
    } else {
      // Send only products workbook
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.xlsx');
      
      workbook.xlsx.write(res)
        .then(() => {
          res.end();
        })
        .catch(err => {
          console.error("Error writing excel:", err);
          res.status(500).send("Error generating excel file");
        });
    }
  });
});

// 🚀 Export Returns as PDF
server.get("/export-returns/pdf", (req, res) => {
  const { startDate, endDate } = req.query;
  const doc = new PDFDocument();
  
  const filename = 'returns_report.pdf';
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  // Returns section
  doc.fontSize(20).text('Returns Report', { align: 'center' });
  doc.moveDown();

  const returnsSql = `
    SELECT r.*, e.name as employee_name
    FROM returns r
    LEFT JOIN employee e ON r.end_user = e.name
    WHERE r.date BETWEEN ? AND ?
    ORDER BY r.date DESC
  `;

  db.all(returnsSql, [startDate, endDate], (err, returns) => {
    if (err) {
      console.error("Error fetching returns:", err);
      return res.status(500).send("Error generating report");
    }

    if (returns.length > 0) {
      doc.fontSize(16).text('Returns', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('RRSP No', 30, doc.y);
      doc.text('Date', 90, doc.y);
      doc.text('ICS No', 140, doc.y);
      doc.text('Date Acq.', 210, doc.y);
      doc.text('Description', 270, doc.y);
      doc.text('Qty', 360, doc.y);
      doc.text('Amount', 390, doc.y);
      doc.text('End User', 450, doc.y);
      doc.moveDown();
      
      doc.font('Helvetica').fontSize(7);
      returns.forEach((r) => {
        const y = doc.y;
        doc.text(r.rrsp_no || '', 30, y, { width: 55 });
        doc.text(new Date(r.date).toLocaleDateString(), 90, y, { width: 45 });
        doc.text(r.ics_no || 'N/A', 140, y, { width: 65 });
        doc.text(r.date_acquired ? new Date(r.date_acquired).toLocaleDateString() : 'N/A', 210, y, { width: 55 });
        doc.text((r.description || '').substring(0, 30), 270, y, { width: 85 });
        doc.text(r.quantity || '', 360, y, { width: 25 });
        doc.text(`₱${Number(r.amount).toLocaleString()}`, 390, y, { width: 55 });
        doc.text((r.end_user || '').substring(0, 25), 450, y, { width: 80 });
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(14).text('No returns found for the selected date range.', { align: 'center' });
    }
    doc.end();
  });
});

// 🚀 Export Returns as Excel
server.get("/export-returns/excel", (req, res) => {
  const { startDate, endDate } = req.query;
  const workbook = new ExcelJS.Workbook();
  
  // Returns worksheet
  const returnsSheet = workbook.addWorksheet("Returns Report");
  returnsSheet.columns = [
    { header: "RRSP No", key: "rrsp_no", width: 15 },
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 30 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "ICS No", key: "ics_no", width: 15 },
    { header: "Date Acquired", key: "date_acquired", width: 15 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "End User", key: "end_user", width: 20 },
    { header: "Returned By", key: "returned_by", width: 20 },
    { header: "Received By", key: "received_by", width: 20 },
    { header: "Remarks", key: "remarks", width: 30 }
  ];

  // Returns query
  const returnsSql = `
    SELECT r.*, e.name as employee_name
    FROM returns r
    LEFT JOIN employee e ON r.end_user = e.name
    WHERE r.date BETWEEN ? AND ?
    ORDER BY r.date DESC
  `;

  // Execute returns query
  db.all(returnsSql, [startDate, endDate], (err, returns) => {
    if (err) {
      console.error("Error fetching returns:", err);
      return res.status(500).send("Error generating report");
    }

    // Add returns data
    returnsSheet.addRows(returns);

    // Send returns workbook
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=returns_report.xlsx');
    
    workbook.xlsx.write(res)
      .then(() => {
        res.end();
      })
      .catch(err => {
        console.error("Error writing excel:", err);
        res.status(500).send("Error generating excel file");
      });
  });
});

// 🚀 Export Returns as CSV
server.get("/export-returns/csv", (req, res) => {
  const { startDate, endDate } = req.query;

  // Returns query
  const returnsSql = `
    SELECT r.*, e.name as employee_name
    FROM returns r
    LEFT JOIN employee e ON r.end_user = e.name
    WHERE r.date BETWEEN ? AND ?
    ORDER BY r.date DESC
  `;

  // Execute returns query
  db.all(returnsSql, [startDate, endDate], (err, returns) => {
    if (err) {
      console.error("Error fetching returns:", err);
      return res.status(500).send("Error generating report");
    }

    // Create CSV content
    const headers = [
      'RRSP No', 'Date', 'Description', 'Quantity', 'ICS No', 
      'Date Acquired', 'Amount', 'End User', 'Returned By', 
      'Returned By Position', 'Received By', 'Received By Position', 'Remarks'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    returns.forEach(r => {
      const row = [
        `"${r.rrsp_no || ''}"`,
        `"${r.date || ''}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.quantity || 0,
        `"${r.ics_no || ''}"`,
        `"${r.date_acquired || ''}"`,
        r.amount || 0,
        `"${(r.end_user || '').replace(/"/g, '""')}"`,
        `"${(r.returned_by || '').replace(/"/g, '""')}"`,
        `"${(r.returned_by_position || '').replace(/"/g, '""')}"`,
        `"${(r.received_by || '').replace(/"/g, '""')}"`,
        `"${(r.received_by_position || '').replace(/"/g, '""')}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    // Send CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=returns_report.csv');
    res.send(csvContent);
  });
});

// 🚀 Get ALL articles (For Supervisor View) - COMMENTED OUT (moved to working section for testing)
// server.get("/api/products/all", async (req, res) => {
//     console.log("🔍 Fetching all products for supervisor view");
//     
//     try {
//       // First clear any cached data to ensure fresh results
//       cache.invalidate('products');
//       cache.invalidate('get-products');
//       cache.invalidate('api/products');
// 
//       const query = `
//         SELECT 
//           p.*,
//           e.name as employee_name,
//           e.employee_id,
//           e.position as employee_position,
//           e.department as employee_department,
//           e.email as employee_email,
//           e.contact_number as employee_contact,
//           e.address as employee_address,
//           COALESCE(e.name, 'No User Assigned') as actual_user,
//           CASE 
//             WHEN p.FK_employee IS NOT NULL THEN COALESCE(e.name, 'No User Assigned')
//             ELSE 'Admin'
//           END as assigned_to
//         FROM products p
//         LEFT JOIN employee e ON p.FK_employee = e.id
//         ORDER BY p.date_acquired DESC NULLS LAST, p.id DESC`;
//       
//       db.all(query, [], (err, rows) => {
//         if (err) {
//           console.error("❌ Error fetching articles:", err.message);
//           return res.status(500).json({ error: "Database error", details: err.message });
//         }
// 
//         // Process the rows to ensure all fields are properly formatted
//         const processedRows = rows.map(row => ({
//           ...row,
//           date_acquired: row.date_acquired || null,
//           property_number: row.property_number || '',
//           unit: row.unit || '',
//           balance_per_card: row.balance_per_card || 0,
//           on_hand_per_count: row.on_hand_per_count || 0,
//           total_amount: row.total_amount || 0,
//           remarks: row.remarks || '',
//           employee_name: row.employee_name || 'No User Assigned',
//           employee_id: row.employee_id || '',
//           employee_position: row.employee_position || '',
//           employee_department: row.employee_department || '',
//           employee_email: row.employee_email || '',
//           employee_contact: row.employee_contact || '',
//           employee_address: row.employee_address || '',
//           user: row.assigned_to || 'No User Assigned' // This will be used for filtering
//         }));
// 
//         console.log(`✅ Found ${processedRows.length} articles`);
//         res.status(200).json(processedRows);
//       });
//     } catch (error) {
//       console.error("❌ Error in /api/products/all:", error);
//       res.status(500).json({ error: "Server error", details: error.message });
//     }
//   });

// TEST ROUTE - Check if routes work in this section
server.get("/test-route", (req, res) => {
  console.log("🧪 Test route reached!");
  res.json({ message: "Test route working", timestamp: new Date().toISOString() });
});

// 🚀 Add Employee - COMMENTED OUT (moved to working section for testing)
// server.post("/add-employee", async (req, res) => {
//   const { name, position, department, email, contact_number, address, password } = req.body;
//   
//   if (!name) {
//     return res.status(400).json({ error: "Name is required" });
//   }
// 
//   db.serialize(async () => {
//     db.run(
//       `INSERT INTO employee (name, position, department, email, contact_number, address) VALUES (?, ?, ?, ?, ?, ?)`,
//       [name, position, department, email, contact_number, address],
//       async function (err) {
//         if (err) {
//           console.error("❌ Error adding employee:", err.message);
//           return res.status(500).json({ error: "Database error", details: err.message });
//         }
//         const employeeId = this.lastID;
//         
//         // Generate an employee ID (e.g., EMP001)
//         const paddedId = String(employeeId).padStart(3, '0');
//         const generatedEmployeeId = `EMP${paddedId}`;
//         
//         // Update the employee record with the generated ID
//         db.run(
//           `UPDATE employee SET employee_id = ? WHERE id = ?`,
//           [generatedEmployeeId, employeeId],
//           async (updateErr) => {
//             if (updateErr) {
//               console.error("❌ Error updating employee ID:", updateErr.message);
//               return res.status(500).json({ error: "Database error", details: updateErr.message });
//             }
//             
//             // Create user account if password is provided
//             if (password) {
//               try {
//                 const hashedPassword = await bcrypt.hash(password, 10);
//                 db.run(
//                   `INSERT INTO users (name, role, password, FK_employee) VALUES (?, ?, ?, ?)`,
//                   [name, 'employee', hashedPassword, employeeId],
//                   function (userErr) {
//                     if (userErr) {
//                       console.error("❌ Error creating user account:", userErr.message);
//                       // Still return success for employee creation, but note the user creation failure
//                       return res.status(200).json({
//                         message: "✅ Employee added successfully (user account creation failed)",
//                         id: employeeId,
//                         employee_id: generatedEmployeeId,
//                         warning: "User account could not be created"
//                       });
//                     }
//                     res.status(200).json({
//                       message: "✅ Employee and user account added successfully",
//                       id: employeeId,
//                       employee_id: generatedEmployeeId,
//                       user_id: this.lastID
//                     });
//                   }
//                 );
//               } catch (hashErr) {
//                 console.error("❌ Error hashing password:", hashErr);
//                 return res.status(500).json({ error: "Password processing error" });
//               }
//             } else {
//               res.status(200).json({
//                 message: "✅ Employee added successfully",
//                 id: employeeId,
//                 employee_id: generatedEmployeeId
//               });
//             }
//           }
//         );
//       }
//     );
//   });
// });

// COMMENTED OUT: Original location that was not working
// Get all employees for dropdowns (no pagination)
// server.get("/get-all-employees", (req, res) => {
//   db.all(
//     `SELECT e.*, COALESCE(u.role, 'employee') as role
//      FROM employee e
//      LEFT JOIN users u ON e.id = u.FK_employee
//      ORDER BY e.name ASC`,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("❌ Error fetching all employees:", err.message);
//         return res.status(500).json({ error: "Database error", details: err.message });
//       }
//       res.json(rows || []);
//     }
//   );
// });

// Alias route for /edit-employee/:id (matches AdminPanel calls)
server.put("/edit-employee/:id", (req, res) => {
  const { id } = req.params;
  const { name, position, department, email, contact_number, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  db.run(
    `UPDATE employee 
     SET name = ?, position = ?, department = ?, email = ?, contact_number = ?, address = ?
     WHERE id = ?`,
    [name, position || '', department || '', email || '', contact_number || '', address || '', id],
    function(err) {
      if (err) {
        console.error("❌ Error updating employee:", err.message);
        return res.status(500).json({ error: "Failed to update employee", details: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json({ message: "Employee updated successfully" });
    }
  );
});

// Delete employee
server.delete("/delete-employee/:id", (req, res) => {
  db.run(`DELETE FROM employee WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Employee deleted" });
  });
});

// Close the database connection callback
}); 

// Server is started in the database connection callback above