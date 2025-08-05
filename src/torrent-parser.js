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

const BLOCK_LEN = Math.pow(2, 14) // 16 KiB

const pieceLen = (torrent, pieceIndex) => {
    const totalLength = BigInt.fromBuffer(this.size(torrent).toNumber())
    const pieceLength = torrent.info['piece length']

    const lastPieceLength = totalLength % (pieceLength)
    const lastPieceIndex = Math.floor(totalLength / pieceLength);

    return lastPieceIndex === pieceIndex ? lastPieceLength : pieceLength
}

const blocksPerPiece = (torrent, pieceIndex) => {
    const pieceLength = this.pieceLen(torrent, pieceIndex)
    return Math.ceil(pieceLength / this.BLOCK_LEN)
}

const blockLen = (torrent, pieceIndex, blockIndex) => {
    const pieceLength = this.pieceLen(torrent, pieceIndex)

    const lastPieceLength = pieceLength % this.BLOCK_LEN
    const lastPieceIndex = Math.floor(pieceLength / this.BLOCK_LEN)

    return blockIndex === lastPieceIndex ?
        lastPieceLength : this.BLOCK_LEN
}
export default { open, size, infoHash, BLOCK_LEN, pieceLen, blocksPerPiece, blockLen }