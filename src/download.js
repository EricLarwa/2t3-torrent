'use strict'

import net from 'net'
import Buffer from 'buffer'

import getPeers from './tracker'

const torrent = () => {
    getPeers(torrent, peers => {
        peers.forEach(download)
    })
}

function download(peer) {
    const socket = net.Socket()

    socket.on('error', console.log)
    socket.connect(peer.port, peer.ip, () => {
        socket.write(Buffer.from('Hello, peer!'))
    })

    socket.on('data', data => {
        console.log(`Received data from peer ${peer.ip}:${peer.port}:`, data)
        
    })
}