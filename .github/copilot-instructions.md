# BTS Inventory Management System - AI Coding Instructions

## Architecture Overview

**Electron Desktop App** with React frontend + Express backend + SQLite database
- **Frontend**: React 18.2 (`src/`) with React Router for navigation
- **Backend**: Express server (`server.js`) running on port 5001
- **Electron**: Main process (`main.js`) spawns backend and manages app lifecycle
- **Database**: SQLite with WAL mode (`resources/database.sqlite`)
- **Real-time**: WebSocket server at `ws://localhost:5001/ws` for live updates

### Critical Dual-Environment Handling

The app runs in **two distinct modes** with different path resolution:
- **Development**: Standard Node.js paths (`__dirname`, `process.cwd()`)
- **Production**: Electron packaged with `app.asar`, uses `process.resourcesPath`

**Key pattern in `main.js` and `server.js`**:
```javascript
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
// Production paths check multiple locations due to asar unpacking
const possiblePaths = [
  path.join(process.resourcesPath, "app.asar.unpacked", "build"),
  path.join(process.resourcesPath, "build"),
  // ... fallbacks
];
```

## Role-Based Access Control

Three distinct user roles with different UI components and permissions:

### Admin (`AdminPanel.js`)
- Full CRUD on products, employees, users
- Access to activity logs
- User management (create supervisors/admins)
- Employee management with password setup

### Supervisor (`SupervisorPanel.js`)
- View-only dashboard with analytics
- View all articles/returns (no delete)
- Generate reports (PDF/Excel)
- Navigate between: Dashboard, Articles, Receipts, Reports

### Employee (`EmployeePanel.js`)
- Add articles assigned to themselves
- Add returns for their items
- View their receipts
- Login via employee ID only (no password required initially)

**Authentication patterns**:
- Admins/Supervisors: POST `/login` with `{name, password}`
- Employees: POST `/employee-login` with `{employeeId}` (auto-creates user account)

## Data Model & Foreign Keys

```
employee (id, name, employee_id, position, department, email, contact_number, address)
  ↓ FK_employee
users (id, name, role, password, FK_employee)
  ↓ created_by
products (id, article, description, date_acquired, property_number, unit, unit_value, 
         balance_per_card, on_hand_per_count, total_amount, FK_employee, remarks)
  ↓ created_by
returns (id, article, property_number, quantity, date, end_user, returned_by_name, 
        received_by, created_by, ...)
```

**Critical**: `products.FK_employee` and `users.FK_employee` both reference `employee.id`. When adding products, **always** look up employee by name first to get the ID.

## API Patterns

All frontend components use:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
axios.get(`${API_BASE_URL}/get-products/all`)
```

**Key endpoints**:
- `/login` - Admin/Supervisor login with bcrypt password check
- `/employee-login` - Employee login by ID (creates user if not exists)
- `/get-products/all` - Admin view
- `/api/products/all` - Supervisor view (includes employee joins)
- `/add-product` - Requires employee lookup first
- `/add-return` - Links to creator via `created_by`
- `/export-products/{format}` - Generate PDF/Excel reports

**WebSocket broadcasting**: After mutations, server calls `global.broadcast(eventType, data)` to notify connected clients.

## Development Workflow

### Running Locally
```powershell
npm run dev  # Runs server.js and React concurrently
```
- Backend: http://localhost:5001
- Frontend: http://localhost:3000 (proxies API to 5001)
- React dev server sets `BROWSER=none` to prevent auto-open

### Building for Production
```powershell
npm run build-production  # Or run build-production.bat
```
1. Builds React app to `build/`
2. Copies `node.exe` to `build/` for backend spawning
3. Runs `electron-builder` to create installer in `dist/`

**Packaging quirks**:
- `asar: true` but `asarUnpack: ["node_modules/sqlite3/**/*", "server.js", "resources/**/*"]`
- `main.js` searches for `node.exe` in `app.asar.unpacked/build/node.exe` (bundled copy)
- Database path resolution tries `resources/` in multiple locations

## UI/UX Conventions

**Glassmorphism styling** across all components:
```css
background: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(10px);
border-radius: 20px;
box-shadow: 0 8px 32px rgba(30, 60, 114, 0.1);
```

**Component structure**:
- Panel components have top navigation buttons (e.g., `SupervisorPanel.js` switches views via state)
- Forms use controlled components with `useState` for all inputs
- Tables are styled with hover effects and gradient headers
- Icons from Font Awesome (`<i className="fas fa-*">`)

## Common Pitfalls

1. **Employee lookup before product creation**: Always `db.get("SELECT id FROM employee WHERE name = ?")` before inserting products
2. **Path resolution in production**: Never assume `__dirname` works; use the multi-path fallback pattern
3. **Single instance enforcement**: `main.js` uses `app.requestSingleInstanceLock()` to prevent multiple instances
4. **Backend startup detection**: Electron waits for `SERVER_READY:5001\n` on stdout before loading window
5. **Cache invalidation**: Server has custom cache (Map-based) that needs manual `.invalidate(pattern)` after mutations
6. **Role checking**: Routes in `App.js` use `Navigate` to redirect unauthorized roles

## Caching & Performance

Simple in-memory cache in `server.js`:
```javascript
cache.set(key, value, ttl);  // Default 60s TTL
cache.invalidate('products'); // Clear after mutations
```
Use `cacheMiddleware(ttl)` for GET endpoints, but **always invalidate** on POST/PUT/DELETE.

## Testing & Debugging

- Health check: GET `/ping` returns `{status: 'ok'}`
- Backend logs to `app.getPath('userData')/backend-startup.log` in production
- React DevTools work in dev mode (`npm run dev`)
- Database file: `resources/database.sqlite` (dev) or resolved path (prod)

## Network Database Support

Optional shared database on network drive:
```javascript
// In server.js getDatabasePath()
const networkDbPath = process.env.NETWORK_DB_PATH;
if (networkDbPath && fs.existsSync(path.dirname(networkDbPath))) {
  return networkDbPath;
}
```
Set via `.env.production` for multi-PC deployments.
