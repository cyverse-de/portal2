const { createLogger, format, transports, addColors } = require('winston')
const { combine, timestamp, label, printf, colorize } = format
const expressWinston = require('express-winston')
const { getUserID } = require('./auth')
const config = require('../../lib/config')

//TODO move to config file
const logLevel = 'debug'
const logLabel = config.NODE_ENV == 'production' ? 'PROD' : 'DEV'

const formatMeta = meta => {
    const splat = meta[Symbol.for('splat')]
    if (splat && splat.length) return splat.join(' ')
    return ''
}

const logFormat = printf(
    ({ level, message, label, timestamp, ...meta }) =>
        `${timestamp} [${label}] ${level}: ${message} ${formatMeta(meta)}`
)

const logger = createLogger({
    level: logLevel,
    format: combine(
        label({ label: logLabel }),
        timestamp(),
        logFormat,
        colorize({ all: true })
    ),
    transports: [new transports.Console()],
})

addColors({
    error: 'red',
    warn: 'yellow',
    info: 'cyan',
    debug: 'green',
})

const getLoggableUserID = req => getUserID(req) || 'logged-out-user'

const requestLogger = expressWinston.logger({
    transports: [new transports.Console()],
    msg: (req, res) => {
        const body = req && req.body ? JSON.stringify(req.body) : ''
        return (
            `HTTP ${req.ip} ${getLoggableUserID(req)} ${req.method} ${
                req.url
            } ${res.statusCode} ${res.responseTime}ms` +
            (body.length > 2 ? '\n' + body : '')
        ) // ignore empty body [] or {}
    },
    format: combine(
        label({ label: logLabel }),
        timestamp(),
        logFormat,
        colorize({ all: true })
    ),
})

const errorLogger = expressWinston.errorLogger({
    transports: [new transports.Console()],
    msg: (req, res, err) =>
        `HTTP Error ${req.ip} ${getLoggableUserID(req)} ${req.method} ${
            req.url
        } ${err.message} ${res.statusCode} ${res.responseTime}ms`,
    format: combine(
        label({ label: logLabel }),
        timestamp(),
        logFormat,
        colorize({ all: true })
    ),
})

module.exports = { logger, requestLogger, errorLogger }
