'use strict'

const tp = import('./torrent-parser.js');
class Pieces {
    constructor(torrent) {
        function buildPiecesArray() {
            const nPieces = torrent.info.pieces.length / 20
            const arr = new Array(nPieces).fill(null)

            return arr.map((_, i) => new Array(tp.blocksPerPiece(torrent, i)).fill(false))
        }

        this.requested = buildPiecesArray()
        this.received = buildPiecesArray()
    }

addRequested(pieceBlock) {
    const blockIndex = pieceBlock.begin / tp.BLOCK_LEN;
    this.requested[pieceBlock.index][blockIndex] = true;
  }

  addReceived(pieceBlock) {
    const blockIndex = pieceBlock.begin / tp.BLOCK_LEN;
    this.received[pieceBlock.index][blockIndex] = true;
  }

  needed(pieceBlock) {
    if (this.requested.every(blocks => blocks.every(i => i))) {
      this.requested = this.received.map(blocks => blocks.slice());
    }
    const blockIndex = pieceBlock.begin / tp.BLOCK_LEN;
    return !this.requested[pieceBlock.index][blockIndex];
  }

  isDone() {
    return this.received.every(blocks => blocks.every(i => i));
  }

}