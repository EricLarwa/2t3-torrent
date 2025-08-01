'use strict'

import fs from 'fs'
import bencode from 'bencode'
import crypto from 'crypto'

const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath))
}

const size = (torrent) => {
    const size = torrent.info.files ? torrent.info.files.map(file =>
        file.length).reduce((a, b) => a + b, 0) : torrent.info.length

    // Convert to BigInt and then to Buffer
    const bigIntSize = BigInt(size)
    const buffer = Buffer.alloc(8)
    
    // Write as big-endian 64-bit integer
    buffer.writeBigUInt64BE(bigIntSize, 0)
    
    return buffer
}

const infoHash = (torrent) => {
    const info = bencode.encode(torrent.info)
    return crypto.createHash('sha1').update(info).digest()
}

export default { open, size, infoHash }