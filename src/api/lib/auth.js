const models = require('../models')
const config = require('../../lib/config')
const User = models.account_user

const getUserToken = req => {
    const keycloakToken =
        req && req.kauth && req.kauth.grant && req.kauth.grant.access_token
            ? req.kauth.grant.access_token
            : null //req?.kauth?.grant?.access_token
    // console.log('keycloak token:', keycloakToken != null)
    return keycloakToken
}

const getUserID = req => {
    const accessToken = getUserToken(req)
    return accessToken && accessToken.content
        ? accessToken.content.preferred_username
        : null //req?.kauth?.grant?.access_token?.content?.preferred_username
}

const getUser = async (req, _, next) => {
    const userId = config.DEBUG_USER || getUserID(req)
    if (userId) {
        const user = await User.findOne({ where: { username: userId } })
        if (!user)
            // should never happen
            return
        req.user = JSON.parse(JSON.stringify(user.get({ plain: true })))
    }
    if (next) next()
}

const isAdmin = req => req && req.user && req.user.is_staff

const requireAdmin = async (req, res, next) => {
    if (!req.user) await getUser(req)
    if (!req.user || !req.user.is_staff)
        res.status(403).send('User not authorized')
    else if (next) next()
}

const requireAuth = async (req, res, next) => {
    if (!getUserID(req)) res.status(401).send('Unauthorized')
    else if (next) next()
}

// Handle promise exceptions in Express.  Not really auth related but used all over the place.
// From https://zellwk.com/blog/async-await-express/
const asyncHandler = fn => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = {
    getUserToken,
    getUserID,
    getUser,
    isAdmin,
    requireAdmin,
    requireAuth,
    asyncHandler,
}
