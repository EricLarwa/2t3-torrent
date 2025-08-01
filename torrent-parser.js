'use strict'

const fs = require('fs')
const bencode = require('bencode')

const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath))
}

const size = (torrent) => {
    //...
}

const infoHash = (torrent) => {
    //...
}

export default open