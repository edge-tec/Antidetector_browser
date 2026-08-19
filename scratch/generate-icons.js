const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = '/Users/mizanurrahman/Desktop/Antidetected Broeser';
const chromeSrc = '/Users/mizanurrahman/.gemini/antigravity-ide/brain/80df093b-9768-4270-b0d3-2179c4bc6208/.user_uploaded/media_1787150990444.jpg';
const firefoxSrc = '/Users/mizanurrahman/.gemini/antigravity-ide/brain/80df093b-9768-4270-b0d3-2179c4bc6208/.user_uploaded/media_1787150987316.jpg';

const tmpDir = path.join(rootDir, 'scratch', 'icon-build');
if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

console.log('--- 1. Converting source images to 1024x1024 master PNGs ---');
const chromeMaster = path.join(tmpDir, 'chrome_master_1024.png');
const firefoxMaster = path.join(tmpDir, 'firefox_master_1024.png');

execSync(`sips -s format png -z 1024 1024 "${chromeSrc}" --out "${chromeMaster}"`);
execSync(`sips -s format png -z 1024 1024 "${firefoxSrc}" --out "${firefoxMaster}"`);

console.log('--- 2. Building macOS .iconset for Chromium & Firefox ---');
function createIconset(masterPng, iconsetName, outIcnsPath) {
  const iconsetDir = path.join(tmpDir, `${iconsetName}.iconset`);
  fs.mkdirSync(iconsetDir, { recursive: true });

  const sizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 }
  ];

  for (const s of sizes) {
    const dest = path.join(iconsetDir, s.name);
    execSync(`sips -z ${s.size} ${s.size} "${masterPng}" --out "${dest}"`);
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${outIcnsPath}"`);
  console.log(`Generated ICNS: ${outIcnsPath}`);
}

createIconset(chromeMaster, 'chrome', path.join(tmpDir, 'icon.icns'));
createIconset(firefoxMaster, 'firefox', path.join(tmpDir, 'firefox.icns'));

console.log('--- 3. Building Multi-Resolution Windows .ico Files ---');
// Pure Node.js multi-resolution ICO builder using PNG chunks
function buildIco(masterPng, outIcoPath) {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const sz of sizes) {
    const resizedPng = path.join(tmpDir, `ico_${sz}.png`);
    execSync(`sips -z ${sz} ${sz} "${masterPng}" --out "${resizedPng}"`);
    const buf = fs.readFileSync(resizedPng);
    pngBuffers.push({ size: sz, buffer: buf });
  }

  // ICO Header: 6 bytes
  // 2 bytes: Reserved (0)
  // 2 bytes: Type (1 for icon)
  // 2 bytes: Count of images
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  // Each directory entry: 16 bytes
  const dirEntrySize = 16;
  let offset = 6 + pngBuffers.length * dirEntrySize;
  const dirEntries = [];

  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width (0 = 256)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // image size in bytes
    entry.writeUInt32LE(offset, 12); // offset in file
    dirEntries.push(entry);
    offset += img.buffer.length;
  }

  const finalIco = Buffer.concat([header, ...dirEntries, ...pngBuffers.map(b => b.buffer)]);
  fs.writeFileSync(outIcoPath, finalIco);
  console.log(`Generated ICO: ${outIcoPath} (${finalIco.length} bytes, ${sizes.length} resolutions)`);
}

buildIco(chromeMaster, path.join(tmpDir, 'icon.ico'));
buildIco(chromeMaster, path.join(tmpDir, 'favicon.ico'));
buildIco(firefoxMaster, path.join(tmpDir, 'firefox.ico'));

console.log('--- 4. Distributing Assets to Project Directories ---');

// Standard PNG sizes
const png512 = path.join(tmpDir, 'icon_512.png');
const png256 = path.join(tmpDir, 'icon_256.png');
const png180 = path.join(tmpDir, 'apple-touch-icon.png');
const png64 = path.join(tmpDir, 'favicon-64.png');
const png32 = path.join(tmpDir, 'favicon-32x32.png');
const png16 = path.join(tmpDir, 'favicon-16x16.png');

const ff512 = path.join(tmpDir, 'firefox_512.png');
const ff256 = path.join(tmpDir, 'firefox_256.png');

execSync(`sips -z 512 512 "${chromeMaster}" --out "${png512}"`);
execSync(`sips -z 256 256 "${chromeMaster}" --out "${png256}"`);
execSync(`sips -z 180 180 "${chromeMaster}" --out "${png180}"`);
execSync(`sips -z 64 64 "${chromeMaster}" --out "${png64}"`);
execSync(`sips -z 32 32 "${chromeMaster}" --out "${png32}"`);
execSync(`sips -z 16 16 "${chromeMaster}" --out "${png16}"`);

execSync(`sips -z 512 512 "${firefoxMaster}" --out "${ff512}"`);
execSync(`sips -z 256 256 "${firefoxMaster}" --out "${ff256}"`);

// Destination lists
const copyTargets = [
  // Resources
  { src: png512, dest: path.join(rootDir, 'resources', 'icon.png') },
  { src: path.join(tmpDir, 'icon.icns'), dest: path.join(rootDir, 'resources', 'icon.icns') },
  { src: path.join(tmpDir, 'icon.ico'), dest: path.join(rootDir, 'resources', 'icon.ico') },
  { src: ff512, dest: path.join(rootDir, 'resources', 'firefox.png') },
  { src: path.join(tmpDir, 'firefox.icns'), dest: path.join(rootDir, 'resources', 'firefox.icns') },
  { src: path.join(tmpDir, 'firefox.ico'), dest: path.join(rootDir, 'resources', 'firefox.ico') },

  // Root assets
  { src: png512, dest: path.join(rootDir, 'brand-logo.png') },
  { src: png512, dest: path.join(rootDir, 'logo.png') },
  { src: png512, dest: path.join(rootDir, 'favicon.png') },
  { src: path.join(tmpDir, 'favicon.ico'), dest: path.join(rootDir, 'favicon.ico') },
  { src: png180, dest: path.join(rootDir, 'apple-touch-icon.png') },
  { src: png32, dest: path.join(rootDir, 'favicon-32x32.png') },
  { src: png16, dest: path.join(rootDir, 'favicon-16x16.png') },

  // Public assets
  { src: png512, dest: path.join(rootDir, 'public', 'brand-logo.png') },
  { src: png512, dest: path.join(rootDir, 'public', 'logo.png') },
  { src: png512, dest: path.join(rootDir, 'public', 'favicon.png') },
  { src: path.join(tmpDir, 'favicon.ico'), dest: path.join(rootDir, 'public', 'favicon.ico') },
  { src: png180, dest: path.join(rootDir, 'public', 'apple-touch-icon.png') },
  { src: png32, dest: path.join(rootDir, 'public', 'favicon-32x32.png') },
  { src: png16, dest: path.join(rootDir, 'public', 'favicon-16x16.png') },
  { src: png512, dest: path.join(rootDir, 'public', 'antiprofiles-chrome.png') },
  { src: ff512, dest: path.join(rootDir, 'public', 'antiprofiles-firefox.png') },

  // Src renderer assets
  { src: png512, dest: path.join(rootDir, 'src', 'renderer', 'assets', 'brand-logo.png') },
  { src: png512, dest: path.join(rootDir, 'src', 'renderer', 'assets', 'logo.png') },
  { src: png512, dest: path.join(rootDir, 'src', 'renderer', 'assets', 'antiprofiles-chrome.png') },
  { src: ff512, dest: path.join(rootDir, 'src', 'renderer', 'assets', 'antiprofiles-firefox.png') },

  // PHP Backend assets
  { src: png512, dest: path.join(rootDir, 'php-backend', 'brand-logo.png') },
  { src: png512, dest: path.join(rootDir, 'php-backend', 'logo.png') },
  { src: png512, dest: path.join(rootDir, 'php-backend', 'favicon.png') },
  { src: path.join(tmpDir, 'favicon.ico'), dest: path.join(rootDir, 'php-backend', 'favicon.ico') },
  { src: png180, dest: path.join(rootDir, 'php-backend', 'apple-touch-icon.png') },
  { src: png32, dest: path.join(rootDir, 'php-backend', 'favicon-32x32.png') },
  { src: png16, dest: path.join(rootDir, 'php-backend', 'favicon-16x16.png') },
  { src: png512, dest: path.join(rootDir, 'php-backend', 'antiprofiles-chrome.png') },
  { src: ff512, dest: path.join(rootDir, 'php-backend', 'antiprofiles-firefox.png') }
];

for (const t of copyTargets) {
  const dir = path.dirname(t.dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(t.src, t.dest);
  console.log(`Copied: ${t.dest}`);
}

console.log('--- ALL BRANDING ICON ASSETS SUCCESSFULLY GENERATED & DEPLOYED ---');
