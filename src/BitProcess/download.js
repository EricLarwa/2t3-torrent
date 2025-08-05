'use strict'

import net from 'net'
import fs from 'fs'
import path from 'path'
import { Buffer } from 'buffer'
import getPeers from './tracker.js'

import message from './message.js'
import Pieces from './pieces.js'
import Queue from './Queue.js'

export default (torrent, downloadPath, progressCallback) => {
    getPeers(torrent, (err, peers) => {
    if (err) {
        console.error('Error getting peers:', err)
        if (progressCallback) progressCallback({ error: err.message })
        return
    }

    if (!peers || !Array.isArray(peers)) {
        console.error('Invalid peers data:', peers)
    if (progressCallback) progressCallback({ error: 'No valid peers found' })
        return
    }

    if (peers.length === 0) {
        console.log('No peers found')
        if (progressCallback) progressCallback({ error: 'No peers available' })
        return
    }

    console.log(`Found ${peers.length} peers`)
    const pieces = new Pieces(torrent)
    
    // Handle file path creation properly
    let filePath
    try {
      // Get the torrent name
        const torrentName = torrent.info.name instanceof Uint8Array
            ? new TextDecoder('utf8').decode(torrent.info.name)
            : torrent.info.name.toString()

      // Check if downloadPath is a directory or file
        const stats = fs.existsSync(downloadPath) ? fs.statSync(downloadPath) : null
        
        if (stats && stats.isDirectory()) {
        // downloadPath is a directory, create file inside it
            filePath = path.join(downloadPath, torrentName)
        } else {
        // downloadPath is a file path or doesn't exist
        
    }
    
      // Ensure the directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    
    console.log('Download file path:', filePath)
    
    } catch (error) {
        console.error('Error setting up file path:', error)
        if (progressCallback) progressCallback({ error: 'Failed to set up download path' })
        return
    }
    
    // Open file for writing
    let file
    try {
        file = fs.openSync(filePath, 'w')
    } catch (error) {
        console.error('Error opening file for writing:', error)
        if (progressCallback) progressCallback({ error: 'Failed to create download file' })
        return
    }
    
    // Limit concurrent connections
    const maxConnections = Math.min(peers.length, 5)
    let activeConnections = 0
    
    peers.slice(0, maxConnections).forEach((peer, index) => {
        setTimeout(() => {
        activeConnections++
        download(peer, torrent, pieces, file, progressCallback, () => {
            activeConnections--
        })
      }, index * 1000) // Stagger connections by 1 second
    })
    })
}

function download(peer, torrent, pieces, file, progressCallback, onDisconnect) {
    const socket = new net.Socket()
    let connected = false

    socket.setTimeout(30000) // 30 second timeout

    socket.on('timeout', () => {
      console.log(`Connection timeout to ${peer.ip}:${peer.port}`)
      socket.destroy()
      if (onDisconnect) onDisconnect()
    })

    socket.on('error', (err) => {
      console.log(`Connection error to ${peer.ip}:${peer.port}:`, err.message)
      if (onDisconnect) onDisconnect()
    })
    
    socket.on('close', () => {
      console.log(`Connection closed to ${peer.ip}:${peer.port}`)
      if (onDisconnect) onDisconnect()
    })

    socket.connect(peer.port, peer.ip, () => {
        console.log(`Connected to peer ${peer.ip}:${peer.port}`)
        connected = true
        socket.write(message.buildHandshake(torrent))
    })

    const queue = new Queue(torrent)
    onWholeMsg(socket, msg => msgHandler(msg, socket, pieces, queue, torrent, file, progressCallback))
}

// Keep existing functions but update pieceHandler for better progress tracking
function pieceHandler(socket, pieces, queue, torrent, file, pieceResp, progressCallback) {
    console.log('Received piece:', pieceResp.index)
    pieces.addReceived(pieceResp)

    const offset = pieceResp.index * torrent.info['piece length'] + pieceResp.begin
    
    try {
      fs.writeSync(file, pieceResp.block, 0, pieceResp.block.length, offset)
    } catch (error) {
      console.error('Error writing to file:', error)
      return
    }

    // Send progress update
    if (progressCallback) {
        const totalPieces = Math.ceil(torrent.info.pieces.length / 20)
        const completedPieces = pieces.received.filter(piece => 
          Array.isArray(piece) ? piece.every(block => block) : false
        ).length
        const percentage = (completedPieces / totalPieces) * 100
        
        progressCallback({
            percentage: Math.min(percentage, 100),
            completed: completedPieces,
            total: totalPieces,
            downloaded: completedPieces * torrent.info['piece length'],
            speed: 0, // You can implement speed calculation
            peers: 1
        })
    }

    if (pieces.isDone()) {
        console.log('DOWNLOAD COMPLETE!')
        socket.end()
        try { 
          fs.closeSync(file)
          console.log('File closed successfully')
        } catch(e) {
          console.error('Error closing file:', e)
        }
        if (progressCallback) {
            progressCallback({ 
              percentage: 100, 
              completed: true,
              message: 'Download completed successfully!'
            })
        }
    } else {
        requestPiece(socket, pieces, queue)
    }
}

function onWholeMsg(socket, callback) {
    let savedBuf = Buffer.alloc(0)
    let handshake = true

    socket.on('data', recvBuf => {
        const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 :
        savedBuf.readUInt32BE(0) + 4;
        savedBuf = Buffer.concat([savedBuf, recvBuf]);
        
        while(savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
            callback(savedBuf.slice(0, msgLen()))
            savedBuf = savedBuf.slice(msgLen())
            handshake = false
        }
    })
}

function isHandshake(msg) {
    return msg.length === msg.readUInt8(0) + 49 &&
    msg.toString('utf8', 1, 20) === 'BitTorrent protocol'
}

function msgHandler(msg, socket, pieces, queue, torrent, file, progressCallback) {
    if (isHandshake(msg)) {
        socket.write(message.buildInterested())
    } else {
        const m = message.parse(msg)

        if(m.id === 0) {chokeHandler(socket)}
        else if(m.id === 1) {unchokeHandler(socket, pieces, queue)}
        else if(m.id === 4) {haveHandler(m.payload, socket, pieces, queue)}
        else if(m.id === 5) {bitfieldHandler(socket, pieces, queue, m.payload)}
        else if(m.id === 7) {pieceHandler(socket, pieces, queue, torrent, file, m.payload, progressCallback)}
    }
}

function bitfieldHandler(socket, pieces, queue, payload) {
    const queueEmpty = queue.length() === 0;
    payload.forEach((byte, i) => {
        for (let j = 0; j < 8; j++) {
            if (byte % 2) queue.queue(i * 8 + 7 - j);
            byte = Math.floor(byte / 2);
        }
    });

    if (queueEmpty) requestPiece(socket, pieces, queue);
}

function haveHandler(payload, socket, pieces, queue) {
    const pieceIndex = payload.readUInt32BE(0);
    const queueEmpty = queue.length() === 0;
    queue.queue(pieceIndex);
    if (queueEmpty) { requestPiece(socket, pieces, queue) }
}

function chokeHandler(socket) {
    socket.end()
}

function unchokeHandler(socket, pieces, queue) {
    queue.choked = false
    requestPiece(socket, pieces, queue)
}

function requestPiece(socket, pieces, queue) {
    if(queue.choked) {
        return null
    }

    while (queue.length()) {
        const pieceBlock = queue.deque()
        if (pieces.needed(pieceBlock)) {
            socket.write(message.buildRequest(pieceBlock));
            pieces.addRequested(pieceBlock);
            break;
        }
    }
}