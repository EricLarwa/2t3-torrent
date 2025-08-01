'use strict'

const dgram = require('dgram')
const { parse } = require('path')
const Buffer = require('buffer').Buffer
const urlParse = require('url').parse
const crypto = require('crypto')

function buildConnReq() {
    const buf = Buffer.alloc(16)

    buf.writeUInt32BE(0x417, 0)
    buf.writeUInt32BE(0x27101980, 4)
    buf.writeUInt32BE(0, 8)

    crypto.randomBytes(4).copy(buf, 12)
}
function udpSend(socket, message, url) {
    const url = urlParse(rawUrl)
    socket.send(message, 0, message.length, url.port, url.host, callback)
}

function respType(resp) {
  // ...
}

function buildConnReq() {
  // ...
}

function parseConnResp(resp) {
  // ...
}

function buildAnnounceReq(connId) {
  // ...
}

function parseAnnounceResp(resp) {
  // ...
}


module.exports.getPeers = (torrent, callback) => {
    const socket = dgram.createSocket('udp4')
    const url = torrent.announce.toString('utf8')

    udpSend(socket, buildConnReq(), url)

    socket.on('message', response => {
        if(respType(response) === 'connect') {
            const connResp = parseConnResp(response)
            const announceReq = buildAnnounceReq(connResp.connectionId)
            udpSend(socket, announceReq, url)
        } else if (respType(response) === 'announce') {
            const announceRep = parseAnnounceResp(response)
            callback(announceRep.peers)
        }
    })
}

