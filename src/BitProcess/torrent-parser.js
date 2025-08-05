'use strict'

import fs from 'fs'
import path from 'path'
import bencode from 'bencode'
import crypto from 'crypto'

const BLOCK_LEN = Math.pow(2, 14) // 16 KiB

const open = (filepath) => {
    // Validate input
    if (!filepath) {
        throw new Error('Torrent file path is required')
    }
    
    if (typeof filepath !== 'string') {
        throw new Error('Torrent file path must be a string')
    }
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
        throw new Error(`Torrent file not found: ${filepath}`)
    }
    
    // Check file extension
    if (path.extname(filepath).toLowerCase() !== '.torrent') {
        console.warn('Warning: File does not have .torrent extension')
    }
    
    try {
        const data = fs.readFileSync(filepath)
        const decoded = bencode.decode(data)
        
        // Validate required torrent fields
        if (!decoded.info) {
            throw new Error('Invalid torrent file: missing info section')
        }
        
        if (!decoded.announce && !decoded['announce-list']) {
            throw new Error('Invalid torrent file: missing announce URL')
        }
        
        console.log('✅ Torrent file loaded successfully')
        return decoded
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Torrent file not found: ${filepath}`)
        } else if (error.code === 'EACCES') {
            throw new Error(`Permission denied reading torrent file: ${filepath}`)
        } else if (error.message.includes('decode')) {
            throw new Error(`Invalid torrent file format: ${filepath}`)
        } else {
            throw new Error(`Error reading torrent file: ${error.message}`)
        }
    }
}

const size = (torrent) => {
    if (!torrent || !torrent.info) {
        throw new Error('Invalid torrent object')
    }
    
    const size = torrent.info.files ? torrent.info.files.map(file =>
        file.length).reduce((a, b) => a + b, 0) : torrent.info.length

    if (!size || size <= 0) {
        throw new Error('Invalid torrent size')
    }

    const bigIntSize = BigInt(size)
    const buffer = Buffer.alloc(8)
    buffer.writeBigUInt64BE(bigIntSize, 0)
    return buffer
}

const infoHash = (torrent) => {
    if (!torrent || !torrent.info) {
        throw new Error('Invalid torrent object')
    }
    
    try {
        const info = bencode.encode(torrent.info)
        return crypto.createHash('sha1').update(info).digest()
    } catch (error) {
        throw new Error(`Error calculating info hash: ${error.message}`)
    }
}

const pieceLen = (torrent, pieceIndex) => {
    if (!torrent || !torrent.info) {
        throw new Error('Invalid torrent object')
    }
    
    if (typeof pieceIndex !== 'number' || pieceIndex < 0) {
        throw new Error('Invalid piece index')
    }
    
    const totalLength = size(torrent).readBigUInt64BE(0)
    const pieceLength = BigInt(torrent.info['piece length'])

    if (!pieceLength || pieceLength <= 0) {
        throw new Error('Invalid piece length in torrent')
    }

    const lastPieceLength = totalLength % pieceLength
    const lastPieceIndex = totalLength / pieceLength

    return lastPieceIndex === BigInt(pieceIndex) ? Number(lastPieceLength) : Number(pieceLength)
}

const blocksPerPiece = (torrent, pieceIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex)
    return Math.ceil(pieceLength / BLOCK_LEN)
}

const blockLen = (torrent, pieceIndex, blockIndex) => {
    if (typeof blockIndex !== 'number' || blockIndex < 0) {
        throw new Error('Invalid block index')
    }
    
    const pieceLength = pieceLen(torrent, pieceIndex)
    const lastPieceLength = pieceLength % BLOCK_LEN
    const lastPieceIndex = Math.floor(pieceLength / BLOCK_LEN)

    return blockIndex === lastPieceIndex ? lastPieceLength : BLOCK_LEN
}

export default { open, size, infoHash, BLOCK_LEN, pieceLen, blocksPerPiece, blockLen }