const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const session = require('express-session')
const pgsimple = require('connect-pg-simple')
const Sentry = require("@sentry/node");
const Keycloak = require('keycloak-connect')
const next = require('next')
const { logger, requestLogger, errorLogger } = require('./api/lib/logging')
const { WS_CONNECTED } = require('./constants')
const { getUserID, getUserToken, requireAuth } = require('./api/lib/auth')
const PortalAPI = require('./lib/apiClient')
const ws = require('ws')

const isDevelopment = process.env.NODE_ENV !== 'production'
const app = next({ dev: isDevelopment })
const nextHandler = app.getRequestHandler()

// Configure Sentry error tracking -- should be done as early as possible
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV
    });
}
else {
    console.log('Sentry is disabled')
}

// Build a Postgres database URL.
function buildPostgresUrl(settings) {
    const { host, port, database, user, password} = settings;
    const encodedPassword = password ? encodeURIComponent(password) : '';
    const auth = !user ? '' : !encodedPassword ? user : `${user}:${encodedPassword}`;
    return auth
        ? `postgresql://${auth}@${host}:${port}/${database}`
        : `postgresql://${host}:${port}/${database}`;
}

// Configure the session store
const pgSession = pgsimple(session)
const pgUrl = buildPostgresUrl({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
})
const sessionStore = new pgSession({
    conString: pgUrl,
    tableName: process.env.DB_SESSION_TABLE,
    ttl: process.env.SESSION_TTL,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
})

// Configure the Keycloak client
Keycloak.prototype.accessDenied = function (request, response) {
    console.log('Access denied, redirecting !!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    response.redirect(process.env.UI_BASE_URL);
    //response.status(403);
    //response.end('Access denied');
};
const keycloakClient = new Keycloak(
    { store: sessionStore },
    {
        "realm": process.env.KEYCLOAK_REALM,
        "auth-server-url": process.env.KEYCLOAK_AUTH_URL,
        "ssl-required": "all",
        "resource": process.env.KEYCLOAK_CLIENT,
        "credentials": {
            "secret": process.env.KEYCLOAK_SECRET
        },
        "confidential-port": 0
    }

)

// Configure web socket server
const wsServer = new ws.Server({ port: process.env.WS_PORT })
const sockets = {}
wsServer.on('connection', (ws, req) => {
    const username = req.url.substr(1) //TODO consider using express-ws package for routing
    console.log(`Connection from username=${username} ip=${req.connection.remoteAddress} key=${req.headers['sec-websocket-key']}`)

    sockets[username] = ws

    // ws.on('message', (message) => {
    //     console.log('Socket received:', message)
    // })

    ws.send(JSON.stringify({
        type: WS_CONNECTED,
        data: {
            key: req.headers['sec-websocket-key']
        }
    }))
})

app.prepare()
    .then(() => {
        const server = express()

        // Setup logging
        server.use(errorLogger)
        server.use(requestLogger)

        // Setup Sentry error handling
        if (process.env.SENTRY_DSN)
            server.use(Sentry.Handlers.requestHandler());

        // Support CORS requests -- needed for service icon image requests
        server.use(cors())

        // Support JSON encoded request bodies
        server.use(bodyParser.json())

        // Configure sessions
        server.use(
            session({
                store: sessionStore,
                secret: process.env.SESSION_SECRET,
                resave: false,
                saveUninitialized: true,
                cookie: {
                    secure: process.env.SESSION_SECURE_COOKIE.toLowerCase() === 'true',
                }
            })
        )

        // Configure Express behind SSL proxy: https://expressjs.com/en/guide/behind-proxies.html
        // Also set "proxy_set_header X-Forwarded-Proto https;" in NGINX config
        server.set('trust proxy', true)

        // Configure Keycloak
        server.use(keycloakClient.middleware({ logout: '/logout' }))

        // For "sign in" button on landing page
        server.get("/login", keycloakClient.protect(), (_, res) => {
            res.redirect("/")
        })

        // Public static files
        server.get("/*.(svg|ico|png|gif|jpg)", (req, res) => {
            return nextHandler(req, res)
        })

        //if (isDevelopment)
            server.get("/_next/*", (req, res) => {
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
                baseUrl: process.env.API_BASE_URL,
                token: token ? token.token : null
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
        server.get("/", keycloakClient.checkSso(), (req, res) => {
            const token = getUserToken(req)
            if (token)
                res.redirect("/services")
            else
                app.render(req, res, "/welcome")
        })

        // Public UI pages
        server.get(["/signup", "/register"], (req, res) => {
            app.render(req, res, "/welcome", { signup: 1 })
        })

        server.get(["/forgot", "/password/forgot"], (req, res) => { // /password/forgot for old links from DE/CAS
            app.render(req, res, "/welcome", { forgot: 1 })
        })

        server.get("/password", (req, res) => {
            app.render(req, res, "/password")
        })

        server.get("/confirm_email", (req, res) => {
            app.render(req, res, "/confirm_email")
        })

        // Public API routes
        server.use('/api', require('./api/public'))
        if (isDevelopment) server.use('/api/tests', require('./api/tests'))

        // Restricted API routes
        server.use('/api/users', requireAuth, require('./api/users'))
        server.use('/api/services', requireAuth, require('./api/services'))
        server.use('/api/workshops', requireAuth, require('./api/workshops'))
        server.use('/api/forms', requireAuth, require('./api/forms'))
        server.use('/api/mailing_lists', requireAuth, require('./api/mailing_lists'))
        server.use('/api/*', (_, res) => res.status(404).send('Resource not found'))

        // Require auth on all routes/page after this
        /*if (process.env.DEBUG_USER)*/ server.use(keycloakClient.protect())

        // Restricted UI pages
        server.get("/forms*", (req, res) => { // alias "/requests" as "/forms" for old links on cyverse.org
            var url = req.url.replace(/^\/forms/, '/requests')
            app.render(req, res, url)
        })
        server.get("/workshops/:id(\\d+)/overview", (req, res) => { // aliases for old links on cyverse.org
            res.redirect(`/workshops/${req.params.id}`)
        })
        server.get(["/services/mine", "/services/available", "/services/powered-services"], (req, res) => { // aliases for old links on cyverse.org
            res.redirect("/services")
        })
        server.get("*", (req, res) => { // all other pages
            return nextHandler(req, res)
        })

        // Catch errors
        if (process.env.SENTRY_DSN)
            server.use(Sentry.Handlers.errorHandler());

        server.listen(process.env.SERVER_PORT, (err) => {
            if (err) throw err
            if (isDevelopment)
                console.log('!!!!!!!!! RUNNING IN DEV MODE !!!!!!!!!!')
            if (process.env.DEBUG_USER)
                console.log('!!!!!!!!! EMULATING USER', process.env.DEBUG_USER, '!!!!!!!!!!')
            console.log(`Ready on port ${process.env.SERVER_PORT}`)
        })
    })
    .catch(exception => {
        logger.error(exception.stack)
        process.exit(1)
    })
