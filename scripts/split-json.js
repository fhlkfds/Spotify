#!/usr/bin/env node

/**
 * Split a large Spotify JSON export into smaller chunks
 * Usage: node scripts/split-json.js <input-file> [chunk-size]
 */

const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/split-json.js <input-file> [chunk-size]');
  console.error('Example: node scripts/split-json.js endsong_0.json 2000');
  process.exit(1);
}

const inputFile = args[0];
const chunkSize = parseInt(args[1] || '2000', 10);

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File "${inputFile}" not found`);
  process.exit(1);
}

console.log(`Reading ${inputFile}...`);
const content = fs.readFileSync(inputFile, 'utf8');

console.log('Parsing JSON...');
let data;
try {
  data = JSON.parse(content);
} catch (error) {
  console.error('Error: Invalid JSON file');
  console.error(error.message);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('Error: JSON file must contain an array');
  process.exit(1);
}

console.log(`Total entries: ${data.length.toLocaleString()}`);
console.log(`Chunk size: ${chunkSize.toLocaleString()}`);

const numChunks = Math.ceil(data.length / chunkSize);
console.log(`Will create ${numChunks} chunk(s)\n`);

// Create output directory
const baseName = path.basename(inputFile, '.json');
const outputDir = path.join(path.dirname(inputFile), `${baseName}_chunks`);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Split into chunks
for (let i = 0; i < numChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, data.length);
  const chunk = data.slice(start, end);

  const outputFile = path.join(outputDir, `${baseName}_chunk_${i + 1}_of_${numChunks}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(chunk, null, 2), 'utf8');

  console.log(`✓ Created ${outputFile} (${chunk.length.toLocaleString()} entries)`);
}

console.log(`\n✅ Done! Split ${data.length.toLocaleString()} entries into ${numChunks} files`);
console.log(`📁 Output directory: ${outputDir}`);
console.log('\nYou can now import these smaller files one at a time.');
