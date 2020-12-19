const { createLogger, format, transports, addColors } = require('winston')
const { combine, timestamp, label, printf, colorize } = format
const expressWinston = require("express-winston")
const { getUserID } = require("./auth")

//TODO move to config file
const logLevel = 'debug'
const logLabel = (process.env.NODE_ENV == 'production' ? 'PROD' : 'DEV')

const formatMeta = (meta) => {
    const splat = meta[Symbol.for('splat')];
    if (splat && splat.length)
        return splat.join(' ');
    return '';
};

const logFormat = printf(
    ({ level, message, label, timestamp, ...meta }) =>
        `${timestamp} [${label}] ${level}: ${message} ${formatMeta(meta)}`
)

const logger = createLogger({
    level: logLevel,
    format: combine(label({ label: logLabel }), timestamp(), logFormat, colorize({ all: true })),
    transports: [new transports.Console()]
})

addColors({
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'green'
})

const getLoggableUserID = (req) => getUserID(req) || "logged-out-user"

const requestLogger = expressWinston.logger({
  transports: [new transports.Console()],
  msg: (req, res) => {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // due to NGINX
      const body = JSON.stringify(req.body);
      return `HTTP ${ip} ${getLoggableUserID(req)} ${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms` +
          (body.length > 2 ? "\n" + body : '');
  },
  format: combine(label({ label: logLabel }), timestamp(), logFormat, colorize({ all: true })),
})

const errorLogger = expressWinston.errorLogger({
  transports: [new transports.Console()],
  msg: (req, res, err) => {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // due to NGINX
      return `HTTP Error ${ip} ${getLoggableUserID(req)} ${req.method} ${req.url} ${err.message} ${res.statusCode} ${res.responseTime}ms`;
  },
  format: combine(label({ label: logLabel }), timestamp(), logFormat, colorize({ all: true })),
})

module.exports = { logger, requestLogger, errorLogger }