const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoDir = 'c:/Users/Kwang/Documents/ComiketPlanner';
const distDir = path.join(repoDir, 'dist');
const tempDir = path.join(repoDir, 'scratch/build_temp');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Read base manifest
const manifestPath = path.join(repoDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 1. Build Firefox Specific Package (0 Warnings on Firefox AMO)
const firefoxManifest = JSON.parse(JSON.stringify(manifest));
firefoxManifest.background = {
  scripts: [
    'src/utils/browser-poly.js',
    'src/utils/exporter.js',
    'background/service-worker.js'
  ]
};

// 2. Build Chrome Specific Package
const chromeManifest = JSON.parse(JSON.stringify(manifest));
delete chromeManifest.browser_specific_settings;
chromeManifest.background = {
  service_worker: 'background/service-worker.js'
};

function createPackage(targetName, targetManifest) {
  const targetTemp = path.join(tempDir, targetName);
  if (fs.existsSync(targetTemp)) {
    fs.rmSync(targetTemp, { recursive: true, force: true });
  }
  fs.mkdirSync(targetTemp, { recursive: true });

  // Copy files
  const itemsToCopy = ['Code.gs', 'README.md', 'README.ja.md', 'LICENSE', '_locales', 'icons', 'src', 'content', 'popup', 'options', 'background'];
  itemsToCopy.forEach((item) => {
    const srcPath = path.join(repoDir, item);
    const destPath = path.join(targetTemp, item);
    if (fs.existsSync(srcPath)) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    }
  });

  // Write target manifest.json
  fs.writeFileSync(path.join(targetTemp, 'manifest.json'), JSON.stringify(targetManifest, null, 2), 'utf8');

  // Zip using tar.exe with POSIX slashes
  const zipName = `comiket-circle-tracker-${targetName}-v1.3.0.zip`;
  const zipPath = path.join(distDir, zipName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  execSync(`tar.exe -caf "${zipPath}" manifest.json Code.gs README.md README.ja.md LICENSE _locales icons src content popup options background`, {
    cwd: targetTemp
  });

  console.log(`✅ Built ${targetName} zip: ${zipName}`);
}

createPackage('firefox', firefoxManifest);
createPackage('chrome', chromeManifest);

console.log('🎉 Dual browser packages generated successfully in dist/!');
