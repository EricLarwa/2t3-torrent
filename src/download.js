'use strict'

import net from 'net'
import Buffer from 'buffer'
import getPeers from './tracker'

const message = import('./message.js');
const Pieces = import('./pieces.js');
const Queue = import('./Queue.js');

const torrent = () => {
    getPeers(torrent, peers => {
        const pieces = new Pieces(torrent)
        peers.forEach(peer => download(peer, torrent, pieces))
    })
}

function download(peer, torrent, pieces) {
    const socket = net.Socket()

    socket.on('error', console.log)
    socket.connect(peer.port, peer.ip, () => {
        socket.write(message.buildHandshake(torrent))
    })

    const queue = new Queue(torrent)
    onWholeMsg(socket, msg => msgHandler(msg, socket, pieces, queue))
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

function msgHandler(msg, socket, pieces, queue) {
    if (isHandshake(msg)) {
        socket.write(message.buildInterested())
    } else {
        const m = message.parse(msg)

        if(m.id === 0) {chokeHandler(socket)}
        else if(m.id === 1) {unchokeHandler(socket, pieces, queue)}
        else if(m.id === 4) {haveHandler(m.payload)}
        else if(m.id === 5) {bitfieldHandler(m.payload)}
        else if(m.id === 7) {pieceHandler(m.payload)}
    }
}
function haveHandler(payload, socket, requested) {
  // ...
  const pieceIndex = payload.readUInt32BE(0);
  if (!requested[pieceIndex]) {
    socket.write(message.buildRequest());
  }
  requested[pieceIndex] = true;
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