const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require('http');
const path = require("path");
const fs = require("fs");

// More reliable isDev detection
const isDev = (
  !app.isPackaged && 
  process.env.NODE_ENV !== 'production' &&
  !__dirname.includes('resources\\app')
);

// Create log file for debugging
const logFile = path.join(app.getPath('userData'), 'backend-startup.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function log(...args) {
  const message = args.join(' ');
  console.log(...args);
  logStream.write(`[${new Date().toISOString()}] ${message}\n`);
}

log('='.repeat(80));
log('ELECTRON MAIN PROCESS STARTING');
log('='.repeat(80));
log('Log file location:', logFile);
log('Is Dev:', isDev);
log('Is Packaged:', app.isPackaged);
log('__dirname:', __dirname);
log('process.resourcesPath:', process.resourcesPath || 'undefined');
log('='.repeat(80));

// ⚡ SINGLE INSTANCE LOCK - Prevent multiple instances IMMEDIATELY
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log("❌ Another instance is already running. Exiting immediately...");
  log("❌ Another instance is already running. Exiting immediately...");
  // Force immediate exit without waiting for anything
  process.exit(0);
} else {
  console.log("✅ Got single instance lock. This is the primary instance.");
  
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus the existing window instead
    console.log("⚠️ Second instance attempt detected. Focusing existing window...");
    
    // Show notification dialog to user
    dialog.showMessageBox({
      type: 'info',
      title: 'Inventory Management System',
      message: 'Application is already running!',
      detail: 'The Inventory Management System is already open. Only one instance can run at a time.',
      buttons: ['OK']
    });
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
      mainWindow.flashFrame(true); // Flash the window to get attention
    }
  });
}

let mainWindow = null;
let backendProcess = null;
let isAppQuitting = false;
let isBackendStarting = false;
let backendStartupAttempts = 0;
const MAX_STARTUP_ATTEMPTS = 3;

// ⚡ CLEANUP UTILITIES
const cleanup = () => {
  console.log("🧹 Performing cleanup...");
  isAppQuitting = true;
  
  if (backendProcess && !backendProcess.killed) {
    console.log("🔄 Terminating backend process...");
    try {
      if (process.platform === "win32") {
        // On Windows, force kill the process tree
        spawn("taskkill", ["/pid", backendProcess.pid, "/f", "/t"], { 
          stdio: 'ignore' 
        });
      } else {
        backendProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!backendProcess.killed) {
            backendProcess.kill('SIGKILL');
          }
        }, 3000);
      }
    } catch (error) {
      console.error("❌ Error terminating backend:", error);
    }
    backendProcess = null;
  }
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
};

// ⚡ PROCESS EXIT HANDLERS
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  cleanup();
  process.exit(1);
});

// Handle Windows specific cleanup
if (process.platform === "win32") {
  process.on('SIGBREAK', cleanup);
}

function startBackendServer() {
  if (backendProcess || isBackendStarting) {
    console.log("Backend server already running or starting");
    return Promise.resolve();
  }
  
  if (backendStartupAttempts >= MAX_STARTUP_ATTEMPTS) {
    console.error("Max backend startup attempts reached. Giving up.");
    log("❌ Max backend startup attempts reached. Giving up.");
    log("Log file location:", logFile);
    
    const errorMsg = `Failed to start backend server after multiple attempts.\n\nLog file saved to:\n${logFile}\n\nPlease send this log file for support.`;
    dialog.showErrorBox("Startup Failed", errorMsg);
    isAppQuitting = true;
    app.quit();
    return Promise.reject(new Error(errorMsg));
  }
  
  return new Promise((resolve, reject) => {
    isBackendStarting = true;
    backendStartupAttempts++;

    // Determine server path based on environment
    let serverPath;
    let resourcesPath;
    let buildPath = null; // Declare at function scope!
    
    if (isDev) {
      serverPath = path.join(__dirname, "server.js");
      resourcesPath = path.join(__dirname, "resources");
      buildPath = path.join(__dirname, "build"); // Set for development too
    } else {
      // In production, check for resources path in app.asar.unpacked
      resourcesPath = path.join(process.resourcesPath, "app.asar.unpacked", "resources");
      
      // Ensure resources directory exists in production
      if (!fs.existsSync(resourcesPath)) {
        fs.mkdirSync(resourcesPath, { recursive: true });
        console.log("📁 Created resources directory:", resourcesPath);
      }
      
      // Determine if we're in an asar archive
      const isInAsar = __dirname.includes('app.asar');
      
      // Find the build path for the React app - prioritize unpacked version
      const possibleBuildPaths = [
        // HIGHEST PRIORITY: app.asar.unpacked/build (will contain all React build files after fix)
        path.join(process.resourcesPath, "app.asar.unpacked", "build"),
        // Also check other locations as fallback
        path.join(process.resourcesPath, "app", "build"),
        path.join(process.resourcesPath, "build"),
        isInAsar && path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'build'),
        path.join(__dirname, "build"),
        path.join(path.dirname(process.execPath), "resources", "app.asar.unpacked", "build"),
        path.join(path.dirname(process.execPath), "resources", "app", "build")
      ].filter(p => p); // Remove any undefined values
      
      console.log("🔍 Searching for build directory...");
      for (const p of possibleBuildPaths) {
        const exists = fs.existsSync(p);
        const hasIndex = exists && fs.existsSync(path.join(p, 'index.html'));
        console.log(`   ${exists ? (hasIndex ? '✅ VALID' : '⚠️  EXISTS (no index.html)') : '❌ NOT FOUND'}: ${p}`);
        if (exists && hasIndex && !buildPath) {
          buildPath = p;
          console.log("✅ Found build directory at:", buildPath);
          break;
        }
      }
      
      if (!buildPath) {
        console.error("❌ Build directory not found! Tried:", possibleBuildPaths);
        buildPath = possibleBuildPaths[0]; // Use first as fallback
      }
      
      // Try multiple possible paths for server.js
      const possiblePaths = [
        path.join(process.resourcesPath, "app.asar.unpacked", "server.js"),
        path.join(process.resourcesPath, "server.js"),
        path.join(__dirname, "server.js"),
        path.join(process.resourcesPath, "app", "server.js"),
        path.join(path.dirname(process.execPath), "resources", "app", "server.js")
      ];
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          serverPath = p;
          console.log("✅ Found server.js at:", p);
          break;
        }
      }
      
      if (!serverPath) {
        const errorMsg = `Server file not found. Tried:\n${possiblePaths.join('\n')}`;
        dialog.showErrorBox("Server Not Found", errorMsg);
        isAppQuitting = true;
        app.quit();
        return reject(new Error(errorMsg));
      }
    }

    console.log("🚀 Starting backend server from:", serverPath);
    console.log("📊 Attempt:", backendStartupAttempts, "of", MAX_STARTUP_ATTEMPTS);

    const env = {
      ...process.env,
      NODE_ENV: isDev ? "development" : "production",
      PORT: "5001",
      REACT_APP_API_URL: "http://localhost:5001",
      RESOURCES_PATH: resourcesPath,
      BUILD_PATH: buildPath || "",
      // Add explicit paths for debugging
      APP_ROOT: __dirname,
      IS_PACKAGED: (!isDev).toString(),
      PROCESS_RESOURCES_PATH: process.resourcesPath || ""
    };

    console.log("🔧 Environment Configuration:");
    console.log("   NODE_ENV:", env.NODE_ENV);
    console.log("   PORT:", env.PORT);
    console.log("   BUILD_PATH:", env.BUILD_PATH);
    console.log("   RESOURCES_PATH:", env.RESOURCES_PATH);
    console.log("   IS_PACKAGED:", env.IS_PACKAGED);

    // Start the backend process
    let nodeExecutable;
    let args;
    
    if (isDev) {
      nodeExecutable = "node";
      args = [serverPath];
    } else {
      // In production, find Node.js executable
      const appPath = path.dirname(process.execPath);
      // DON'T redeclare resourcesPath - use the one from function scope!
      
      const possibleNodePaths = [
        // PRIMARY: Bundled node.exe in app.asar.unpacked/build
        path.join(process.resourcesPath, "app.asar.unpacked", "build", "node.exe"),
        // SECONDARY: Check if build folder is at resources root
        path.join(process.resourcesPath, "build", "node.exe"),
        // TERTIARY: Check app folder structure
        path.join(process.resourcesPath, "app", "build", "node.exe"),
        path.join(appPath, "resources", "app.asar.unpacked", "build", "node.exe"),
        path.join(appPath, "resources", "build", "node.exe"),
        // Check relative to server.js location
        path.join(path.dirname(serverPath), "build", "node.exe"),
        path.join(path.dirname(serverPath), "node.exe"),
        // System Node.js installations (LAST RESORT)
        path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs", "node.exe"),
        path.join(process.env['ProgramFiles(x86)'] || "C:\\Program Files (x86)", "nodejs", "node.exe"),
        path.join(process.env.LOCALAPPDATA, "Programs", "nodejs", "node.exe")
      ];
      
      nodeExecutable = null;
      console.log("🔍 Searching for Node.js executable...");
      console.log("📁 process.execPath:", process.execPath);
      console.log("📁 App path (dirname):", appPath);
      console.log("📁 Resources path (process.resourcesPath):", process.resourcesPath);
      console.log("📁 Resources path (variable):", resourcesPath);
      console.log("📁 __dirname:", __dirname);
      console.log("");
      console.log("Trying paths in order:");
      
      for (let i = 0; i < possibleNodePaths.length; i++) {
        const nodePath = possibleNodePaths[i];
        const exists = fs.existsSync(nodePath);
        console.log(`${i + 1}. ${exists ? '✅ FOUND' : '❌ NOT FOUND'}: ${nodePath}`);
        if (exists && !nodeExecutable) {
          nodeExecutable = nodePath;
        }
      }
      
      if (!nodeExecutable) {
        console.error("❌ Could not find node.exe!");
        console.error("Tried paths:", possibleNodePaths);
        
        dialog.showErrorBox(
          "Node.js Not Found",
          "The application could not find Node.js executable.\n\n" +
          "This is a packaging error. Please contact support.\n\n" +
          "Attempted locations:\n" + possibleNodePaths.slice(0, 3).join('\n')
        );
        
        isAppQuitting = true;
        app.quit();
        return reject(new Error("Node.js executable not found"));
      }
      
      args = [serverPath];
    }
    
    log("🚀 Spawning:", nodeExecutable, args);
    log("   Working Directory:", env.BUILD_PATH || 'not set');
    log("   Environment Variables:");
    log("     NODE_ENV:", env.NODE_ENV);
    log("     BUILD_PATH:", env.BUILD_PATH);
    log("     RESOURCES_PATH:", env.RESOURCES_PATH);
    
    backendProcess = spawn(nodeExecutable, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: env,
      windowsHide: false, // Always show console to catch startup errors
      detached: false,
      shell: false // Use direct execution for reliability
    });

    log("✅ Backend process spawned with PID:", backendProcess.pid);

    // Set a timeout for backend startup (45 seconds for production)
    const timeoutDuration = isDev ? 30000 : 45000;
    const startupTimeout = setTimeout(() => {
      if (isBackendStarting) {
        log("⏰ Backend startup timeout after", timeoutDuration / 1000, "seconds");
        log("💡 This may indicate:");
        log("   - Database initialization issues");
        log("   - Missing dependencies");
        log("   - Port conflicts");
        log("   - File permission issues");
        
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGTERM');
        }
        isBackendStarting = false;
        
        const errorMsg = `Backend failed to start within ${timeoutDuration / 1000} seconds.\n\nLog file: ${logFile}\n\nPlease check the log file for details.`;
        dialog.showErrorBox("Backend Timeout", errorMsg);
        reject(new Error("Backend startup timeout"));
      }
    }, timeoutDuration);

    // Handle process events
    backendProcess.on("error", (error) => {
      log("❌ Failed to start backend server:", error);
      log("   Error message:", error.message);
      log("   Error code:", error.code);
      log("   Error stack:", error.stack);
      clearTimeout(startupTimeout);
      isBackendStarting = false;
      reject(error);
    });

    backendProcess.on("exit", (code, signal) => {
      log(`🔄 Backend server exited with code ${code}, signal: ${signal}`);
      clearTimeout(startupTimeout);
      backendProcess = null;
      isBackendStarting = false;
      
      if (code === 0) {
        resolve(); // Clean exit
      } else {
        log(`❌ Backend exited with non-zero code: ${code}`);
        reject(new Error(`Backend exited with code ${code}`));
      }
    });

    // Capture output for debugging
    if (backendProcess.stdout) {
      let outputBuffer = '';
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Log each line separately for better readability
        const lines = output.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            log("[BACKEND]", line.trim());
          }
        });
        
        // Look for success indicators
        if (output.includes('SERVER_READY:') || output.includes('SERVER READY AND LISTENING')) {
          log("✅ Backend server started successfully!");
          log("✅ Backend is ready to accept connections");
          clearTimeout(startupTimeout);
          isBackendStarting = false;
          backendStartupAttempts = 0; // Reset on success
          resolve();
        }
      });
    }

    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            log("[BACKEND ERROR]", line.trim());
          }
        });
        
        // Look for critical errors
        if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
          log("🔴 CRITICAL: Port already in use!");
          clearTimeout(startupTimeout);
          isBackendStarting = false;
          
          dialog.showErrorBox(
            "Port Already in Use",
            "Port 5001 is already in use.\n\nAnother instance of the application may be running.\n\nPlease close it and try again."
          );
          reject(new Error("Port already in use - another instance may be running"));
        } else if (output.includes('Cannot find module')) {
          log("🔴 CRITICAL: Missing module dependency!");
          clearTimeout(startupTimeout);
          isBackendStarting = false;
          
          dialog.showErrorBox(
            "Missing Dependencies",
            "The application is missing required dependencies.\n\nThis is a packaging error. Please reinstall the application.\n\nError: " + output
          );
          reject(new Error("Missing module dependency: " + output));
        } else if (output.includes('ENOENT') || output.includes('no such file')) {
          log("🔴 CRITICAL: File not found error!");
          log("🔴 This may indicate missing database or config files");
        }
      });
    }

    // Simplified fallback: Just wait 3 seconds then do one health check
    setTimeout(() => {
      if (isBackendStarting && backendProcess && !backendProcess.killed) {
        console.log("🔍 Performing final health check...");
        const port = process.env.PORT || 5001;
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/ping',
          method: 'GET',
          timeout: 2000
        }, (res) => {
          if (res.statusCode === 200) {
            console.log("✅ Final health check passed!");
            clearTimeout(startupTimeout);
            isBackendStarting = false;
            backendStartupAttempts = 0;
            resolve();
          } else {
            console.error("❌ Final health check failed");
            clearTimeout(startupTimeout);
            isBackendStarting = false;
            reject(new Error("Backend health check failed"));
          }
        });
        
        req.on('error', (err) => {
          console.error("❌ Final health check error:", err.message);
          clearTimeout(startupTimeout);
          isBackendStarting = false;
          reject(new Error("Backend not responding"));
        });
        
        req.end();
      }
    }, 3000); // Wait only 3 seconds
  });
}

// Health check with exponential backoff and better error handling
function waitForBackend(maxAttempts = 15) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const baseDelay = 1000; // Starting delay in ms
    
    const check = () => {
      attempts++;
      if (attempts > maxAttempts) {
        reject(new Error(`Backend did not start after ${maxAttempts} attempts (${maxAttempts * baseDelay / 1000}s)`));
        return;
      }
      
      const port = process.env.PORT || 5001;
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/ping',
        method: 'GET',
        timeout: 3000
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log(`Backend health check passed on attempt ${attempts}`);
          resolve();
        } else {
          console.log(`Backend health check failed (status: ${res.statusCode}), retrying...`);
          retryWithBackoff();
        }
      });
      
      req.on('error', (err) => {
        console.log(`Backend health check error (attempt ${attempts}): ${err.message}`);
        retryWithBackoff();
      });
      
      req.on('timeout', () => {
        console.log(`Backend health check timeout (attempt ${attempts})`);
        req.destroy();
        retryWithBackoff();
      });
      
      req.end();
    };
    
    const retryWithBackoff = () => {
      const delay = baseDelay;
      console.log(`Backend not ready, retrying in ${delay}ms... (attempt ${attempts}/${maxAttempts})`);
      setTimeout(check, delay);
    };
    
    check();
  });
}
let isCreatingWindow = false;

async function createWindow() {
  if (isCreatingWindow) {
    console.log("⚠️ Window is already being created, skipping duplicate call");
    return;
  }

  if (mainWindow) {
    console.log("✅ Window already exists, focusing it");
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();
    return;
  }

  isCreatingWindow = true;

  try {
    console.log("🚀 Starting application initialization...");
    
    // Start backend server and wait for it to be ready
    console.log("🔧 Starting backend server...");
    await startBackendServer();

    console.log("🌐 Creating main window...");
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: true // Enable DevTools for debugging
      },
      icon: path.join(__dirname, 'public/favicon.ico') // Add app icon
    });

    const startURL = isDev
      ? "http://localhost:3000"
      : "http://localhost:5001";

    console.log("📡 Loading application at:", startURL);
    
    // Add error handling for URL loading
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error(`❌ Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log("✅ Page loaded successfully");
    });
    
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[Renderer] ${message}`);
    });
    
    await mainWindow.loadURL(startURL);

    mainWindow.once("ready-to-show", () => {
      console.log("✨ Application window ready!");
      mainWindow.show();
      isCreatingWindow = false;
    });

    mainWindow.on("close", (event) => {
      if (!isAppQuitting) {
        event.preventDefault();
        dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Yes', 'No'],
          title: 'Confirm',
          message: 'Are you sure you want to quit?'
        }).then((result) => {
          if (result.response === 0) {
            isAppQuitting = true;
            app.quit();
          }
        });
      }
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
      isCreatingWindow = false;
    });

  } catch (err) {
    console.error("Failed to start backend:", err.message);
    isCreatingWindow = false;
    
    // Don't immediately quit - let the user know what happened
    const choice = dialog.showMessageBoxSync(null, {
      type: 'error',
      buttons: ['Retry', 'Quit'],
      title: 'Backend Startup Failed',
      message: 'Failed to start the backend server.',
      detail: `Error: ${err.message}\n\nWould you like to retry or quit the application?`
    });
    
    if (choice === 0) { // Retry
      console.log("User chose to retry backend startup");
      setTimeout(() => {
        createWindow();
      }, 1000);
    } else { // Quit
      isAppQuitting = true;
      app.quit();
    }
  } finally {
    isCreatingWindow = false;
  }
}

app.whenReady().then(createWindow).catch((err) => {
  console.error("Error during app startup:", err);
  dialog.showErrorBox("Startup Error", "An error occurred during application startup.");
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isAppQuitting = true;
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  isAppQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});

process.on("SIGINT", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  app.quit();
});

process.on("SIGTERM", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  app.quit();
});
