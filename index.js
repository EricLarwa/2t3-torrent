'use strict';

import fs from 'fs';
import bencode from  'bencode'

import getPeers from './src/tracker.js';
import torrentParser from './src/torrent-parser.js';

const torrent = torrentParser.open('puppy.torrent');

getPeers(torrent, (peers) => {
    console.log('Peers:', peers);
});
