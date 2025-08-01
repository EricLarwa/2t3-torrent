'use strict';

import download from './src/download.js';
import getPeers from './src/tracker.js';
import torrentParser from './src/torrent-parser.js';

const torrent = torrentParser.open(process.argv[2]);

download(torrent)

getPeers(torrent, (peers) => {
    console.log('Peers:', peers);
});
