'use strict'

const fs = require('fs')
const bencode = require('bencode')

const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath))
}

const size = (torrent) => {
    return torrent.info.files
        ? torrent.info.files.map(file => file.length).reduce((a, b) => a + b, 0)
        : torrent.info.length;
}

const infoHash = (torrent) => {
    const info = bencode.encode(torrent.info)
    return crypto.createHash('sha1').update(info).digest() //hash to  return fixed length buffer 
}

export default { open, size, infoHash }