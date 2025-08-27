const crypto = require('crypto')
const config = require('../../lib/config')

const ALGO = 'aes-256-cbc'

function key() {
    if (!config.HMAC_KEY) throw 'Missing HMAC_KEY in config'

    const hash = crypto.createHash('sha256')
    hash.update(config.HMAC_KEY)
    return hash.digest().slice(0, 32)
}

// Emulating Portal v1 HMAC.  Not really a true HMAC, just basic encryption.
function generateHMAC(data) {
    const cipher = crypto.createCipheriv(ALGO, key(), key().slice(0, 16)) //FIXME use a better IV
    let crypted = cipher.update(data.toString(), 'utf8', 'hex')
    crypted += cipher.final('hex')
    return crypted
}

function decodeHMAC(hmac) {
    const encryptedText = Buffer.from(hmac, 'hex')
    const decipher = crypto.createDecipheriv(ALGO, key(), key().slice(0, 16)) //FIXME use a better IV
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}

function generateToken(key) {
    const MAX_AGE = 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds
    const expires = Date.now() + MAX_AGE
    return generateHMAC(JSON.stringify({ key, expires }))
}

function decodeToken(hmac) {
    const json = decodeHMAC(hmac)
    const obj = JSON.parse(json)
    if (typeof obj !== 'object') throw 'Invalid HMAC (1)'
    if (!('key' in obj) || !('expires' in obj)) throw 'Invalid HMAC (2)'
    if (isNaN(obj.expires)) throw 'Invalid HMAC (3)'
    if (Date.now() > obj.expires) throw 'Expired HMAC'

    return obj.key
}

module.exports = {
    generateHMAC,
    decodeHMAC,
    generateToken,
    decodeToken,
}
