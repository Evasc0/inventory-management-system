/**
 * Production Build Validator
 * 
 * Run this script AFTER building to verify all production requirements are met
 * Usage: node validate-production-build.js
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('═'.repeat(80));
console.log('   PRODUCTION BUILD VALIDATION');
console.log('═'.repeat(80));
console.log('');

let allChecksPassed = true;

function check(description, condition, details = null) {
  const status = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${description}`);
  if (details) {
    console.log(`         ${details}`);
  }
  if (!condition) {
    allChecksPassed = false;
  }
  return condition;
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  check(description, exists, exists ? `Found at: ${filePath}` : `Missing: ${filePath}`);
  return exists;
}

function checkFileSize(filePath, minSizeMB, description) {
  if (!fs.existsSync(filePath)) {
    check(description, false, `File not found: ${filePath}`);
    return false;
  }
  const stats = fs.statSync(filePath);
  const sizeMB = stats.size / 1024 / 1024;
  const passed = sizeMB >= minSizeMB;
  check(description, passed, `Size: ${sizeMB.toFixed(2)} MB (min: ${minSizeMB} MB)`);
  return passed;
}

console.log('━'.repeat(80));
console.log('1. CRITICAL FILES');
console.log('━'.repeat(80));

checkFileExists(path.join(__dirname, 'build', 'index.html'), 'React app built');
checkFileExists(path.join(__dirname, 'build', 'static'), 'Static assets folder exists');
checkFileExists(path.join(__dirname, 'main.js'), 'Electron main process exists');
checkFileExists(path.join(__dirname, 'server.js'), 'Backend server exists');
checkFileExists(path.join(__dirname, 'package.json'), 'Package.json exists');

console.log('');
console.log('━'.repeat(80));
console.log('2. NODE.JS RUNTIME');
console.log('━'.repeat(80));

const nodeExePath = path.join(__dirname, 'build', 'node.exe');
if (checkFileExists(nodeExePath, 'Node.exe bundled in build folder')) {
  checkFileSize(nodeExePath, 10, 'Node.exe has valid size');
}

console.log('');
console.log('━'.repeat(80));
console.log('3. DATABASE & RESOURCES');
console.log('━'.repeat(80));

const resourcesDir = path.join(__dirname, 'resources');
if (checkFileExists(resourcesDir, 'Resources directory exists')) {
  const dbFile = path.join(resourcesDir, 'database.sqlite');
  if (fs.existsSync(dbFile)) {
    check('Development database exists', true, `Size: ${(fs.statSync(dbFile).size / 1024).toFixed(2)} KB`);
  } else {
    check('Development database', true, 'Will be created on first run');
  }
}

console.log('');
console.log('━'.repeat(80));
console.log('4. PACKAGE.JSON CONFIGURATION');
console.log('━'.repeat(80));

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

check('Main entry point correct', packageJson.main === 'main.js', `main: ${packageJson.main}`);
check('Electron in dependencies', !!packageJson.devDependencies?.electron, `version: ${packageJson.devDependencies?.electron || 'NOT FOUND'}`);
check('SQLite3 in dependencies', !!packageJson.dependencies?.sqlite3, `version: ${packageJson.dependencies?.sqlite3 || 'NOT FOUND'}`);

if (packageJson.build) {
  check('asar packaging enabled', packageJson.build.asar === true);
  check('asarUnpack configured', Array.isArray(packageJson.build.asarUnpack) && packageJson.build.asarUnpack.length > 0);
  
  const hasServerUnpack = packageJson.build.asarUnpack?.includes('server.js');
  const hasSqliteUnpack = packageJson.build.asarUnpack?.some(p => p.includes('sqlite3'));
  const hasNodeModulesUnpack = packageJson.build.asarUnpack?.some(p => p.includes('node_modules'));
  
  check('server.js in asarUnpack', hasServerUnpack);
  check('sqlite3 in asarUnpack', hasSqliteUnpack);
  check('node_modules in asarUnpack', hasNodeModulesUnpack);
} else {
  check('Build configuration exists', false, 'package.json missing "build" section');
}

console.log('');
console.log('━'.repeat(80));
console.log('5. ENVIRONMENT VARIABLES CHECK');
console.log('━'.repeat(80));

// Check main.js for proper environment variable passing
const mainJsContent = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
check('main.js passes RESOURCES_PATH', mainJsContent.includes('RESOURCES_PATH'));
check('main.js passes BUILD_PATH', mainJsContent.includes('BUILD_PATH'));
check('main.js has node.exe search logic', mainJsContent.includes('possibleNodePaths'));

// Check server.js for proper environment variable usage
const serverJsContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
check('server.js reads RESOURCES_PATH', serverJsContent.includes('process.env.RESOURCES_PATH'));
check('server.js reads BUILD_PATH', serverJsContent.includes('process.env.BUILD_PATH'));
check('server.js has startup signal', serverJsContent.includes('SERVER_READY'));

console.log('');
console.log('━'.repeat(80));
console.log('6. DEPENDENCIES CHECK');
console.log('━'.repeat(80));

const nodeModulesExists = fs.existsSync(path.join(__dirname, 'node_modules'));
check('node_modules directory exists', nodeModulesExists);

if (nodeModulesExists) {
  const criticalDeps = ['express', 'sqlite3', 'cors', 'ws', 'bcryptjs', 'pdfkit', 'exceljs'];
  criticalDeps.forEach(dep => {
    const depPath = path.join(__dirname, 'node_modules', dep);
    checkFileExists(depPath, `${dep} installed`);
  });
}

console.log('');
console.log('━'.repeat(80));
console.log('7. BUILD OUTPUT CHECK');
console.log('━'.repeat(80));

const buildDir = path.join(__dirname, 'build');
if (fs.existsSync(buildDir)) {
  const buildFiles = fs.readdirSync(buildDir);
  const hasStatic = buildFiles.includes('static');
  const hasIndex = buildFiles.includes('index.html');
  const hasNodeExe = buildFiles.includes('node.exe');
  
  check('Build folder has static assets', hasStatic);
  check('Build folder has index.html', hasIndex);
  check('Build folder has node.exe', hasNodeExe);
  
  if (hasStatic) {
    const staticDir = path.join(buildDir, 'static');
    const staticFiles = fs.readdirSync(staticDir);
    const hasJS = staticFiles.some(f => f.startsWith('js'));
    const hasCSS = staticFiles.some(f => f.startsWith('css'));
    
    check('Static folder has JS files', hasJS);
    check('Static folder has CSS files', hasCSS);
  }
} else {
  check('Build directory exists', false, 'Run "npm run build" first');
}

console.log('');
console.log('═'.repeat(80));
if (allChecksPassed) {
  console.log('✅ ALL CHECKS PASSED - Ready for production build!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Run: npm run build-production');
  console.log('  2. Test the installer from the dist/ folder');
  console.log('  3. Check backend-startup.log if issues occur');
} else {
  console.log('❌ SOME CHECKS FAILED - Fix issues before building');
  console.log('');
  console.log('Common fixes:');
  console.log('  - Run: npm install');
  console.log('  - Run: npm run build');
  console.log('  - Check package.json configuration');
  console.log('  - Ensure node.exe is copied to build/');
}
console.log('═'.repeat(80));
console.log('');

process.exit(allChecksPassed ? 0 : 1);
