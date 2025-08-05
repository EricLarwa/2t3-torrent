'use strict'

import { Buffer } from 'buffer'
import torrentParser from './torrent-parser.js'
import util from './util.js'

const buildHandshake = (torrent) => {
    const buf = Buffer.alloc(68)

    buf.writeUInt8(19, 0)
    buf.write('BitTorrent protocol', 1)

    buf.writeUInt32BE(0, 20)
    buf.writeUInt32BE(0, 24)
    
    torrentParser.infoHash(torrent).copy(buf, 28)
    util().copy(buf, 48)

    return buf
}

const buildChoke = () => {
    const buf = Buffer.alloc(5)

    buf.writeUInt32BE(1, 0)
    buf.writeUInt8(0, 4) // Choke message type

    return buf
}

const buildUnchoke = () => {
    const buf = Buffer.alloc(5)

    buf.writeUInt32BE(1, 0)
    buf.writeUInt8(1, 4) // Unchoke message type

    return buf
}

const buildInterested = () => {
    const buf = Buffer.alloc(5)

    buf.writeUInt32BE(1, 0)
    buf.writeUInt8(2, 4) // Interested message type

    return buf
}

const buildNotInterested = () => {
    const buf = Buffer.alloc(5)

    buf.writeUInt32BE(1, 0)
    buf.writeUInt8(3, 4) // Not Interested message type

    return buf
}

const buildHave = (payload) => {
    const buf = Buffer.alloc(9)

    buf.writeUInt32BE(5, 0) // Length
    buf.writeUInt8(4, 4) // Have message type
    payload.copy(buf, 5) // Piece index

    return buf
}

const buildBitfield = (bitfield) => {
    const buf = Buffer.alloc(14)

    buf.writeUInt32BE(payload.length + 1, 0)
    buf.writeUInt8(5, 4) // Bitfield message type
    bitfield.copy(buf, 5) // Bitfield data

    return buf
}

const buildRequest = (payload) => {
    const buf = Buffer.alloc(17)

    buf.writeUInt32BE(13, 0) // Length
    buf.writeUInt8(6, 4) // Request message type
    
    buf.writeUInt32BE(payload.index, 5) // Piece index
    buf.writeUInt32BE(payload.begin, 9) // Begin offset
    buf.writeUInt32BE(payload.length, 13) // Length of the request

    return buf
}

const buildCancel = (payload) => {
    const buf = Buffer.alloc(17)

    buf.writeUInt32BE(13, 0) // Length
    buf.writeUInt8(8, 4) // Cancel message type
    
    buf.writeUInt32BE(payload.index, 5) // Piece index
    buf.writeUInt32BE(payload.begin, 9) // Begin offset
    buf.writeUInt32BE(payload.length, 13) // Length of the request

    return buf
}

const buildPort = (port) => {
    const buf = Buffer.alloc(7)

    buf.writeUInt32BE(3, 0) // Length
    buf.writeUInt8(9, 4) // Port message type
    buf.writeUInt16BE(port, 5) // Port number

    return buf
}

const parse = (msg) => {
    const id = msg.length > 4 ? msg.readInt8(4) : null
    let payload = msg.length > 5 ? msg.slice(5) : null  // Fix: slice from 5, not 50

    if(id === 6 || id === 7 || id === 8) {
        const rest = payload.slice(8)  // Fix: Define rest variable
        payload = {
            index: payload.readInt32BE(0),
            begin: payload.readInt32BE(4)
        }
        payload[id === 7 ? 'block' : 'length'] = rest
    }

    return {
        size: msg.readInt32BE(0),
        id: id,
        payload: payload
    }
}

export default {
    buildHandshake,
    buildChoke,
    buildUnchoke,
    buildInterested,
    buildNotInterested,
    buildHave,
    buildBitfield,
    buildRequest,
    buildCancel,
    buildPort,
    parse
}