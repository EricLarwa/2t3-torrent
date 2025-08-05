'use strict';

import download from './src/BitProcess/download.js';
import torrentParser from './src/BitProcess/torrent-parser.js';
import fs from 'fs';
import path from 'path';

// Check if torrent file path is provided
if (process.argv.length < 3) {
    console.error('Usage: node index.js <torrent-file-path> [download-path]');
    console.error('Example: node index.js ./test.torrent ./downloads');
    process.exit(1);
}

const torrentPath = process.argv[2];
const downloadPath = process.argv[3] || './downloads'; // Default download path

// Validate torrent file exists
if (!fs.existsSync(torrentPath)) {
    console.error(`Error: Torrent file not found: ${torrentPath}`);
    process.exit(1);
}

try {
    console.log(`Loading torrent: ${torrentPath}`);
    const torrent = torrentParser.open(torrentPath);
    
    // Get torrent name for display
    const torrentName = torrent.info.name instanceof Uint8Array 
        ? new TextDecoder('utf8').decode(torrent.info.name)
        : torrent.info.name.toString();
    
    console.log(`Torrent name: ${torrentName}`);
    console.log(`Download path: ${downloadPath}`);
    
    // Start download with progress callback
    download(torrent, downloadPath, (progress) => {
        if (progress.error) {
            console.error('Download error:', progress.error);
        } else if (progress.completed) {
            console.log('✅ Download completed successfully!');
        } else {
            console.log(`📥 Progress: ${progress.percentage.toFixed(1)}% (${progress.completed}/${progress.total} pieces)`);
        }
    });
    
} catch (error) {
    console.error('Error loading torrent:', error.message);
    process.exit(1);
}