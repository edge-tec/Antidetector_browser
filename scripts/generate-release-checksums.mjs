#!/usr/bin/env node
// Generates SHA256SUMS.txt for all distributable release artifacts in dist/
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const targetDir = path.resolve(process.argv[2] || 'dist')
if (!fs.existsSync(targetDir)) {
  console.error(`Directory not found: ${targetDir}`)
  process.exit(1)
}

const ARTIFACT_EXTS = new Set(['.dmg', '.zip', '.exe', '.appimage', '.deb', '.rpm'])
const files = fs
  .readdirSync(targetDir)
  .filter((f) => ARTIFACT_EXTS.has(path.extname(f).toLowerCase()))
  .sort()

const lines = []
for (const file of files) {
  const fullPath = path.join(targetDir, file)
  const hash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex')
  lines.push(`${hash}  ${file}`)
}

const outPath = path.join(targetDir, 'SHA256SUMS.txt')
fs.writeFileSync(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8')
console.log(`Generated ${outPath} (${lines.length} artifact(s))`)
