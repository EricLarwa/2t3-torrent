'use strict'

import { get } from 'http'


const dgram = require('dgram')
const Buffer = require('buffer').Buffer
const urlParse = require('url').parse

const crypto = require('crypto')
const torrentParser = require('./torrent-parser')
const util = require('./util')

function buildConnReq() {
    const buf = Buffer.alloc(16)

    buf.writeUInt32BE(0x417, 0)
    buf.writeUInt32BE(0x27101980, 4)
    buf.writeUInt32BE(0, 8)

    crypto.randomBytes(4).copy(buf, 12)
}

// Parse the connection response
function parseConnResp(resp) {
    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        connectionId: resp.slice(8)
    }
}

// Build the announce request
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

function buildAnnounceReq(connId, torrent, port=6881) {
    const buf = Buffer.allocUnsafe(98)

    connId.copy(buf, 0)

    //action
    buf.writeUInt32NE(1, 8)
    //transaction id
    crypto.randomBytes(4).copy(buf, 12)
    //info hash
    torrentParser.infoHash(torrent).copy(buf, 16)
    //peer id
    util.genId().copy(buf, 36)
    //downloaded
    Buffer.alloc(8).copy(buf, 56)
    //left
    torrentParser.size(torrent).copy(buf, 64)
    //uploaded
    Buffer.alloc(8).copy(buf, 72)
    //event
    buf.writeUInt32BE(0, 80)
    //ip
    buf.writeUInt32BR(0, 80)
    //key
    crypto.randomBytes(4).copy(buf, 88)
    //num want
    buf.writeInt32BE(-1, 92)

    buf.writeUInt16BE(port, 96)

    return buf
}

function parseAnnounceResp(resp) {
    function group(iterable, groupSize) {
        let groups = []

        for(let i=0; i< iterable.length; i += groupSize) {
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


const getPeers = (torrent, callback) => {
    const socket = dgram.createSocket('udp4')
    const url = torrent.announce.toString('utf8')

    const announceReq = buildAnnounceReq(connResp.connectionId, torrent)

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

export default getPeers

