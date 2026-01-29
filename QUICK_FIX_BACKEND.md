# 🚨 QUICK FIX - Backend Crashes in Production

## Immediate Diagnosis (30 seconds)

### 1. Check Console Window
Production build now **always shows console**. Look for:

```
✅ GOOD:
🚀 SERVER READY AND LISTENING
SERVER_READY:5001

❌ BAD:
❌ Node.js executable not found
❌ Failed to create database directory
❌ Build directory not found
❌ Port 5001 is already in use
```

### 2. Check Log File
Location: `C:\Users\<USERNAME>\AppData\Roaming\BTS Inventory\backend-startup.log`

Quick access:
```powershell
# Copy this to Run dialog (Win+R):
%APPDATA%\BTS Inventory\backend-startup.log
```

---

## Common Errors & Instant Fixes

### Error: "Node.js executable not found"
**Cause:** node.exe not bundled or path wrong

**Fix:**
```powershell
# 1. Rebuild with validation
node validate-production-build.js
npm run build-production

# 2. Check if node.exe exists in build folder
dir build\node.exe
```

---

### Error: "Port 5001 is already in use"
**Cause:** Another instance running

**Fix:**
```powershell
# Kill all Node processes
taskkill /F /IM node.exe

# Or restart computer
shutdown /r /t 0
```

---

### Error: "Database directory creation failed"
**Cause:** No write permissions

**Fix:**
```powershell
# Run as Administrator (right-click → Run as administrator)
# Or manually create directory:
mkdir "%LOCALAPPDATA%\BTS-Inventory"
```

---

### Error: "Build directory not found"
**Cause:** React app not built or not packaged

**Fix:**
```powershell
# Rebuild React app
npm run build

# Verify build exists
dir build\index.html

# Rebuild production
npm run build-production
```

---

### Error: Silent crash (no error message)
**Cause:** Exception before logging initialized

**Fix:**
```powershell
# Check Windows Event Viewer
eventvwr.msc
# Navigate to: Windows Logs → Application
# Look for errors from "Node.js" or "Electron"

# Or run from command line:
cd "C:\Program Files\BTS Inventory"
.\BTS Inventory.exe
# (Watch console output)
```

---

## Pre-Deployment Checklist

```powershell
# Run validation script
node validate-production-build.js
```

Must see: `✅ ALL CHECKS PASSED`

**Critical files to verify:**
- [ ] `build/index.html` exists
- [ ] `build/node.exe` exists (15-20 MB)
- [ ] `build/static/` folder exists
- [ ] `main.js` exists
- [ ] `server.js` exists

---

## Emergency Recovery

### If app won't start at all:

```powershell
# 1. Uninstall completely
# Control Panel → Programs → BTS Inventory → Uninstall

# 2. Clean app data
rmdir /S "%APPDATA%\BTS Inventory"
rmdir /S "%LOCALAPPDATA%\BTS-Inventory"

# 3. Kill any remaining processes
taskkill /F /IM "BTS Inventory.exe"
taskkill /F /IM node.exe

# 4. Rebuild from source
cd C:\path\to\source
npm install
npm run build
npm run build-production

# 5. Reinstall from dist/
```

---

## Testing After Fix

### 1. Install Test
```powershell
# Install to: C:\Test\BTS Inventory
# (Use non-Program Files location for testing)
```

### 2. Watch Console
- Should see: "🚀 SERVER READY AND LISTENING"
- Within 10-15 seconds

### 3. Check Functionality
- [ ] Login screen loads
- [ ] Can login as admin (default: admin/admin123)
- [ ] Dashboard shows
- [ ] Add product works
- [ ] Database file created at: `%LOCALAPPDATA%\BTS-Inventory\database.sqlite`

---

## Log File Analysis

### Good startup log:
```
[timestamp] Is Dev: false
[timestamp] Is Packaged: true
[timestamp] ✅ Found server.js at: ...
[timestamp] ✅ Found Node.js at: ...\build\node.exe
[timestamp] [BACKEND] 🚀 SERVER STARTING
[timestamp] [BACKEND] ✅ Using database path: ...
[timestamp] [BACKEND] ✅ Connected to database
[timestamp] [BACKEND] SERVER_READY:5001
[timestamp] ✅ Backend server started successfully!
```

### Bad startup log:
```
[timestamp] ❌ Could not find node.exe!
[timestamp] Node.js executable not found
```
**Fix:** Rebuild, ensure node.exe copied

```
[timestamp] [BACKEND ERROR] EADDRINUSE
```
**Fix:** Kill existing node.exe processes

```
[timestamp] [BACKEND ERROR] Cannot find module 'express'
```
**Fix:** Dependencies not packaged. Check asarUnpack in package.json

---

## Contact Support

If still failing after all fixes:

**Provide:**
1. Full `backend-startup.log` content
2. Console window screenshot
3. Installation path
4. Windows version
5. Steps that led to crash

**Send to:** [Your support contact]

---

## Build Configuration Verification

Quick check of `package.json`:

```json
{
  "build": {
    "asar": true,
    "asarUnpack": [
      "node_modules/sqlite3/**/*",
      "server.js",
      "resources/**/*",
      "build/node.exe",
      "node_modules/**/*"
    ]
  }
}
```

**Critical:**
- `asar: true` ✅
- `asarUnpack` includes `server.js` ✅
- `asarUnpack` includes `sqlite3` ✅
- `asarUnpack` includes `node_modules` ✅

---

## One-Line Fixes

```powershell
# Rebuild everything
npm run build && npm run build-production

# Validate before build
node validate-production-build.js && npm run build-production

# Clean build
rmdir /S dist build node_modules\.cache && npm run build-production

# Emergency cleanup
taskkill /F /IM node.exe && taskkill /F /IM "BTS Inventory.exe"
```

---

## Success Indicators

### Console Output:
```
🚀 SERVER READY AND LISTENING
🌐 Server URL: http://localhost:5001
📁 Database: C:\Users\...\AppData\Local\BTS-Inventory\database.sqlite
```

### Application Window:
- BTS Inventory Management System login screen
- No error dialogs
- Responsive UI

### Process:
- One "BTS Inventory.exe" in Task Manager
- One "node.exe" as child process

---

## Version Info

**Fixed Version:** 1.0.0 (with backend crash fixes)
**Fix Date:** [Current Date]
**Files Modified:** main.js, server.js, copy-node.js
**New Files:** validate-production-build.js

---

## Quick Decision Tree

```
Backend won't start?
  │
  ├─ No console window appears?
  │   └─ Check if app installed correctly
  │       └─ Reinstall from dist/
  │
  ├─ Console shows "Node.js not found"?
  │   └─ Run: node validate-production-build.js
  │       └─ Check build/node.exe exists
  │
  ├─ Console shows "Port in use"?
  │   └─ Run: taskkill /F /IM node.exe
  │
  ├─ Console shows "Database error"?
  │   └─ Run as Administrator once
  │
  └─ Console shows nothing (blank)?
      └─ Check: %APPDATA%\BTS Inventory\backend-startup.log
```

---

**Remember:** Production builds now show console for debugging!
