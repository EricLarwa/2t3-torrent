'use strict';

const fs = require('fs');
const bencode = require('bencode');
const tracker = require('./tracker.js');
const torrentParser = require('./torrent-parser.js');

const torrent = torrentParser.open('puppy.torrent');

tracker.getPeers(torrent, (peers) => {
    console.log('Peers:', peers);
});
