# 🔧 PRODUCTION DEPLOYMENT - BACKEND CRASH FIX

## ⚠️ Critical Issues Fixed

This document details the **5 critical production issues** that caused backend crashes and their solutions.

---

## 🐛 Root Causes Identified

### 1. **Node.exe Path Resolution Failure** ❌
**Problem:** Electron couldn't find the bundled `node.exe` in production
- Search paths were incomplete
- Didn't check `app.asar.unpacked/build/node.exe` correctly
- No validation of file size

**Fix Applied:**
- Improved path search algorithm with 11 fallback locations
- Added server.js directory-relative paths
- Added file size validation in `copy-node.js`

### 2. **Database Path Resolution Failure** ❌
**Problem:** Backend couldn't access database in production
- `RESOURCES_PATH` environment variable not properly passed
- No write permission testing
- Insufficient fallback logic

**Fix Applied:**
- 7 prioritized database path options
- Write permission testing before selection
- Better environment variable passing from main.js
- Detailed logging of path attempts

### 3. **Silent Backend Crashes** ❌
**Problem:** Backend crashed without reporting to Electron
- No global exception handlers
- Stdout buffering prevented startup signals
- No crash recovery mechanism

**Fix Applied:**
- Added `uncaughtException` and `unhandledRejection` handlers
- Redundant startup signals (console.log + process.stdout.write)
- Force stdout/stderr flushing on Windows
- Delayed secondary startup signal

### 4. **Build Path Detection Failure** ❌
**Problem:** Server.js couldn't find React static files
- Limited search paths
- No validation of `index.html` existence
- Silent failures

**Fix Applied:**
- Enhanced path detection with 6 search locations
- Validation of build folder contents
- Graceful degradation if build not found
- Better environment variable usage

### 5. **Poor Error Visibility** ❌
**Problem:** Production errors were invisible to users
- Console window hidden in production
- Log file location unclear
- No user-friendly error dialogs

**Fix Applied:**
- Always show console window (`windowsHide: false`)
- Error dialogs with log file paths
- Comprehensive logging to `backend-startup.log`
- Structured error output with separators

---

## 📝 Files Modified

### 1. `main.js` - Electron Main Process
**Changes:**
- ✅ Improved node.exe path resolution (11 search locations)
- ✅ Better environment variable configuration
- ✅ Enhanced error dialogs with log file paths
- ✅ Always show console for debugging (`windowsHide: false`)
- ✅ Added shell: false for direct execution reliability

### 2. `server.js` - Backend Server
**Changes:**
- ✅ Added global exception handlers (uncaught/unhandled)
- ✅ Enhanced database path resolution (7 prioritized paths)
- ✅ Write permission testing before database selection
- ✅ Improved build path detection with validation
- ✅ Redundant startup signals with forced flushing
- ✅ Better error logging with structured output

### 3. `copy-node.js` - Build Script
**Changes:**
- ✅ Added file size validation for node.exe
- ✅ Warning for suspiciously small files
- ✅ Better error messages

### 4. `validate-production-build.js` - NEW FILE
**Purpose:**
- ✅ Pre-build validation script
- ✅ Checks all critical files and configurations
- ✅ Verifies package.json settings
- ✅ Tests node.exe bundling

---

## 🚀 How to Build & Deploy

### Step 1: Validate Before Building
```powershell
node validate-production-build.js
```

Expected output: ✅ ALL CHECKS PASSED

### Step 2: Build Production Package
```powershell
npm run build-production
```

This will:
1. Build React app → `build/`
2. Copy node.exe → `build/node.exe`
3. Copy resources → `build/resources/`
4. Create installer → `dist/`

### Step 3: Test the Installer
1. Navigate to `dist/` folder
2. Run `BTS Inventory-Setup-1.0.0.exe`
3. Install to a test location
4. **IMPORTANT:** Watch for console window during startup

### Step 4: Verify Backend Starts
When app opens, you should see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SERVER READY AND LISTENING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server URL: http://localhost:5001
📊 Environment: production
📁 Database: C:\Users\...\database.sqlite
🔗 WebSocket: ws://localhost:5001/ws
📂 Build Path: C:\...\build
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVER_READY:5001
```

### Step 5: Check Logs if Issues Occur
Log file location:
```
C:\Users\<USERNAME>\AppData\Roaming\BTS Inventory\backend-startup.log
```

---

## 🔍 Troubleshooting Production Issues

### Issue: "Node.js executable not found"
**Diagnosis:**
- Check if `node.exe` exists in `build/` folder before packaging
- Run `node validate-production-build.js`

**Fix:**
```powershell
# Ensure Node.js is installed
node --version

# Rebuild
npm run build
npm run build-production
```

### Issue: "Database directory creation failed"
**Diagnosis:**
- Write permission issues
- Check `backend-startup.log`

**Fix:**
1. Run app as Administrator (first time only)
2. Or manually create: `%LOCALAPPDATA%\BTS-Inventory\`

### Issue: "Build directory not found"
**Diagnosis:**
- Static files not served
- React app doesn't load

**Fix:**
```powershell
# Ensure build exists
npm run build

# Check package.json extraResources
# Should include build/**/*
```

### Issue: Backend crashes immediately
**Diagnosis:**
- Check console window (now always visible)
- Check `backend-startup.log`

**Common causes:**
1. Port 5001 already in use → Close other instances
2. Missing dependencies → Reinstall
3. Database permissions → Run as admin once

---

## 📊 Environment Variables Passed to Backend

The following environment variables are now properly passed from Electron to Node.js backend:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend server port | `5001` |
| `RESOURCES_PATH` | Database location | `C:\...\resources` |
| `BUILD_PATH` | React static files | `C:\...\build` |
| `APP_ROOT` | Application root directory | `C:\...\app` |
| `IS_PACKAGED` | Packaging status | `true` |
| `PROCESS_RESOURCES_PATH` | process.resourcesPath | `C:\...\resources` |

---

## ✅ Success Indicators

### Backend Started Successfully
- Console window shows: `🚀 SERVER READY AND LISTENING`
- No error dialogs appear
- Application window opens with login screen
- Port 5001 is listening

### Database Working
- Database file created at reported path
- Tables initialized
- Login works (default admin/supervisor accounts)

### Static Files Served
- Application UI loads correctly
- No 404 errors in console
- Glassmorphism styling visible

---

## 🎯 Key Improvements Summary

| Area | Before | After |
|------|--------|-------|
| **Node.exe Detection** | 5 paths, no validation | 11 paths, size validation |
| **Database Paths** | 5 paths, no testing | 7 paths, write permission test |
| **Error Visibility** | Hidden console, no logs | Always visible, detailed logs |
| **Startup Signal** | Single write, buffered | Redundant signals, forced flush |
| **Exception Handling** | None | Global handlers with exit |
| **Build Validation** | Manual checks | Automated validation script |
| **Environment Vars** | 3 variables | 7 variables with validation |

---

## 📞 Support Information

### If Backend Still Crashes:

1. **Collect Log File:**
   ```
   %APPDATA%\BTS Inventory\backend-startup.log
   ```

2. **Check Console Output:**
   - Look for red ❌ error messages
   - Note the last successful step
   - Check for "FATAL" or "CRITICAL" errors

3. **Common Error Patterns:**
   - `EADDRINUSE` → Another instance running
   - `ENOENT` → File not found (missing build files)
   - `EACCES` → Permission denied (database directory)
   - `Cannot find module` → Missing dependencies

4. **Emergency Fixes:**
   ```powershell
   # Kill all Node processes
   taskkill /F /IM node.exe
   
   # Reinstall app
   # (Uninstall via Control Panel first)
   ```

---

## 🔄 Development vs Production Differences

| Aspect | Development | Production |
|--------|-------------|------------|
| **Node.js** | System installation | Bundled in build/ |
| **Server Start** | `npm run start-server` | Spawned by Electron |
| **Database** | `./resources/` | AppData/Local |
| **Static Files** | React dev server (3000) | Served by Express |
| **Logs** | Console only | Console + log file |
| **Error Handling** | Development errors | User-friendly dialogs |

---

## 📝 Testing Checklist

Before deploying to production:

- [ ] Run `node validate-production-build.js` → All checks pass
- [ ] Build completes without errors
- [ ] Installer creates successfully in `dist/`
- [ ] Install on clean test machine
- [ ] Backend console window appears
- [ ] See "SERVER READY" message
- [ ] Login screen loads
- [ ] Can login as admin/supervisor
- [ ] Can add products/employees
- [ ] Database persists after restart
- [ ] WebSocket connections work
- [ ] PDF/Excel exports function
- [ ] No crashes after 5 minutes of use

---

## 🎉 Deployment Complete!

Your inventory system should now:
- ✅ Start reliably in production
- ✅ Show clear error messages if issues occur
- ✅ Create database in accessible location
- ✅ Handle node.exe bundling correctly
- ✅ Serve React frontend properly
- ✅ Log all startup steps for debugging

**Questions?** Check `backend-startup.log` first!
