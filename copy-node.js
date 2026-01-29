// This script checks for node.exe availability
// Electron doesn't bundle node.exe separately anymore, so we'll use system Node
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('Checking for Node.js installation...');

// Try to find system Node.js
const possiblePaths = [
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
  path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs', 'node.exe')
];

let nodeExePath = null;

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    nodeExePath = p;
    console.log('✅ Found Node.js at:', p);
    break;
  }
}

if (!nodeExePath) {
  // Try using 'where' command on Windows
  try {
    const result = execSync('where node', { encoding: 'utf8' });
    const paths = result.split('\n').filter(p => p.trim());
    if (paths.length > 0) {
      nodeExePath = paths[0].trim();
      console.log('✅ Found Node.js via PATH:', nodeExePath);
    }
  } catch (e) {
    console.error('❌ Node.js not found in system!');
    console.error('The application requires Node.js to be installed.');
    console.error('Please install Node.js from: https://nodejs.org/');
    process.exit(1);
  }
}

if (nodeExePath) {
  // Copy node.exe to build folder for bundling
  const targetDir = path.join(__dirname, 'build');
  const targetPath = path.join(targetDir, 'node.exe');
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  try {
    fs.copyFileSync(nodeExePath, targetPath);
    console.log('✅ Copied node.exe to build folder');
    console.log('   Source:', nodeExePath);
    console.log('   Target:', targetPath);
    
    const stats = fs.statSync(targetPath);
    console.log('   Size:', Math.round(stats.size / 1024 / 1024), 'MB');
    
    // Verify the copied file is executable
    if (stats.size < 1000000) { // Less than 1MB is suspicious
      console.error('⚠️  WARNING: node.exe file size is suspiciously small!');
      console.error('   Expected: ~15-20 MB, Got:', Math.round(stats.size / 1024 / 1024), 'MB');
    }
    
    console.log('✅ Build folder ready for packaging with Node.js runtime');
  } catch (err) {
    console.error('❌ Failed to copy node.exe:', err.message);
    console.error('   This may cause backend startup failures in production!');
    process.exit(1);
  }
} else {
  console.error('❌ Could not locate node.exe');
  process.exit(1);
}
