'use strict';

import download from './src/BitProcess/download.js';
import torrentParser from './src/BitProcess/torrent-parser.js';

const torrent = torrentParser.open(process.argv[2]);

download(torrent, torrent.info.name);