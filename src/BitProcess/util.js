'use strict'

import crypto from 'crypto'

let id = null

// utility constant for generating peer ID
const genId = () => {
    if(!id) {
        id = crypto.randomBytes(20)
        Buffer.from('-ET001-').copy(id, 0)
    }
    return id
}

export default genId