const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const session = require('express-session')
const pgsimple = require('connect-pg-simple')
const Sentry = require('@sentry/node')
const Keycloak = require('keycloak-connect')
const next = require('next')
const { logger, requestLogger, errorLogger } = require('./api/lib/logging')
const { WS_CONNECTED } = require('./constants')
const { getUserID, getUserToken, requireAuth } = require('./api/lib/auth')
const PortalAPI = require('./lib/apiClient')
const ws = require('ws')
const config = require('./lib/config')

const isDevelopment = config.NODE_ENV !== 'production'
const app = next({ dev: isDevelopment })
const nextHandler = app.getRequestHandler()

// Configure Sentry error tracking -- should be done as early as possible
if (config.SENTRY_DSN) {
    Sentry.init({
        dsn: config.SENTRY_DSN,
        environment: config.NODE_ENV,
    })
} else {
    console.log('Sentry is disabled')
}

// Build a Postgres database URL.
function buildPostgresUrl(settings) {
    const { host, port, database, user, password } = settings
    const encodedPassword = password ? encodeURIComponent(password) : ''
    const auth = !user
        ? ''
        : !encodedPassword
        ? user
        : `${user}:${encodedPassword}`
    return auth
        ? `postgresql://${auth}@${host}:${port}/${database}`
        : `postgresql://${host}:${port}/${database}`
}

// Configure the session store
const pgSession = pgsimple(session)
const pgUrl = buildPostgresUrl({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
})
const sessionStore = new pgSession({
    conString: pgUrl,
    tableName: config.DB_SESSION_TABLE,
    ttl: config.SESSION_TTL,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
})

// Configure the Keycloak client
Keycloak.prototype.accessDenied = function (request, response) {
    console.log('Access denied, redirecting !!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    response.redirect(config.UI_BASE_URL)
    //response.status(403);
    //response.end('Access denied');
}
const keycloakClient = new Keycloak(
    { store: sessionStore },
    {
        realm: config.KEYCLOAK_REALM,
        'auth-server-url': config.KEYCLOAK_AUTH_URL,
        'ssl-required': 'all',
        resource: config.KEYCLOAK_CLIENT,
        credentials: {
            secret: config.KEYCLOAK_SECRET,
        },
        'confidential-port': 0,
    }
)

app.prepare()
    .then(() => {
        const server = express()
        const expressWS = require('express-ws')(server)

        // Setup logging
        server.use(errorLogger)
        server.use(requestLogger)

        // Setup Sentry error handling
        if (config.SENTRY_DSN) server.use(Sentry.Handlers.requestHandler())

        // Support CORS requests -- needed for service icon image requests
        server.use(cors())

        // Support JSON encoded request bodies
        server.use(bodyParser.json())

        // Configure sessions
        server.use(
            session({
                store: sessionStore,
                secret: config.SESSION_SECRET,
                resave: false,
                saveUninitialized: true,
                cookie: {
                    secure:
                        config.SESSION_SECURE_COOKIE.toLowerCase() === 'true',
                },
            })
        )

        // Configure Express behind SSL proxy: https://expressjs.com/en/guide/behind-proxies.html
        // Also set "proxy_set_header X-Forwarded-Proto https;" in NGINX config
        server.set('trust proxy', true)

        // Configure Keycloak
        server.use(keycloakClient.middleware({ logout: '/logout' }))

        // For "sign in" button on landing page
        server.get('/login', keycloakClient.protect(), (_, res) => {
            res.redirect('/')
        })

        // Public static files
        server.get('/*.(svg|ico|png|gif|jpg)', (req, res) => {
            return nextHandler(req, res)
        })

        //if (isDevelopment)
        server.get('/_next/*', (req, res) => {
            return nextHandler(req, res)
        })
        //else
        //    server.get("/_next/static/*", (req, res) => {
        //        return nextHandler(req, res)
        //    })

        // Setup API client for use by getServerSideProps()
        server.use(async (req, _, next) => {
            const token = getUserToken(req)
            req.api = new PortalAPI({
                baseUrl: config.API_BASE_URL,
                token: token ? token.token : null,
            })
            next()
        })

        // Save web socket handle
        server.use((req, _, next) => {
            const username = getUserID(req)
            req.ws = sockets[username]
            next()
        })

        // Default to landing page if not logged in
        server.get('/', keycloakClient.checkSso(), (req, res) => {
            const token = getUserToken(req)
            if (token) res.redirect('/services')
            else app.render(req, res, '/welcome')
        })

        // Public UI pages
        server.get(['/signup', '/register'], (req, res) => {
            app.render(req, res, '/welcome', { signup: 1 })
        })

        server.get(['/forgot', '/password/forgot'], (req, res) => {
            // /password/forgot for old links from DE/CAS
            app.render(req, res, '/welcome', { forgot: 1 })
        })

        server.get('/password', (req, res) => {
            app.render(req, res, '/password')
        })

        server.get('/confirm_email', (req, res) => {
            app.render(req, res, '/confirm_email')
        })

        // Public API routes
        server.use('/api', require('./api/public'))
        if (isDevelopment) server.use('/api/tests', require('./api/tests'))

        // Restricted API routes
        server.use('/api/users', requireAuth, require('./api/users'))
        server.use('/api/services', requireAuth, require('./api/services'))
        server.use('/api/workshops', requireAuth, require('./api/workshops'))
        server.use('/api/forms', requireAuth, require('./api/forms'))
        server.use(
            '/api/mailing_lists',
            requireAuth,
            require('./api/mailing_lists')
        )
        server.use('/api/*', (_, res) =>
            res.status(404).send('Resource not found')
        )

        // Require auth on all routes/page after this
        server.use(keycloakClient.protect())

        // Restricted UI pages
        server.get('/forms*', (req, res) => {
            // alias "/requests" as "/forms" for old links on cyverse.org
            var url = req.url.replace(/^\/forms/, '/requests')
            app.render(req, res, url)
        })
        server.get('/workshops/:id(\\d+)/overview', (req, res) => {
            // aliases for old links on cyverse.org
            res.redirect(`/workshops/${req.params.id}`)
        })
        server.get(
            [
                '/services/mine',
                '/services/available',
                '/services/powered-services',
            ],
            (req, res) => {
                // aliases for old links on cyverse.org
                res.redirect('/services')
            }
        )
        server.get('*', (req, res) => {
            // all other pages
            return nextHandler(req, res)
        })

        server.ws('/', function (ws, req) {
            ws.send(
                JSON.stringify({
                    type: WS_CONNECTED,
                    data: {
                        key: req.headers['sec-websocket-key'],
                    },
                })
            )
        })

        // Catch errors
        if (config.SENTRY_DSN) server.use(Sentry.Handlers.errorHandler())

        server.listen(config.SERVER_PORT, err => {
            if (err) throw err
            if (isDevelopment)
                console.log('!!!!!!!!! RUNNING IN DEV MODE !!!!!!!!!!')
            if (config.DEBUG_USER)
                console.log(
                    '!!!!!!!!! EMULATING USER',
                    config.DEBUG_USER,
                    '!!!!!!!!!!'
                )
            console.log(`Ready on port ${config.SERVER_PORT}`)
        })
    })
    .catch(exception => {
        logger.error(exception.stack)
        process.exit(1)
    })
