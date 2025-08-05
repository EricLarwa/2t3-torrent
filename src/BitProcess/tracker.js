'use strict'

import dgram from 'dgram'
import { Buffer } from 'buffer'
import crypto from 'crypto'
import util from './util.js'

const torrentParser = await import('./torrent-parser.js')

// Add debugging flag
const DEBUG = true

function log(message, ...args) {
    if (DEBUG) {
        console.log(`[TRACKER] ${message}`, ...args)
    }
}

function buildConnReq() {
    const buf = Buffer.alloc(16)
    // BitTorrent UDP tracker protocol magic constants
    buf.writeUInt32BE(0x41727101, 0)  // Magic constant part 1
    buf.writeUInt32BE(0x980, 4)       // Magic constant part 2
    buf.writeUInt32BE(0, 8)           // Action: connect (0)
    const transactionId = crypto.randomBytes(4)
    transactionId.copy(buf, 12)       // Transaction ID
    
    log('Built connection request:', {
        magic1: buf.readUInt32BE(0).toString(16),
        magic2: buf.readUInt32BE(4).toString(16),
        action: buf.readUInt32BE(8),
        transactionId: buf.readUInt32BE(12)
    })
    
    return buf
}

function parseConnResp(resp) {
    if (resp.length < 16) {
        throw new Error(`Connection response too short: ${resp.length} bytes`)
    }
    
    const result = {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        connectionId: resp.slice(8)
    }
    
    log('Parsed connection response:', {
        action: result.action,
        transactionId: result.transactionId,
        connectionId: result.connectionId.toString('hex')
    })
    
    return result
}

function respType(resp) {
    if (!resp || resp.length < 4) {
        log('Invalid response: too short or null')
        return 'error'
    }
    
    const action = resp.readUInt32BE(0)
    log('Response action:', action)
    
    if (action === 0) return 'connect'
    if (action === 1) return 'announce'
    if (action === 3) return 'error'
    
    log('Unknown action type:', action)
    return 'unknown'
}

function buildAnnounceReq(connId, torrent, port = 6881) {
    if (!connId || connId.length !== 8) {
        throw new Error('Invalid connection ID')
    }
    
    const buf = Buffer.alloc(98)
    let offset = 0

    // Connection ID (8 bytes)
    connId.copy(buf, offset)
    offset += 8
    
    // Action: announce (1)
    buf.writeUInt32BE(1, offset)
    offset += 4

    // Transaction ID (4 bytes)
    const transactionId = crypto.randomBytes(4)
    transactionId.copy(buf, offset)
    offset += 4
    
    // Info hash (20 bytes)
    const infoHash = torrentParser.default.infoHash(torrent)
    infoHash.copy(buf, offset)
    offset += 20
    
    // Peer ID (20 bytes)
    const peerId = util.genId()
    peerId.copy(buf, offset)
    offset += 20
    
    // Downloaded (8 bytes)
    buf.writeBigUInt64BE(0n, offset)
    offset += 8
    
    // Left (8 bytes) - total size of torrent
    const totalSize = torrentParser.default.size(torrent)
    totalSize.copy(buf, offset)
    offset += 8
    
    // Uploaded (8 bytes)
    buf.writeBigUInt64BE(0n, offset)
    offset += 8
    
    // Event (4 bytes) - 0: none, 1: completed, 2: started, 3: stopped
    buf.writeUInt32BE(2, offset) // started event
    offset += 4
    
    // IP address (4 bytes) - 0 means use sender's IP
    buf.writeUInt32BE(0, offset)
    offset += 4

    // Key (4 bytes)
    crypto.randomBytes(4).copy(buf, offset)
    offset += 4
    
    // Num want (4 bytes) - number of peers we want
    buf.writeInt32BE(-1, offset) // -1 means default
    offset += 4
    
    // Port (2 bytes)
    buf.writeUInt16BE(port, offset)

    log('Built announce request:', {
        connectionId: connId.toString('hex'),
        action: 1,
        transactionId: transactionId.readUInt32BE(0),
        infoHash: infoHash.toString('hex'),
        peerId: peerId.toString('hex'),
        event: 'started',
        port: port,
        totalLength: offset + 2
    })

    return buf
}

function testConnectivity(hostname, port, callback) {
    log(`Testing connectivity to ${hostname}:${port}`)
    
    const testSocket = dgram.createSocket('udp4')
    const testMessage = Buffer.from('ping')
    
    const timeout = setTimeout(() => {
        testSocket.close()
        callback(new Error(`Connectivity test timeout to ${hostname}:${port}`))
    }, 5000)
    
    testSocket.on('error', (err) => {
        clearTimeout(timeout)
        testSocket.close()
        callback(err)
    })
    
    testSocket.send(testMessage, 0, testMessage.length, port, hostname, (err) => {
        clearTimeout(timeout)
        testSocket.close()
        if (err) {
            log('Connectivity test failed:', err.message)
            callback(err)
        } else {
            log('Connectivity test passed')
            callback(null)
        }
    })
}

function udpSend(socket, message, rawUrl, callback) {
    const url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString()
    const urlMatch = url.match(/^udp:\/\/([^:]+):(\d+)/)
    
    if (!urlMatch) {
        return callback(new Error(`Invalid UDP URL format: ${url}`))
    }
    
    const hostname = urlMatch[1]
    const port = parseInt(urlMatch[2])
    
    log(`Sending ${message.length} bytes to ${hostname}:${port}`)
    log('Message hex:', message.toString('hex'))
    
    // Test connectivity first
    testConnectivity(hostname, port, (connectErr) => {
        if (connectErr) {
            log('Connectivity test failed, but proceeding anyway:', connectErr.message)
        }
        
        socket.send(message, 0, message.length, port, hostname, (err) => {
            if (err) {
                log('UDP send error:', err.message)
                callback(err)
            } else {
                log('UDP message sent successfully')
                // Don't call callback here for success - wait for response
            }
        })
    })
}

function parseAnnounceResp(resp) {
    if (resp.length < 20) {
        throw new Error(`Announce response too short: ${resp.length} bytes`)
    }
    
    function group(iterable, groupSize) {
        let groups = []
        for(let i = 0; i < iterable.length; i += groupSize) {
            groups.push(iterable.slice(i, i + groupSize))
        }
        return groups
    }

    const result = {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        interval: resp.readUInt32BE(8),
        leechers: resp.readUInt32BE(12),
        seeders: resp.readUInt32BE(16),
        peers: []
    }
    
    if (resp.length > 20) {
        const peerData = resp.slice(20)
        result.peers = group(peerData, 6).map(peer => {
            if (peer.length === 6) {
                return {
                    ip: peer.slice(0, 4).join('.'),
                    port: peer.readUInt16BE(4),
                }
            }
            return null
        }).filter(peer => peer !== null)
    }
    
    log('Parsed announce response:', {
        action: result.action,
        transactionId: result.transactionId,
        interval: result.interval,
        leechers: result.leechers,
        seeders: result.seeders,
        peerCount: result.peers.length,
        peers: result.peers.slice(0, 3) // Show first 3 peers
    })

    return result
}

function handleErrorResponse(resp) {
    if (resp.length >= 8) {
        const action = resp.readUInt32BE(0)
        const transactionId = resp.readUInt32BE(4)
        const errorMessage = resp.slice(8).toString('utf8')
        
        log('Tracker error response:', {
            action,
            transactionId,
            error: errorMessage
        })
        
        return new Error(`Tracker error: ${errorMessage}`)
    }
    return new Error('Unknown tracker error')
}

function getPeers(torrent, callback) {
    // Extract announce URLs
    let announceUrls = []
    
    if (torrent.announce) {
        announceUrls.push(torrent.announce)
    }
    
    if (torrent['announce-list']) {
        torrent['announce-list'].forEach(tier => {
            if (Array.isArray(tier)) {
                tier.forEach(url => announceUrls.push(url))
            } else {
                announceUrls.push(tier)
            }
        })
    }
    
    // Convert URLs and filter for UDP
    const udpTrackers = announceUrls
        .map(announce => {
            if (announce instanceof Uint8Array) {
                return new TextDecoder('utf8').decode(announce)
            } else if (Buffer.isBuffer(announce)) {
                return announce.toString('utf8')
            } else {
                return announce.toString()
            }
        })
        .filter(url => url.startsWith('udp://'))
        .filter((url, index, arr) => arr.indexOf(url) === index) // Remove duplicates
    
    log('Available UDP trackers:', udpTrackers)
    
    if (udpTrackers.length === 0) {
        return callback(new Error('No UDP trackers found in torrent'), null)
    }
    
    let trackerIndex = 0
    
    function tryNextTracker() {
        if (trackerIndex >= udpTrackers.length) {
            return callback(new Error('All trackers failed'), null)
        }
        
        const currentTracker = udpTrackers[trackerIndex]
        trackerIndex++
        
        log(`Trying tracker ${trackerIndex}/${udpTrackers.length}: ${currentTracker}`)
        
        attemptTracker(currentTracker, (err, peers) => {
            if (err) {
                log(`Tracker ${trackerIndex} failed:`, err.message)
                if (trackerIndex < udpTrackers.length) {
                    setTimeout(tryNextTracker, 2000) // Wait 2 seconds before next tracker
                } else {
                    callback(new Error('All trackers failed'), null)
                }
            } else {
                callback(null, peers)
            }
        })
    }
    
    function attemptTracker(url, callback) {
        const socket = dgram.createSocket('udp4')
        let connectionId = null
        let timeout = null
        let retryCount = 0
        const maxRetries = 3
        let requestStartTime = Date.now()
        
        log(`Attempting tracker: ${url}`)
        
        function cleanup() {
            if (timeout) {
                clearTimeout(timeout)
                timeout = null
            }
            if (socket) {
                socket.removeAllListeners()
                socket.close()
            }
        }
        
        function startRequest() {
            requestStartTime = Date.now()
            
            // Clear any existing timeout
            if (timeout) clearTimeout(timeout)
            
            // Set timeout with exponential backoff (15s, 30s, 60s)
            const timeoutMs = 15000 * Math.pow(2, retryCount)
            log(`Setting timeout to ${timeoutMs}ms (attempt ${retryCount + 1}/${maxRetries + 1})`)
            
            timeout = setTimeout(() => {
                const elapsed = Date.now() - requestStartTime
                log(`Tracker request timeout after ${elapsed}ms (attempt ${retryCount + 1})`)
                
                if (retryCount < maxRetries) {
                    retryCount++
                    log(`Retrying... (${retryCount}/${maxRetries})`)
                    setTimeout(startRequest, 2000) // Wait 2 seconds before retry
                } else {
                    cleanup()
                    callback(new Error(`Tracker request timeout after ${maxRetries + 1} attempts`), null)
                }
            }, timeoutMs)
            
            // Send initial connection request
            log('Sending connection request...')
            udpSend(socket, buildConnReq(), url, (err) => {
                if (err) {
                    cleanup()
                    callback(err, null)
                }
            })
        }
        
        // Handle socket errors
        socket.on('error', (err) => {
            log('Socket error:', err.message)
            cleanup()
            callback(err, null)
        })
        
        // Handle incoming messages
        socket.on('message', (response, rinfo) => {
            const elapsed = Date.now() - requestStartTime
            log(`Received ${response.length} bytes from ${rinfo.address}:${rinfo.port} after ${elapsed}ms`)
            log('Response hex:', response.toString('hex'))
            
            try {
                const type = respType(response)
                log('Response type:', type)
                
                if (type === 'error') {
                    const error = handleErrorResponse(response)
                    cleanup()
                    callback(error, null)
                    return
                }
                
                if (type === 'connect') {
                    log('Processing connect response...')
                    const connResp = parseConnResp(response)
                    connectionId = connResp.connectionId
                    log('Connection established, sending announce request...')
                    const announceReq = buildAnnounceReq(connectionId, torrent)
                    udpSend(socket, announceReq, url, (err) => {
                        if (err) {
                            cleanup()
                            callback(err, null)
                        }
                    })
                } else if (type === 'announce') {
                    log('Processing announce response...')
                    const announceResp = parseAnnounceResp(response)
                    cleanup()
                    
                    if (!announceResp.peers || !Array.isArray(announceResp.peers)) {
                        callback(new Error('Invalid peers data received'), null)
                        return
                    }
                    
                    log(`Successfully got ${announceResp.peers.length} peers from tracker`)
                    callback(null, announceResp.peers)
                } else {
                    log('Unknown response type, ignoring')
                }
            } catch (err) {
                log('Error processing response:', err.message)
                cleanup()
                callback(err, null)
            }
        })
        
        // Bind socket to random port and start request
        socket.bind(() => {
            const address = socket.address()
            log(`Socket bound to ${address.address}:${address.port}`)
            startRequest()
        })
    }
    
    tryNextTracker()
}

export default getPeers

