const router = require('express').Router()
const { logger } = require('./lib/logging')
const { requireAdmin, isAdmin, getUser, asyncHandler } = require('./lib/auth')
const { generateToken } = require('./lib/hmac')
const { emailPasswordReset } = require('./lib/email')
const { checkPassword, encodePassword } = require('./lib/password')
const { ldapGetUser, ldapModify } = require('./workflows/native/lib.js')
const {
    userPasswordUpdateWorkflow,
    userDeletionWorkflow,
} = require('./workflows/native/user.js')
const sequelize = require('sequelize')
const models = require('./models')
const config = require('../lib/config')
const User = models.account_user
const RestrictedUsername = models.account_restrictedusername
const PasswordResetRequest = models.account_passwordresetrequest
const EmailAddress = models.account_emailaddress
const Workshop = models.api_workshop
const WorkshopOrganizer = models.api_workshoporganizer
const { UI_ACCOUNT_REVIEW_URL } = require('../constants')

//TODO move into module
const likeAny = (key, vals) =>
    sequelize.where(sequelize.fn('lower', sequelize.col(key)), {
        [sequelize.Op.like]: { [sequelize.Op.any]: vals.map(k => `%${k}%`) },
    })

// Get/search all users (STAFF AND WORKSHOP ORGANIZER ONLY)
router.get(
    '/',
    getUser,
    asyncHandler(async (req, res) => {
        // Check permission
        if (!req.user || !req.user.is_staff) {
            // staff
            if (!Workshop.findOne({ where: { creator_id: req.user.id } })) {
                // workshop host
                if (
                    !WorkshopOrganizer.findOne({
                        where: { organizer_id: req.user.id },
                    })
                ) {
                    // workshop organizer
                    return res.status(403).send('Permission denied')
                }
            }
        }

        const offset = req.query.offset
        const limit = req.query.limit || 10
        const keyword = req.query.keyword
        const keywords =
            keyword &&
            keyword
                .split(' ')
                .filter(k => k)
                .map(k => k.toLowerCase())

        const { count, rows } = await User.unscoped().findAndCountAll({
            where: keyword
                ? sequelize.or(
                      { id: isNaN(keyword) ? 0 : keyword },
                      likeAny('first_name', keywords),
                      likeAny('last_name', keywords),
                      likeAny('username', keywords),
                      likeAny('email', keywords),
                      likeAny('institution', keywords),
                      likeAny('occupation.name', keywords),
                      likeAny('region.name', keywords),
                      likeAny('region.country.name', keywords)
                  )
                : null,
            include: [
                'occupation',
                {
                    model: models.account_region,
                    as: 'region',

                    include: ['country'],
                },
            ],
            attributes: [
                'id',
                'username',
                'first_name',
                'last_name',
                'email',
                'institution',
                'date_joined',
            ],
            order: [['id', 'DESC']],
            offset: offset,
            limit: limit,
            distinct: true,
            subQuery: false,
        })

        res.status(200).json({ count, results: rows })
    })
)

// Get current user based on token
router.get('/mine', getUser, (req, res) => {
    res.status(200).json(req.user)
})

// Get individual user (STAFF ONLY)
router.get(
    '/:usernameOrId(\\w+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const usernameOrId = req.params.usernameOrId
        const scope = req.query.scope || 'defaultScope'

        const user = await User.scope(scope).findOne({
            where: sequelize.or(
                { id: isNaN(usernameOrId) ? 0 : usernameOrId },
                sequelize.where(
                    sequelize.fn('lower', sequelize.col('username')),
                    usernameOrId.toLowerCase()
                )
            ),
        })
        if (!user) return res.status(404).send('User not found')

        res.status(200).json(user)
    })
)

// For Profile Update Reminder: https://cyverse.atlassian.net/wiki/spaces/CNS/pages/1166475265/Profile+Update+Reminder
router.get(
    '/:usernameOrId(\\w+)/status',
    getUser,
    asyncHandler(async (req, res) => {
        const usernameOrId = req.params.usernameOrId

        if (
            !req.user.is_staff &&
            req.user.username != usernameOrId &&
            req.user.id != usernameOrId
        )
            return res.status(403).send('Permission denied')

        const user = await User.findOne({
            where: sequelize.or(
                { id: isNaN(usernameOrId) ? 0 : usernameOrId },
                sequelize.where(
                    sequelize.fn('lower', sequelize.col('username')),
                    usernameOrId.toLowerCase()
                )
            ),
        })
        if (!user) return res.status(404).send('User not found')

        const daysSinceUpdate =
            (Date.now() - new Date(user.updated_at)) / (24 * 60 * 60 * 1000)
        res.status(200).json({
            updated_at: user.updated_at,
            update_required: daysSinceUpdate > config.PROFILE_UPDATE_PERIOD,
            warning_required:
                daysSinceUpdate <= config.PROFILE_UPDATE_PERIOD &&
                daysSinceUpdate >
                    config.PROFILE_UPDATE_PERIOD -
                        config.PROFILE_WARNING_PERIOD,
            update_period: config.PROFILE_UPDATE_PERIOD,
            warning_period: config.PROFILE_WARNING_PERIOD,
            update_text: config.PROFILE_UPDATE_TEXT,
            warning_text: config.PROFILE_WARNING_TEXT,
            update_url: UI_ACCOUNT_REVIEW_URL,
        })
    })
)

// Get individual user's history (STAFF ONLY)
router.get(
    '/:id(\\d+)/history',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const services = await models.api_service.findAll()
        const workshops = await models.api_workshop.findAll()
        const forms = await models.api_form.findAll()
        const user = await User.findByPk(req.params.id, {
            include: [
                'password_reset_requests',
                'password_resets',
                'form_submissions',
                {
                    model: models.api_accessrequest,
                    as: 'access_requests',
                    include: ['logs'],
                },
                {
                    model: models.api_workshopenrollmentrequest,
                    as: 'enrollment_requests',
                    include: ['logs'],
                },
            ],
        })

        let history = []

        history.push({ date: user.date_joined, message: `Account created` })

        history = history.concat(
            user.password_reset_requests.map(r => {
                return {
                    date: r.created_at,
                    message: `Password reset request (HMAC ${r.key})`,
                }
            })
        )
        history = history.concat(
            user.password_resets.map(r => {
                return {
                    date: r.created_at,
                    message: `Password set/reset (HMAC ${r.key})`,
                }
            })
        )
        history = history.concat(
            user.access_requests.map(r => {
                const service = services.find(s => s.id == r.service_id)
                return {
                    date: r.created_at,
                    message:
                        `Access requested for service ${service.name}` +
                        (r.auto_approve ? ' (auto approve)' : ''),
                }
            })
        )
        for (const request of user.access_requests) {
            history = history.concat(
                request.logs.map(l => {
                    const service = services.find(
                        s => s.id == request.service_id
                    )
                    return {
                        date: l.created_at,
                        message: `${l.message} for service ${service.name}`,
                    }
                })
            )
        }
        history = history.concat(
            user.enrollment_requests.map(r => {
                const workshop = workshops.find(w => w.id == r.workshop_id)
                return {
                    date: r.created_at,
                    message:
                        `Enrollment requested for workshop ${workshop.title}` +
                        (r.auto_approve ? ' (auto approve)' : ''),
                }
            })
        )
        for (const request of user.enrollment_requests) {
            history = history.concat(
                request.logs.map(l => {
                    const workshop = workshops.find(
                        w => w.id == request.workshop_id
                    )
                    return {
                        date: l.created_at,
                        message: `${l.message} for workshop ${workshop.title}`,
                    }
                })
            )
        }
        history = history.concat(
            user.form_submissions.map(r => {
                const form = forms.find(f => f.id == r.form_id)
                return {
                    date: r.created_at,
                    message: `Submission for form ${form.name}`,
                }
            })
        )

        history.sort((a, b) => new Date(b.date) - new Date(a.date))

        res.status(200).json(history)
    })
)

// Get individual user's LDAP record for debug (STAFF ONLY)
router.get(
    '/:id(\\d+)/ldap',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const user = await User.findByPk(req.params.id)
        try {
            const record = await ldapGetUser(user.username)
            res.status(200).send(record)
        } catch (error) {
            res.status(500).send('An error occurred')
        }
    })
)

// Update user permission (STAFF ONLY)
router.post(
    '/:id(\\d+)/permission',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const permission = req.body.permission

        const user = await User.findByPk(req.params.id)
        if (!user) return res.status(404).send('User not found')

        if (user.is_superuser && !req.user.is_superuser)
            return res
                .status(403)
                .send(
                    "Only superuser can modify another superuser's permission"
                )
        if (permission == 'superuser' && !req.user.is_superuser)
            return res
                .status(403)
                .send('Only a superuser can grant superuser permission')
        if (
            permission == 'staff' &&
            !req.user.is_superuser &&
            !req.user.is_staff
        )
            return res
                .status(403)
                .send('Only a superuser/staff can grant staff permission')

        user.is_superuser = permission == 'superuser'
        user.is_staff = permission == 'staff'

        await user.save()
        await user.reload()

        res.status(200).send('success')
    })
)

/*
 * Update user
 *
 * If body is empty then will just return the user
 */
router.post(
    '/:id(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const id = req.params.id
        const fields = req.body

        // Check permission -- user can only update their own record unless admin
        if (id != req.user.id && !isAdmin(req))
            return res.status(403).send('Permission denied')

        let user = await User.findByPk(id)
        if (!user) return res.status(404).send('User not found')

        // Update
        const SUPPORTED_FIELDS = [
            'first_name',
            'last_name',
            'orcid_id',
            'grid_institution_id',
            'department',
            'aware_channel_id',
            'ethnicity_id',
            'funding_agency_id',
            'gender_id',
            'occupation_id',
            'research_area_id',
            'region_id',
            'settings',
            'updated_at', // for profile review page
        ]
        const updated = {}
        const timeNow = Date.now()
        if (fields) {
            for (const key in fields) {
                // Ignore any non-updateable fields
                if (
                    SUPPORTED_FIELDS.includes(key) &&
                    user.getDataValue(key) != fields[key]
                ) {
                    user[key] = fields[key]
                    user['updated_at'] = timeNow
                    updated[key] = true

                    // Special case: automatically set "institution" for backward compatibility
                    if (key == 'grid_institution_id' && fields[key]) {
                        const institution =
                            await models.account_institution_grid.findByPk(
                                fields[key]
                            )
                        user['institution'] = institution.name
                    }
                }
            }

            await user.save()
            await user.reload()
        }

        res.status(200).json(user)

        // Update LDAP (do this after response as to not delay it)
        if (updated['first_name'] || updated['last_name']) {
            if (updated['first_name'])
                await ldapModify(user.username, 'givenName', user.first_name)
            if (updated['last_name'])
                await ldapModify(user.username, 'sn', user.last_name)
            await ldapModify(
                user.username,
                'cn',
                user.first_name + ' ' + user.last_name
            )
        }
    })
)

/*
 * Update password (password change in Account page)
 *
 * For password reset see src/api/public.js:/users/password
 */
router.post(
    '/password',
    getUser,
    asyncHandler(async (req, res) => {
        const fields = req.body
        if (!fields || !('password' in fields) || !('oldPassword' in fields))
            return res.status(400).send('Missing required field')

        // Re-fetch user unscoped so password is present
        const user = await User.unscoped().findByPk(req.user.id, {
            include: ['occupation'],
        })

        // Check the password
        if (!checkPassword(user.password, fields.oldPassword))
            return res.status(400).send('Incorrect password')

        // Update password in DB
        user.password = encodePassword(fields.password)
        await user.save()

        res.status(200).send('success')

        // Update password in LDAP (do after response as to not delay it)
        logger.info(`Updating password for user ${user.username}`)
        user.password = fields.password // kludgey, but use raw password
        await userPasswordUpdateWorkflow(user)
    })
)

/*
 * Get reset password link for user (STAFF ONLY)
 *
 * Similar to POST /users/reset_password in public.js but for Admin user page.
 * If no HMAC given then one is returned.  If HMAC given then password reset email is sent.
 */
router.post(
    '/:id(\\d+)/reset_password',
    requireAdmin,
    asyncHandler(async (req, res) => {
        let hmac = req.body.hmac // optional

        const user = await User.unscoped().findByPk(req.params.id)

        const emailAddress = await EmailAddress.findOne({
            where: {
                user_id: user.id,
                primary: true,
            },
        })
        emailAddress.user = user // kinda kludgey but emailPasswordReset() expects an EmailAddress object

        if (!hmac) hmac = generateToken(emailAddress.id)

        const passwordResetRequest = PasswordResetRequest.create({
            user_id: user.id,
            username: user.username,
            email_address_id: emailAddress.id,
            email: emailAddress.email,
            key: hmac,
        })
        if (!passwordResetRequest)
            return res.status(500).send('Error creating password reset request')

        res.status(200).send(hmac)

        // Send email after response as to not delay it
        if ('hmac' in req.body) await emailPasswordReset(emailAddress, hmac)
    })
)

// Delete user (SUPERUSER ONLY)
router.delete(
    '/:id(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const id = req.params.id

        if (!req.user.is_superuser)
            return res.status(403).send('Permission denied')

        if (id == req.user.id)
            return res.status(403).send('Cannot delete yourself')

        let user = await User.unscoped().findByPk(id, {
            include: [
                {
                    model: models.account_emailaddress,
                    as: 'emails',
                    include: [
                        {
                            model: models.api_mailinglist,
                            as: 'mailing_lists',
                        },
                    ],
                },
            ],
        })
        if (!user) return res.status(404).send('User not found')

        if (user.is_staff || user.is_superuser)
            return res.status(403).send('Cannot delete privileged user')

        // Submit user deletion workflow to remove user from subsystems (LDAP, IRODS, etc)
        await userDeletionWorkflow(user)

        // Remove user from database
        logger.info(`Deleting user ${user.username} id=${user.id}`)
        const opts = { where: { user_id: user.id } }

        //TODO remove these tables eventually (leftover from v1 and no longer used)
        await models.django_cyverse_auth_token.destroy(opts)
        await models.django_cyverse_auth_token.destroy(opts)
        await models.django_admin_log.destroy(opts)
        await models.warden_atmosphereinternationalrequest.destroy(opts)
        await models.warden_atmospherestudentrequest.destroy(opts)

        //TODO add associations in models/index.js to cascade delete these
        await models.account_passwordreset.destroy(opts)
        await models.account_passwordresetrequest.destroy(opts)
        await models.api_userservice.destroy(opts)
        // for (const request of await models.api_accessrequest.findAll(opts)) { // loop through logs because "onDelete: cascade" isn't working for some reason
        //     await models.api_accessrequestlog.destroy({ where: { access_request_id: request.id } });
        //     await request.destroy();
        // }
        await models.api_workshoporganizer.destroy({
            where: { organizer_id: user.id },
        })
        //await models.api_workshopenrollmentrequest.destroy(opts);
        //await models.api_formsubmission.destroy(opts);
        await user.destroy()

        res.status(200).send('success')
    })
)

// Get restricted usernames
router.get(
    '/restricted',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const usernames = await RestrictedUsername.findAll({
            attributes: ['id', 'username'],
            order: [['username', 'ASC']],
            // limit: 10
        })

        res.status(200).json(usernames)
    })
)

// Add restricted username
router.put(
    '/restricted/:username(\\S+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const [username, created] = await RestrictedUsername.findOrCreate({
            where: { username: req.params.username },
        })
        res.status(201).json(username)
    })
)

// Delete restricted username
router.delete(
    '/restricted/:username(\\S+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const username = await RestrictedUsername.findOne({
            where: { username: req.params.username },
        })
        if (!username)
            return res.status(404).send('Restricted username not found')

        await username.destroy()

        res.status(200).send('success')
    })
)

module.exports = router
