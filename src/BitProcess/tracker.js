'use strict'

import dgram from 'dgram'
import { Buffer } from 'buffer'
import crypto from 'crypto'
import util from './util.js'

// Fix: Use await for dynamic import
const torrentParser = await import('./BitProcess/torrent-parser.js')

function buildConnReq() {
    const buf = Buffer.alloc(16)

    // BitTorrent UDP tracker protocol magic constants
    buf.writeUInt32BE(0x41727101, 0)
    buf.writeUInt32BE(0x980, 4)
    buf.writeUInt32BE(0, 8)
    crypto.randomBytes(4).copy(buf, 12)
    return buf
}

// Parse the connection response
function parseConnResp(resp) {
    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        connectionId: resp.slice(8)
    }
}

function respType(resp) {
    const action = resp.readUInt32BE(0)
    if (action === 0) return 'connect'
    if (action === 1) return 'announce'
    return 'error'
}

function buildAnnounceReq(connId, torrent, port = 6881) {
    const buf = Buffer.allocUnsafe(98)

    // Connection ID (8 bytes)
    connId.copy(buf, 0)
    
    // Action: announce (1)
    buf.writeUInt32BE(1, 8)

    // Transaction ID (4 bytes)
    crypto.randomBytes(4).copy(buf, 12)
    
    // Info hash (20 bytes)
    torrentParser.default.infoHash(torrent).copy(buf, 16)
    
    // Peer ID (20 bytes)
    util.genId().copy(buf, 36)
    
    // Downloaded (8 bytes)
    Buffer.alloc(8).copy(buf, 56)
    
    // Left (8 bytes)
    torrentParser.default.size(torrent).copy(buf, 64)
    
    // Uploaded (8 bytes)
    Buffer.alloc(8).copy(buf, 72)
    
    // Event (4 bytes)
    buf.writeUInt32BE(0, 80)
    
    // IP address (4 bytes) - 0 means use sender's IP
    buf.writeUInt32BE(0, 84)

    // Key (4 bytes)
    crypto.randomBytes(4).copy(buf, 88)
    
    // Num want (4 bytes)
    buf.writeInt32BE(-1, 92)
    
    // Port (2 bytes)
    buf.writeUInt16BE(port, 96)

    return buf
}

function udpSend(socket, message, rawUrl, callback) {
    const url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString()
    const urlMatch = url.match(/^udp:\/\/([^:]+):(\d+)/)
    
    if (!urlMatch) {
        return callback(new Error(`Invalid UDP URL format: ${url}`))
    }
    
    const hostname = urlMatch[1]
    const port = parseInt(urlMatch[2])
    
    console.log(`Sending UDP message to ${hostname}:${port}`)
    
    socket.send(message, 0, message.length, port, hostname, (err) => {
        if (err) {
            console.log('UDP send error:', err)
            callback(err)
        } else {
            console.log('UDP message sent successfully')
        }
    })
}

function parseAnnounceResp(resp) {
    function group(iterable, groupSize) {
        let groups = []
        for(let i = 0; i < iterable.length; i += groupSize) {
            groups.push(iterable.slice(i, i + groupSize))
        }
        return groups
    }

    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        leechers: resp.readUInt32BE(8),
        seeders: resp.readUInt32BE(12),
        peers: group(resp.slice(20), 6).map(peer => {
            return {
                ip: peer.slice(0, 4).join('.'),
                port: peer.readUInt16BE(4),
            }
        })
    }
}

function getPeers(torrent, callback) {
    const socket = dgram.createSocket('udp4')
    let connectionId = null
    let timeout = null
    
    // Set up timeout
    const TIMEOUT_MS = 15000
    timeout = setTimeout(() => {
        console.log('Tracker request timeout')
        socket.close()
        callback(new Error('Tracker request timeout'))
    }, TIMEOUT_MS)
    
    // Handle socket errors
    socket.on('error', (err) => {
        console.log('Socket error:', err)
        clearTimeout(timeout)
        socket.close()
        callback(err)
    })
    
    // Convert URL properly
    let url
    if (torrent.announce instanceof Uint8Array) {
        url = new TextDecoder('utf8').decode(torrent.announce)
    } else if (Buffer.isBuffer(torrent.announce)) {
        url = torrent.announce.toString('utf8')
    } else {
        url = torrent.announce.toString()
    }
    
    console.log('Processed URL:', url)
    
    // Handle incoming messages
    socket.on('message', (response, rinfo) => {
        console.log('Received response from:', rinfo)
        console.log('Response type:', respType(response))
        
        try {
            if (respType(response) === 'connect') {
                console.log('Received connect response')
                const connResp = parseConnResp(response)
                connectionId = connResp.connectionId
                console.log('Connection ID received, sending announce request')
                const announceReq = buildAnnounceReq(connectionId, torrent)
                udpSend(socket, announceReq, url, (err) => {
                    if (err) {
                        clearTimeout(timeout)
                        socket.close()
                        callback(err)
                    }
                })
            } else if (respType(response) === 'announce') {
                console.log('Received announce response')
                clearTimeout(timeout)
                const announceResp = parseAnnounceResp(response)
                socket.close()
                callback(null, announceResp.peers)
            }
        } catch (err) {
            console.log('Error processing response:', err)
            clearTimeout(timeout)
            socket.close()
            callback(err)
        }
    })
    
    // Send initial connection request
    console.log('Sending initial connection request')
    udpSend(socket, buildConnReq(), url, (err) => {
        if (err) {
            clearTimeout(timeout)
            socket.close()
            return callback(err)
        }
    })
}

export default getPeers

