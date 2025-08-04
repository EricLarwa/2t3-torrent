'use strict'

import net from 'net'
import Buffer from 'buffer'
import getPeers from './tracker'

const message = import('./message.js');

const torrent = () => {
    getPeers(torrent, peers => {
        peers.forEach(download)
    })
}

function download(peer) {
    const socket = net.Socket()

    socket.on('error', console.log)
    socket.connect(peer.port, peer.ip, () => {
        socket.write(message.buildHandshake(torrent))
    })

    onWholeMsg(socket, msg => msgHandler(msg, socket))
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

function msgHandler(msg, socket) {
    if (isHandshake(msg)) {
        socket.write(message.buildInterested())
    } else {
        const m = message.parse(msg)

        if(m.id === 0) {chokeHandler()}
        else if(m.id === 1) {unchokeHandler()}
        else if(m.id === 4) {haveHandler(m)}
        else if(m.id === 5) {bitfieldHandler(m)}
        else if(m.id === 7) {pieceHandler(m, socket)}
    }
}
function haveHandler(payload, socket, requested) {
  // ...
  const pieceIndex = payload.readUInt32BE(0);
  if (!requested[pieceIndex]) {
    socket.write(message.buildRequest(...));
  }
  requested[pieceIndex] = true;
}