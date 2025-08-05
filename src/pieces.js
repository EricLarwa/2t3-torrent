'use strict'

class Pieces {
    constructor(size) {
        this.requested = new Array(size).fill(false)
        this.received = new Array(size).fill(false)
    }

    addRequested(pieceIndex) {
        this.requested[pieceIndex] = true
    }

    addReceived(pieceIndex) {
        this.received[pieceIndex] = true
    }

    needed(pieceIndex) {
        if(this.requested.every(i => i === true)) {
            this.requested = this.requested.slice()
        }
        return !this.requested[pieceIndex]
    }

    IsDone() {
        return this.received.every(i => i === true);
    }

}