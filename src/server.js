const http = require('http')
const { EventEmitter } = require('events')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const session = require('express-session')
const pgsimple = require('connect-pg-simple')
const Sentry = require('@sentry/node')
const Keycloak = require('keycloak-connect')
const next = require('next')
const { logger, requestLogger, errorLogger } = require('./api/lib/logging')
const { WS_CONNECTED } = require('./constants/client')
const { getUserID, getUserToken, requireAuth } = require('./api/lib/auth')
const { securityHeaders } = require('./api/lib/securityHeaders')
const { corsOptionsFromConfig } = require('./api/lib/corsOptions')
const {
    regenerateSessionOnLogin,
    installLogoutSessionDestroy,
} = require('./api/lib/sessionSecurity')
const PortalAPI = require('./lib/apiClient')
const ws = require('ws')
const config = require('./api/lib/config')

// Initialize configuration
config.init()
const serverConfig = config.getServerConfig()
const sentryConfig = config.getSentryConfig()

const isDevelopment = serverConfig.isDevelopment

// Next.js and express-ws both accept websocket upgrades. Give each one its own
// upgrade channel, so that only one of them handles a given socket.
const nextUpgrades = new EventEmitter()
const appUpgrades = new EventEmitter()
const app = next({ dev: isDevelopment, httpServer: nextUpgrades })
const nextHandler = app.getRequestHandler()

// Configure Sentry error tracking -- should be done as early as possible
if (sentryConfig.dsn) {
    Sentry.init({
        dsn: sentryConfig.dsn,
        environment:
            process.env.NODE_ENV ||
            (isDevelopment ? 'development' : 'production'),
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
const dbConfig = config.getDbConfig()
const pgUrl = buildPostgresUrl({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.name,
    user: dbConfig.user,
    password: dbConfig.password,
})
const sessionConfig = config.getSessionConfig()
const sessionStore = new pgSession({
    conString: pgUrl,
    tableName: dbConfig.sessionTable,
    ttl: sessionConfig.ttl,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
})

// Configure the Keycloak client
Keycloak.prototype.accessDenied = function (request, response) {
    console.log('Access denied, redirecting !!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    const uiConfig = config.getUiConfig()
    response.redirect(uiConfig.baseUrl)
    //response.status(403);
    //response.end('Access denied');
}
const keycloakConfig = config.getKeycloakConfig()
const keycloakClient = new Keycloak(
    { store: sessionStore },
    {
        realm: keycloakConfig.realm,
        'auth-server-url': keycloakConfig.authUrl,
        'ssl-required': 'all',
        resource: keycloakConfig.client,
        credentials: {
            secret: keycloakConfig.secret,
        },
        'confidential-port': 0,
    }
)

app.prepare()
    .then(() => {
        const server = express()
        const httpServer = http.createServer(server)
        require('express-ws')(server, appUpgrades)

        httpServer.on('upgrade', (req, socket, head) => {
            const target = req.url.startsWith('/_next/')
                ? nextUpgrades
                : appUpgrades

            target.emit('upgrade', req, socket, head)
        })

        const sockets = {} // Track websocket connections by username

        // Security headers on every response (applied first)
        server.use(securityHeaders)

        // Setup logging
        server.use(errorLogger)
        server.use(requestLogger)

        // Setup Sentry error handling
        if (sentryConfig.dsn) server.use(Sentry.Handlers.requestHandler())

        // CORS restricted to an allowlist (the UI origin plus configured
        // extras); credentials are never reflected cross-origin.
        server.use(
            cors(
                corsOptionsFromConfig({
                    uiBaseUrl: config.getUiConfig().baseUrl,
                    allowedOrigins: config.getCorsConfig().allowedOrigins,
                })
            )
        )

        // Support JSON encoded request bodies
        server.use(bodyParser.json())

        // Configure sessions
        server.use(
            session({
                store: sessionStore,
                secret: sessionConfig.secret,
                resave: false,
                saveUninitialized: true,
                cookie: {
                    secure: sessionConfig.secureCookie,
                    // Lax is the strongest setting compatible with Keycloak's
                    // redirect login (the cookie must ride the top-level GET
                    // navigation back from the IdP); it blocks the session
                    // cookie on cross-site subrequests (CSRF).
                    sameSite: 'lax',
                },
            })
        )

        // Configure Express behind SSL proxy: https://expressjs.com/en/guide/behind-proxies.html
        // Also set "proxy_set_header X-Forwarded-Proto https;" in NGINX config
        server.set('trust proxy', true)

        // Configure Keycloak
        server.use(keycloakClient.middleware({ logout: '/logout' }))

        // Rotate the session ID after login; destroy it on logout (fixation)
        installLogoutSessionDestroy(keycloakClient)
        server.use(regenerateSessionOnLogin)

        // Setup API client for use by getServerSideProps() - MOVED HERE to ensure it runs for all requests
        server.use(async (req, _, next) => {
            try {
                const token = getUserToken(req)
                // For server-side requests, we need an absolute URL
                // Use the request's host header to build the URL
                const protocol =
                    req.secure || req.headers['x-forwarded-proto'] === 'https'
                        ? 'https'
                        : 'http'
                const host = req.headers.host || 'localhost:3000'
                const serverBaseUrl = `${protocol}://${host}/api`

                req.api = new PortalAPI({
                    baseUrl: serverBaseUrl,
                    token: token ? token.token : null,
                })
            } catch (error) {
                console.error('Failed to initialize API client:', error)
                // Always ensure req.api exists, even if initialization failed
                req.api = new PortalAPI({
                    baseUrl: 'http://localhost:3000/api',
                    token: null,
                })
            }
            next()
        })

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
        server.use('/api/async', requireAuth, require('./api/async'))
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
            const username = getUserID(req)
            if (username) {
                sockets[username] = ws

                ws.on('close', () => {
                    delete sockets[username]
                })
            }

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
        if (sentryConfig.dsn) server.use(Sentry.Handlers.errorHandler())

        httpServer.listen(serverConfig.port, err => {
            if (err) throw err
            if (isDevelopment)
                console.log('!!!!!!!!! RUNNING IN DEV MODE !!!!!!!!!!')
            console.log(`Ready on port ${serverConfig.port}`)
        })
    })
    .catch(exception => {
        logger.error(exception.stack)
        process.exit(1)
    })
