# 🚀 Production Deployment Guide - BTS Inventory Management System

## Critical Bugs Fixed

### ✅ **CRITICAL BUG #1: Database Data Loss on Startup**
**Issue:** The application was dropping (deleting) all database tables on every startup!

**Lines affected:** `server.js` lines 1102-1106

**Before (DANGEROUS):**
```javascript
// First, drop existing tables if they exist
db.run("DROP TABLE IF EXISTS returns");
db.run("DROP TABLE IF EXISTS products");
db.run("DROP TABLE IF EXISTS users");
db.run("DROP TABLE IF EXISTS employee");
```

**After (FIXED):**
```javascript
// ⚠️ NEVER drop tables in production - this would delete all data!
// Tables are created with IF NOT EXISTS, so they're safe
```

**Impact:** This was causing ALL DATA to be deleted every time the app started. Now tables are created only if they don't exist, preserving all data.

---

### ✅ **CRITICAL BUG #2: Database Directory Not Created**
**Issue:** App crashed if database directory didn't exist.

**Fixed by:** Adding directory creation before database initialization

```javascript
// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✅ Created database directory:", dbDir);
}
```

---

### ✅ **CRITICAL BUG #3: Poor Error Messages in Production**
**Issue:** Users saw only blue screen with no helpful error information.

**Fixed by:**
- Enhanced error logging with detailed messages
- Better error dialogs for common issues (port conflicts, missing files)
- Comprehensive log file at `%APPDATA%/BTS-Inventory/backend-startup.log`

---

## 🏗️ Building for Production

### Prerequisites
1. **Node.js installed** on build machine (v18 or higher)
2. **All dependencies installed**: `npm install`
3. **React app must build successfully**: `npm run build`

### Build Steps

```powershell
# 1. Clean previous builds
npm run clean

# 2. Build the production installer
npm run dist
```

**What happens during build:**
1. React app is compiled to `build/` folder
2. Node.js executable is copied to `build/node.exe`
3. Resources (database, icons) are copied
4. Electron packages everything into `dist/BTS Inventory-Setup-1.0.0.exe`

### Build Output

After successful build, check `dist/` folder:
```
dist/
  BTS Inventory-Setup-1.0.0.exe  <-- Installer for deployment
  win-unpacked/                  <-- Unpacked app for testing
```

---

## 📦 Installation on School Computers

### Step 1: Run the Installer
1. Copy `BTS Inventory-Setup-1.0.0.exe` to target computer
2. **Right-click** → Run as Administrator (if needed)
3. Follow installation wizard:
   - Choose installation directory (default: `C:\Users\{username}\AppData\Local\Programs\BTS Inventory`)
   - Create desktop shortcut: ✅ **Recommended**
   - Create start menu shortcut: ✅ **Recommended**

### Step 2: First Launch
1. Launch the application from desktop shortcut or Start Menu
2. **First launch takes 10-15 seconds** (initializing database)
3. You should see the login screen (NOT a blue screen!)

### Step 3: Default Login Credentials
```
Username: Administrator
Password: password123
```

**⚠️ IMPORTANT:** Change the default password immediately after first login!

---

## 🔍 Troubleshooting Production Issues

### Problem: Blue Screen on Startup

**Possible Causes:**
1. Backend server failed to start
2. Port 5001 is already in use
3. Database initialization error
4. Missing dependencies

**Solution Steps:**

#### 1. Check the Log File
Location: `C:\Users\{username}\AppData\Roaming\BTS-Inventory\backend-startup.log`

```powershell
# View the log file
notepad %APPDATA%\BTS-Inventory\backend-startup.log
```

#### 2. Look for These Error Patterns

**Error: "EADDRINUSE" or "Port already in use"**
```
Solution:
1. Check if another instance is running (Task Manager → node.exe)
2. Kill all node.exe processes
3. Restart the application
```

**Error: "Cannot find module"**
```
Solution:
1. Application packaging is incomplete
2. Reinstall the application
3. If issue persists, rebuild from source
```

**Error: "ENOENT" or "database.sqlite"**
```
Solution:
1. Database directory is not writable
2. Check folder permissions
3. Try running as Administrator
```

**Error: "Database directory not created"**
```
Solution:
This should be fixed now, but if it occurs:
1. Manually create: C:\Users\{username}\AppData\Local\BTS-Inventory
2. Grant write permissions
3. Restart application
```

---

### Problem: Application Won't Start

**Check 1: Is Node.js Installed?**

The application bundles Node.js, but verify:

```powershell
# Open PowerShell and run:
node --version
```

If not installed, download from: https://nodejs.org/

**Check 2: Antivirus Blocking**

Some antivirus software blocks Node.js executables:
1. Add exception for `BTS Inventory` installation folder
2. Whitelist `node.exe` process

**Check 3: Port Conflicts**

```powershell
# Check what's using port 5001
netstat -ano | findstr :5001

# If something is using it, kill the process
taskkill /PID {process_id} /F
```

---

### Problem: Database Not Saving Data

**Symptoms:**
- Data disappears after restart
- Changes don't persist

**This WAS the critical bug - now fixed!**

If you're still experiencing this:
1. Verify you're running the **latest build** (after bug fix)
2. Check database file exists: `%APPDATA%\BTS-Inventory\resources\database.sqlite`
3. Check write permissions on that folder

---

## 🗂️ File Locations (Production)

### Application Files
```
C:\Users\{username}\AppData\Local\Programs\BTS Inventory\
  ├── BTS Inventory.exe      (Main executable)
  ├── resources/
  │   ├── app.asar           (Packaged application)
  │   └── app.asar.unpacked/ (Unpacked resources)
  │       ├── server.js      (Backend server)
  │       ├── build/
  │       │   ├── node.exe   (Node.js runtime)
  │       │   └── ...        (React app files)
  │       └── node_modules/  (Dependencies)
```

### User Data Files
```
C:\Users\{username}\AppData\Roaming\BTS-Inventory\
  ├── backend-startup.log       (Startup logs - CHECK THIS FIRST!)
  └── resources/
      └── database.sqlite       (SQLite database file)
```

**⚠️ BACKUP THIS FOLDER TO PRESERVE DATA!**

---

## 🔧 Advanced Configuration

### Change Database Location (Network Drive)

To use a shared database on a network drive:

1. Create environment variable before running:
```powershell
$env:NETWORK_DB_PATH = "Z:\Shared\BTS-Inventory\database.sqlite"
```

2. Or modify installation:
   - Create `resources/.env` file
   - Add: `NETWORK_DB_PATH=Z:\Shared\BTS-Inventory\database.sqlite`

**Important:** Network drive must be accessible and writable!

---

### Change Backend Port

Default: `5001`

To change:
1. Edit `server.js` line ~310: `const PORT = 5001;`
2. Edit `main.js` line ~221: `PORT: "5001",`
3. Rebuild application

---

## 📊 Monitoring & Maintenance

### Log File Locations

**Backend Startup Log:**
```
%APPDATA%\BTS-Inventory\backend-startup.log
```

**View recent logs:**
```powershell
Get-Content $env:APPDATA\BTS-Inventory\backend-startup.log -Tail 50
```

### Database Backup

**Manual Backup:**
```powershell
# Create backup folder
mkdir C:\BTS-Backups

# Copy database
copy %APPDATA%\BTS-Inventory\resources\database.sqlite C:\BTS-Backups\database-backup-{date}.sqlite
```

**Automated Backup Script:**
```powershell
# Save as backup-database.ps1
$source = "$env:APPDATA\BTS-Inventory\resources\database.sqlite"
$dest = "C:\BTS-Backups\database-backup-$(Get-Date -Format 'yyyy-MM-dd-HHmm').sqlite"
Copy-Item $source $dest -Force
Write-Host "✅ Database backed up to: $dest"
```

Run weekly via Task Scheduler!

---

## 🐛 Common Error Messages & Solutions

### "Backend startup timeout after 45 seconds"

**Causes:**
- Database corruption
- Insufficient permissions
- Disk space issues

**Solutions:**
1. Check log file
2. Verify disk space (>100MB free)
3. Run as Administrator
4. Restore from backup if database is corrupt

---

### "Failed to start backend server"

**Causes:**
- Missing node.exe
- Corrupted installation

**Solutions:**
1. Reinstall application
2. Verify Node.js installation
3. Check antivirus logs

---

### "Application is already running"

**This is normal!** - Single instance enforcement

If you need to close it:
1. Check system tray for app icon
2. Right-click → Quit
3. Or: Task Manager → End Task

---

## ✅ Pre-Deployment Checklist

Before deploying to school computers:

- [ ] Build completes without errors
- [ ] Installer runs on test machine
- [ ] Application launches successfully (no blue screen)
- [ ] Can login with default credentials
- [ ] Can add/edit/delete products
- [ ] Can add/edit/delete returns
- [ ] Data persists after restart
- [ ] Export to PDF works
- [ ] Export to Excel works
- [ ] Multiple users can login
- [ ] Log file is created and readable

---

## 🆘 Emergency Recovery

### If Everything Breaks

1. **Uninstall the application**
   ```powershell
   # Via Settings → Apps → BTS Inventory → Uninstall
   ```

2. **Delete user data** (if needed)
   ```powershell
   Remove-Item -Recurse -Force "$env:APPDATA\BTS-Inventory"
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Programs\BTS Inventory"
   ```

3. **Reinstall fresh**
   - Run installer again
   - Restore database from backup if needed

---

## 📞 Support Information

### Log Collection for Support

If you need help, collect these files:

1. **Startup Log:**
   ```powershell
   copy %APPDATA%\BTS-Inventory\backend-startup.log Desktop\
   ```

2. **System Info:**
   ```powershell
   systeminfo > Desktop\systeminfo.txt
   node --version > Desktop\node-version.txt
   ```

3. **Port Status:**
   ```powershell
   netstat -ano > Desktop\ports.txt
   ```

Send these files for troubleshooting.

---

## 🎓 Deployment Best Practices

### For School Environment

1. **Test on one computer first**
   - Install on teacher/admin machine
   - Test for 1-2 days
   - Verify data persistence

2. **Create master installation**
   - Install on reference machine
   - Configure settings
   - Export configuration

3. **Deploy to all machines**
   - Use Group Policy for mass deployment (if available)
   - Or manually install on each machine

4. **Setup daily backups**
   - Schedule backup script
   - Store on network drive or cloud

5. **Train users**
   - Provide user manual
   - Demonstrate basic functions
   - Explain error messages

---

## 🔐 Security Recommendations

1. **Change default admin password immediately**
2. **Create individual user accounts** (don't share admin)
3. **Regular backups** (daily or weekly)
4. **Restrict admin access** to authorized personnel only
5. **Monitor activity logs** for unauthorized changes

---

## 📝 Version History

### v1.0.0 (Current)
- ✅ Fixed critical database drop bug
- ✅ Added database directory creation
- ✅ Enhanced error logging
- ✅ Improved production error messages
- ✅ Added comprehensive deployment guide

---

## 🚀 Quick Start Summary

```powershell
# 1. Build
npm run dist

# 2. Copy installer to target machine
# dist/BTS Inventory-Setup-1.0.0.exe

# 3. Install and run
# Double-click installer → Follow wizard → Launch

# 4. Login
# Username: Administrator
# Password: password123

# 5. If issues occur, check log:
notepad %APPDATA%\BTS-Inventory\backend-startup.log
```

---

**✨ The application is now ready for production deployment!**

All critical bugs have been fixed, and the system includes comprehensive error handling and logging for troubleshooting.
