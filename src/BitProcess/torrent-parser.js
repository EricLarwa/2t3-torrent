'use strict'

import fs from 'fs'
import bencode from 'bencode'
import crypto from 'crypto'

const BLOCK_LEN = Math.pow(2, 14) // 16 KiB

const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath))
}

const size = (torrent) => {
    const size = torrent.info.files ? torrent.info.files.map(file =>
        file.length).reduce((a, b) => a + b, 0) : torrent.info.length

    const bigIntSize = BigInt(size)
    const buffer = Buffer.alloc(8)
    buffer.writeBigUInt64BE(bigIntSize, 0)
    return buffer
}

const infoHash = (torrent) => {
    const info = bencode.encode(torrent.info)
    return crypto.createHash('sha1').update(info).digest()
}

const pieceLen = (torrent, pieceIndex) => {
    const totalLength = size(torrent).readBigUInt64BE(0)  // Fix: Read the buffer properly
    const pieceLength = BigInt(torrent.info['piece length'])

    const lastPieceLength = totalLength % pieceLength
    const lastPieceIndex = totalLength / pieceLength

    return lastPieceIndex === BigInt(pieceIndex) ? Number(lastPieceLength) : torrent.info['piece length']
}

const blocksPerPiece = (torrent, pieceIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex)
    return Math.ceil(pieceLength / BLOCK_LEN)
}

const blockLen = (torrent, pieceIndex, blockIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex)

    const lastPieceLength = pieceLength % BLOCK_LEN
    const lastPieceIndex = Math.floor(pieceLength / BLOCK_LEN)

    return blockIndex === lastPieceIndex ? lastPieceLength : BLOCK_LEN
}

export default { open, size, infoHash, BLOCK_LEN, pieceLen, blocksPerPiece, blockLen }