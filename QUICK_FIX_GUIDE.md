# 🔧 Quick Fix Reference Card - BTS Inventory System

## 🆘 Emergency Quick Fixes

### Problem: Blue Screen on Startup

**Quick Fix:**
```powershell
# 1. Check the log
notepad %APPDATA%\BTS-Inventory\backend-startup.log

# 2. Look for error type (see below)
```

---

### Error: "Port 5001 already in use"

**Fix:**
```powershell
# Option 1: Kill the process
taskkill /F /IM node.exe

# Option 2: Find specific process
netstat -ano | findstr :5001
# Then: taskkill /F /PID {number}

# Option 3: Restart computer
```

---

### Error: "Database error" or "SQLITE_CANTOPEN"

**Fix:**
```powershell
# 1. Create directory manually
mkdir "$env:APPDATA\BTS-Inventory\resources"

# 2. Set permissions
icacls "$env:APPDATA\BTS-Inventory" /grant Users:F /t

# 3. Restart app
```

---

### Error: "Backend timeout" or "Not responding"

**Fix:**
```powershell
# 1. Increase timeout (in emergency)
# Edit main.js line ~311: Change 45000 to 60000

# 2. Check disk space
# Ensure C: drive has at least 100MB free

# 3. Run as Administrator
# Right-click → Run as Administrator
```

---

### Error: "Cannot find module"

**Fix:**
```
1. Uninstall completely
2. Delete: C:\Users\{username}\AppData\Local\Programs\BTS Inventory
3. Delete: C:\Users\{username}\AppData\Roaming\BTS-Inventory
4. Reinstall from fresh installer
```

---

## 🗂️ Important File Locations

| What | Where |
|------|-------|
| **Log File** | `%APPDATA%\BTS-Inventory\backend-startup.log` |
| **Database** | `%APPDATA%\BTS-Inventory\resources\database.sqlite` |
| **App Files** | `%LOCALAPPDATA%\Programs\BTS Inventory\` |
| **Installer** | `dist\BTS Inventory-Setup-1.0.0.exe` |

---

## 🔑 Default Credentials

```
Username: Administrator
Password: password123
```

**⚠️ Change this immediately after first login!**

---

## 📊 Health Check Commands

```powershell
# Check if Node.js is available
node --version

# Check if port is free
netstat -ano | findstr :5001

# Check disk space
Get-PSDrive C | Select-Object Used,Free

# View recent logs
Get-Content $env:APPDATA\BTS-Inventory\backend-startup.log -Tail 20

# Check if app is running
Get-Process -Name "BTS Inventory" -ErrorAction SilentlyContinue
```

---

## 🔄 Common Restart Procedures

### Clean Restart
```powershell
# 1. Close app gracefully
# File → Exit (or close window)

# 2. Verify closed
tasklist | findstr node.exe

# 3. If still running, force kill
taskkill /F /IM node.exe

# 4. Restart app
```

### Full Reset (Nuclear Option)
```powershell
# 1. Close app
taskkill /F /IM "BTS Inventory.exe"
taskkill /F /IM node.exe

# 2. Clear cache (keeps data)
Remove-Item "$env:APPDATA\BTS-Inventory\*.log" -Force

# 3. Restart
# Launch from desktop shortcut
```

---

## 💾 Quick Backup

```powershell
# Create backup NOW
$backup = "C:\BTS-Backups\db-$(Get-Date -Format 'yyyyMMdd-HHmm').sqlite"
mkdir C:\BTS-Backups -Force
copy "$env:APPDATA\BTS-Inventory\resources\database.sqlite" $backup
Write-Host "✅ Backup saved: $backup"
```

---

## 🔍 Quick Diagnostics

Run this to check system health:

```powershell
Write-Host "=== BTS Inventory Diagnostics ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Node.js: " -NoNewline
try { 
    $nodeVer = node --version
    Write-Host "✅ $nodeVer" -ForegroundColor Green
} catch { 
    Write-Host "❌ Not found" -ForegroundColor Red
}

# Check database file
Write-Host "Database: " -NoNewline
if (Test-Path "$env:APPDATA\BTS-Inventory\resources\database.sqlite") {
    $size = (Get-Item "$env:APPDATA\BTS-Inventory\resources\database.sqlite").Length / 1KB
    Write-Host "✅ Exists ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "❌ Not found" -ForegroundColor Red
}

# Check log file
Write-Host "Log file: " -NoNewline
if (Test-Path "$env:APPDATA\BTS-Inventory\backend-startup.log") {
    Write-Host "✅ Exists" -ForegroundColor Green
    Write-Host "  Recent errors:" -ForegroundColor Yellow
    Get-Content "$env:APPDATA\BTS-Inventory\backend-startup.log" -Tail 5 | Where-Object { $_ -match "ERROR|❌|CRITICAL" }
} else {
    Write-Host "⚠️ Not found (app never launched)" -ForegroundColor Yellow
}

# Check if running
Write-Host "App status: " -NoNewline
$running = Get-Process -Name "BTS Inventory" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "✅ Running (PID: $($running.Id))" -ForegroundColor Green
} else {
    Write-Host "⚠️ Not running" -ForegroundColor Yellow
}

# Check port
Write-Host "Port 5001: " -NoNewline
$port = netstat -ano | findstr :5001
if ($port) {
    Write-Host "⚠️ In use" -ForegroundColor Yellow
} else {
    Write-Host "✅ Available" -ForegroundColor Green
}

# Check disk space
Write-Host "Disk space: " -NoNewline
$drive = Get-PSDrive C
$freeGB = [math]::Round($drive.Free / 1GB, 2)
if ($freeGB -gt 1) {
    Write-Host "✅ $freeGB GB free" -ForegroundColor Green
} else {
    Write-Host "⚠️ Only $freeGB GB free" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== End Diagnostics ===" -ForegroundColor Cyan
```

Save as `diagnose.ps1` and run before reporting issues!

---

## 🚨 When to Reinstall

Reinstall if you see:
- [ ] "Cannot find module" errors repeatedly
- [ ] Database corruption messages
- [ ] App crashes immediately on every launch
- [ ] After trying all fixes above with no success

**Steps:**
1. Backup database first!
2. Uninstall via Settings → Apps
3. Delete `%APPDATA%\BTS-Inventory`
4. Reinstall from fresh installer
5. Restore database backup

---

## 📞 Support Checklist

Before asking for help, collect:

1. ✅ Log file: `%APPDATA%\BTS-Inventory\backend-startup.log`
2. ✅ Screenshot of error
3. ✅ Output of diagnostic script (above)
4. ✅ When did it last work?
5. ✅ What changed? (new software, updates, etc.)

---

## ⚡ Performance Tips

### If app is slow:
1. Check database size (should be < 100MB)
2. Clear old logs: `del %APPDATA%\BTS-Inventory\*.log`
3. Restart computer (clears memory)
4. Close other programs (especially browsers)

### If startup is slow:
1. Disable antivirus temporarily (for testing)
2. Check disk for errors: `chkdsk C: /f`
3. Ensure SSD has TRIM enabled

---

## 🎯 Most Common Issues (90% of problems)

| Issue | Fix |
|-------|-----|
| Blue screen | Check log file → Port conflict or database error |
| Port in use | `taskkill /F /IM node.exe` |
| Data not saving | THIS WAS THE BUG - Update to latest version! |
| Can't login | Use: `Administrator` / `password123` |
| Slow startup | Normal first time (10-15 sec), restart if > 30 sec |

---

**🔗 Full Guide:** See `PRODUCTION_DEPLOYMENT_GUIDE.md` for comprehensive documentation.
