const router = require('express').Router()
const { logger } = require('./lib/logging')
const {
    emailNewAccountConfirmation,
    emailPasswordReset,
} = require('./lib/email')
const { decodeHMAC, generateToken, decodeToken } = require('./lib/hmac')
const { asyncHandler } = require('./lib/auth')
const { encodePassword } = require('./lib/password')
const Argo = require('./lib/argo')
const serviceApprovers = require('./approvers/service')
const config = require('../lib/config')
const {
    userCreationWorkflow,
    userPasswordUpdateWorkflow,
} = require('./workflows/native/user.js')
const sequelize = require('sequelize')
const models = require('./models')
const User = models.account_user
const AccessRequest = models.api_accessrequest
const CyVerseService = models.api_cyverseservice
const RestrictedUsername = models.account_restrictedusername
const EmailAddress = models.account_emailaddress
const PasswordReset = models.account_passwordreset
const PasswordResetRequest = models.account_passwordresetrequest
const EmailAddressToMailingList = models.api_emailaddressmailinglist
const MailingList = models.api_mailinglist

//TODO move into module
const lowerEqualTo = (key, val) =>
    sequelize.where(
        sequelize.fn('lower', sequelize.col(key)),
        val.toLowerCase()
    )
const like = (key, val) =>
    sequelize.where(sequelize.fn('lower', sequelize.col(key)), {
        [sequelize.Op.like]: '%' + val.toLowerCase() + '%',
    })

// Mailchimp unsubscribe webhook
// Configured here: https://us10.admin.mailchimp.com/lists/tools/webhooks-edit?id=174785&hookId=1
// Called when a user or admin unsubscribes from newsletter
router.post(
    '/mailchimp/unsubscribe',
    asyncHandler(async (req, res) => {
        console.log(req.body)

        if (
            !req.body ||
            !req.body.data ||
            !req.body.data.email ||
            req.body.type != 'unsubscribe'
        ) {
            logger.error(`Mailchimp unsupported request`)
            return res.status(200).json({ status: 'Unsupported request' })
        }

        const email = req.body.data.email
        const user = await User.findOne({ where: { email } })
        if (!user) {
            logger.error(`Mailchimp user not found`)
            return res
                .status(200)
                .json({ status: `No user was found with email ${email}` })
        }

        user.subscribe_to_newsletter = false
        await user.save()

        res.status(200).json({
            status: `User with email ${email} unsubscribed from newsletter`,
        })
    })
)

// Used by Mailchimp to verify correct configuration
router.get(
    '/mailchimp/unsubscribe',
    asyncHandler(async (req, res) => {
        res.status(200).json({ status: `success` })
    })
)

// Check for existing username and/or email address
router.post(
    '/exists',
    asyncHandler(async (req, res) => {
        let fields = req.body
        let result = {}

        // Check for existing username
        const username = fields.username
        if (username) {
            const user = await User.findOne({ where: { username } })
            const restricted = await RestrictedUsername.findOne({
                where: { username },
            })
            result.username = !!(user || restricted)
        }

        // Check for existing email
        const email = fields.email
        if (email) {
            //const user = await User.unscoped().findOne({ where: lowerEqualTo('email', email) }); // Not needed, account_user.email is always set to primary email address
            const emailAddress = await EmailAddress.findOne({
                where: lowerEqualTo('email', email),
            })
            result.email = !!emailAddress
        }

        console.log(result)

        res.status(200).json(result)
    })
)

// Create user
router.put(
    '/users',
    asyncHandler(async (req, res) => {
        let fields = req.body
        const MINIMUM_TIME_ON_PAGE = 1000 * 30 // 30 seconds
        const MAXIMUM_TIME_ON_PAGE = 1000 * 60 * 60 // one hour

        if (!('username' in fields))
            return res.status(400).send('Missing required field')

        // Check for existing username
        const user = await User.findOne({
            where: { username: fields['username'] },
        })
        const restricted = await RestrictedUsername.findOne({
            where: { username: fields['username'] },
        })
        if (user || restricted)
            return res.status(400).send('Username already taken')

        // Detect bots using honeypot fields
        const HONEYPOT_FIELDS = ['first_name', 'last_name'] // index corresponds to modulus identifier
        for (let key in fields) {
            if (isNaN(key)) {
                if (HONEYPOT_FIELDS.includes(key))
                    // fields must be encoded
                    return res.status(400).send('Validity test failed (1)')
            } else {
                const index = (key % config.HONEYPOT_DIVISOR) - 1
                if (index >= 0 && index < HONEYPOT_FIELDS.length) {
                    const realKey = HONEYPOT_FIELDS[index]
                    fields[realKey] = fields[key] // replace encoded key with actual field name
                } else {
                    // a fake field was populated
                    logger.error(
                        `Honeypot field was populated: key=${key} index=${index} value=${fields[key]}`
                    )
                    return res.status(400).send('Validity test failed (2)')
                }
            }
        }

        // Detect bots using page load time
        if (!fields['plt']) return res.status(400).send('Missing HMAC')

        const pageLoadTime = decodeHMAC(fields['plt'])
        if (isNaN(pageLoadTime)) return res.status(400).send('Invalid HMAC')
        const timeExpired = Date.now() - pageLoadTime
        if (
            timeExpired < MINIMUM_TIME_ON_PAGE ||
            timeExpired >= MAXIMUM_TIME_ON_PAGE
        )
            return res
                .status(400)
                .send('Signup window expired, please reload page and try again')

        // Validate fields
        const REQUIRED_FIELDS = [
            'first_name',
            'last_name',
            'email',
            'grid_institution_id',
            'department',
            'occupation_id',
            'research_area_id',
            'funding_agency_id',
            'country_id',
            'region_id',
            'gender_id',
            'ethnicity_id',
            'aware_channel_id',
        ]
        if (!REQUIRED_FIELDS.every(f => fields[f]))
            return res.status(400).send('Missing required field')

        // Check for existing email
        const user2 = await User.unscoped().findOne({
            where: lowerEqualTo('email', fields['email']),
        })
        const emails = await EmailAddress.findOne({
            where: lowerEqualTo('email', fields['email']),
        })
        if (user2 || emails) return res.status(400).send('Email already in use')

        // Set defaults
        fields['password'] = ''
        fields['email'] = fields['email'].toLowerCase()
        fields['is_superuser'] = false
        fields['is_staff'] = false
        fields['is_active'] = true
        fields['has_verified_email'] = false
        fields['participate_in_study'] = true
        fields['subscribe_to_newsletter'] = true
        fields['orcid_id'] = ''
        fields['updated_at'] = Date.now()

        // Special case: automatically set "institution" based on for backward compatibility
        const institution = await models.account_institution_grid.findByPk(
            fields['grid_institution_id']
        )
        fields['institution'] = institution.name

        // Create user
        logger.info('Creating user', fields['username'])
        let newUser = await User.create(fields)
        if (!newUser) return res.status(500).send('Error creating user')

        // Create primary email address
        const emailAddress = await EmailAddress.create({
            user_id: newUser.id,
            email: newUser.email,
            primary: true,
            verified: false,
        })
        if (!emailAddress)
            return res.status(500).send('Error creating email address')

        // Add "announce" mailing list to email address, default unsubscribed
        const mailingList = await MailingList.findOne({
            where: { list_name: 'announce' },
        })
        if (mailingList) {
            const e2m = await EmailAddressToMailingList.create({
                mailing_list_id: mailingList.id,
                email_address_id: emailAddress.id,
                is_subscribed: false,
            })
            if (!e2m)
                logger.error('Error assigning email address to mailing list')
        } else logger.error('Mailing list not found: "announce"')

        res.status(200).json(newUser)

        // Send confirmation email (after the response as to not delay it)
        const hmac = generateToken(emailAddress.id)
        await emailNewAccountConfirmation(newUser.email, hmac)
    })
)

/*
 * Update user password -- assumes password requirements were enforced by front-end
 *
 * This endpoint is called for:
 *     1. new user set password
 *     2. password reset
 *
 * For password change see src/api/users.js:/password
 */
router.put(
    '/users/password',
    asyncHandler(async (req, res) => {
        const fields = req.body
        if (!fields || !('password' in fields) || !fields.hmac)
            return res.status(400).send('Missing required field')

        // Decode HMAC
        let emailId
        try {
            emailId = decodeToken(fields.hmac)
        } catch (error) {
            return res.status(400).send(error.message)
        }

        // Fetch email address
        const emailAddress = await EmailAddress.unscoped().findByPk(emailId)
        if (!emailAddress)
            return res.status(404).send('Email address not found')

        // Check if password was already set/reset using this HMAC
        const passwordReset = await PasswordReset.findOne({
            where: {
                key: fields.hmac,
                user_id: emailAddress.user_id,
            },
        })
        if (passwordReset)
            return res.status(400).send('Password already set/reset')

        //TODO check that there is a password reset request for this HMAC

        // Confirm email address
        emailAddress.verified = true
        emailAddress.primary = true
        emailAddress.save()

        // Fetch user unscoped so password is present
        const user = await User.unscoped().findByPk(emailAddress.user_id, {
            include: ['occupation'],
        })

        // Log password set/reset
        const newPasswordReset = PasswordReset.create({
            user_id: user.id,
            key: fields.hmac,
        })
        if (!newPasswordReset) logger.error('Error creating password reset')

        // Update password in DB
        const oldPassword = user.password
        user.password = encodePassword(fields.password)
        await user.save()

        res.status(200).send('success')

        // Run appropriate workflow (do after response as to not delay it)
        user.password = fields.password // kludgey, but use raw password in workflows below

        if (oldPassword != '') {
            // existing user password reset
            await userPasswordUpdateWorkflow(user)
        } else {
            // new user
            // Run user creation workflow
            logger.info(
                `Running user creation workflow for user ${user.username}`
            )
            await userCreationWorkflow(user)

            // Grant access to default services
            logger.info(
                `Granting access to default services for user ${user.username}`
            )
            const defaultServices = await CyVerseService.findAll({
                where: { auto_add_new_users: true },
                include: ['service'],
            })
            for (let cyverseService of defaultServices) {
                const serviceRequest = await AccessRequest.create({
                    service_id: cyverseService.service_ptr_id,
                    user_id: user.id,
                    auto_approve: true,
                    status: AccessRequest.constants.STATUS_REQUESTED,
                    message: AccessRequest.constants.MESSAGE_REQUESTED,
                })

                serviceRequest.service = cyverseService.service
                serviceRequest.user = user
                serviceApprovers.grantRequest(serviceRequest)
            }
        }
    })
)

// Send reset password link
router.post(
    '/users/reset_password',
    asyncHandler(async (req, res) => {
        const email = req.body.email
        const pltHMAC = req.body.hmac
        const MINIMUM_TIME_ON_PAGE = 1000 * 5 // 5 seconds
        const MAXIMUM_TIME_ON_PAGE = 1000 * 60 * 60 // one hour

        if (!email) return res.status(400).send('Missing email')

        let emailAddress = await EmailAddress.findOne({
            where: { email },
            include: ['user'],
        })
        if (!emailAddress)
            return res
                .status(404)
                .send('Email address not associated with an account')

        // Detect bots using page load time
        if (!pltHMAC) return res.status(400).send('Missing HMAC')

        const pageLoadTime = decodeHMAC(pltHMAC)
        if (isNaN(pageLoadTime)) return res.status(400).send('Invalid HMAC')
        const timeExpired = Date.now() - pageLoadTime
        console.log('timeExpired', timeExpired)
        if (
            timeExpired < MINIMUM_TIME_ON_PAGE ||
            timeExpired >= MAXIMUM_TIME_ON_PAGE
        )
            return res
                .status(400)
                .send('Reset window expired, please reload page and try again')

        // Generate HMAC for confirmation email code
        const hmac = generateToken(emailAddress.id)

        const passwordResetRequest = PasswordResetRequest.create({
            user_id: emailAddress.user.id,
            username: emailAddress.user.username,
            email_address_id: emailAddress.id,
            email: email,
            key: hmac,
        })
        if (!passwordResetRequest)
            return res.status(500).send('Error creating password reset request')

        res.status(200).send('success')

        // Send email after response as to not delay it
        await emailPasswordReset(emailAddress, hmac)
    })
)

router.post(
    '/confirm_email',
    asyncHandler(async (req, res) => {
        const hmac = req.body.hmac
        if (!hmac) return res.status(400).send('Missing HMAC')

        // Decode HMAC
        const key = decodeHMAC(hmac)
        const emailId = parseInt(key)
        if (isNaN(emailId)) return res.status(400).send('Invalid HMAC')

        // Get email address
        let emailAddress = await EmailAddress.findByPk(emailId)
        if (!emailAddress)
            return res.status(404).send('Email address not found')

        // Confirm email address
        emailAddress.verified = true
        emailAddress.save()

        res.status(200).send('success')
    })
)

/*
 * Argo callback to set service access request status to "granted"
 *
 * Called in service registration workflow (src/api/workflows/argo) to signal workflow completion
 */
// router.post('/services/requests/:id(\\d+)/grant', asyncHandler(async (req, res) => { //FIXME require API key
//     const requestId = req.params.id;

//     const request = await AccessRequest.findByPk(requestId, {
//         include: [ 'user', 'service' ] // needed by emailServiceAccessGranted()
//     });
//     if (!request)
//         return res.status(404).send("Request not found");

//     request.grant();

//     res.status(200).json(request);

//     // Send notification email to user (do this after response as to not delay it)
//     await emailServiceAccessGranted(request);

//     //FIXME can't call notifyClientOfServiceRequestStatusChange() to update status on client because req is not from client
// }));

/*
 * Argo callback to subscribe to mailing list
 *
 * Called in service registration workflow (src/api/workflows/argo) to subscribe to service mailing list
 */
// router.post('/mailing_lists/:nameOrId(\\w+)/subscribe', asyncHandler(async (req, res) => { //FIXME require API key
//     const nameOrId = req.params.nameOrId; // mailing list name (e.g. "de-users") or ID
//     const email = req.body.email; // email address to subscribe

//     if (!email)
//         return res.status(400).send('Missing required field');

//     const mailingList = await MailingList.findOne({
//         where:
//             sequelize.or(
//                 { id: nameOrId ? nameOrId : 0 },
//                 { list_name: nameOrId ? nameOrId : '' }
//             )
//     });
//     if (!mailingList)
//         return res.status(404).send('Mailing list not found');

//     const emailAddress = await EmailAddress.findOne({ where: { email } });
//     if (!emailAddress)
//         return res.status(404).send('Email address not found');

//     const emailAddressToMailingList = await EmailAddressToMailingList.create({
//         mailing_list_id: mailingList.id,
//         email_address_id: emailAddress.id,
//         is_subscribed: true
//     });
//     if (!emailAddressToMailingList)
//         return res.status(500).send('Failed to subscribe');

//     return res.status(200).send('success');
// }));

// This endpoint is no longer called directly.  It is used to generate the src/user-properties.json file for static compilation.
// To update the file:  curl -s http://localhost:3000/api/users/properties | jq > user-properties.json
router.get(
    '/users/properties',
    asyncHandler(async (req, res) => {
        const opts = { attributes: { exclude: ['created_at', 'updated_at'] } }
        const keys = [
            'funding_agencies',
            'occupations',
            'genders',
            'ethnicities',
            'countries',
            'regions',
            'research_areas',
            'aware_channels',
        ]

        const results = {}
        ;(
            await Promise.all([
                models.account_fundingagency.findAll(opts),
                models.account_occupation.findAll(opts),
                models.account_gender.findAll(opts),
                models.account_ethnicity.findAll(opts),
                models.account_country.findAll(opts),
                models.account_region.findAll(opts),
                models.account_researcharea.findAll(opts),
                models.account_awarechannel.findAll(opts),
            ])
        ).forEach((e, i) => (results[keys[i]] = e))

        res.status(200).json(results)
    })
)

router.get(
    '/users/properties/institutions',
    asyncHandler(async (req, res) => {
        const keyword = req.query.keyword // search term
        const limit = req.query.limit // max number of results or blank for all

        let institutions = []
        if (keyword && keyword.length >= 3) {
            if (keyword.toLowerCase() == 'other') {
                // If they enter exactly "other" then return only that option
                institutions = await models.account_institution_grid.findAll({
                    where: lowerEqualTo('name', keyword),
                })
            } else {
                institutions = await models.account_institution_grid.findAll({
                    where: like('name', keyword),
                    order: [['name', 'ASC']],
                    limit: limit,
                })
            }
        }

        res.status(200).json(institutions)
    })
)

module.exports = router
