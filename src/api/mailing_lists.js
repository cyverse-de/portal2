const router = require('express').Router()
const { getUser, requireAdmin, asyncHandler } = require('./lib/auth')
const { emailNewEmailConfirmation } = require('./lib/email')
const { generateHMAC } = require('./lib/hmac')
const { ldapModify } = require('./workflows/native/lib.js')
const { mailmanUpdateSubscription } = require('./workflows/native/lib')
const sequelize = require('sequelize')
const models = require('./models')
const config = require('../lib/config')
const User = models.account_user
const MailingList = models.api_mailinglist
const EmailAddress = models.account_emailaddress
const EmailAddressToMailingList = models.api_emailaddressmailinglist

//TODO move into module
const lowerEqualTo = (key, val) =>
    sequelize.where(
        sequelize.fn('lower', sequelize.col(key)),
        val.toLowerCase()
    )

// Create email address
// Can be submitted again for existing email address to resend confirmation email
router.put(
    '/email_addresses',
    getUser,
    asyncHandler(async (req, res) => {
        const email = req.body.email // email address

        if (!email) return res.status(400).send('Missing required field(s)')

        let emailAddress = await EmailAddress.findOne({
            where: lowerEqualTo('email', email),
        })
        if (!emailAddress) {
            emailAddress = await EmailAddress.create({
                user_id: req.user.id,
                email: email.toLowerCase(),
                primary: false,
                verified: false,
            })
            if (!emailAddress)
                return res.status(500).send('Error creating email address')
        } else if (emailAddress.user_id != req.user.id)
            return res.status(404).send('Email address not found')

        // Associate new email with existing mailing lists
        const primaryEmail = await EmailAddress.findOne({
            where: {
                user_id: req.user.id,
                primary: true,
            },
            include: ['mailing_lists'],
        })
        if (primaryEmail) {
            // should always be true
            for (let list of primaryEmail.mailing_lists) {
                // There shouldn't be any mailing list associations since this is a new email, but just in case do findOrCreate
                await EmailAddressToMailingList.findOrCreate({
                    where: {
                        email_address_id: emailAddress.id,
                        mailing_list_id: list.id,
                    },
                    defaults: {
                        is_subscribed: false,
                    },
                })
            }
        }

        res.status(200).send(emailAddress)

        // Send confirmation email (after response as to not delay it)
        const hmac = generateHMAC(emailAddress.id)
        await emailNewEmailConfirmation(email, hmac)
    })
)

// Update email address
// Only used to change "primary" setting currently
router.post(
    '/email_addresses/:id(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const id = req.params.id
        const setPrimary = req.body.setPrimary

        let emailAddress = await EmailAddress.unscoped().findByPk(id)
        if (!emailAddress)
            return res.status(404).send('Email address not found')
        if (emailAddress.user_id != req.user.id && !req.user.is_staff)
            return res.status(403).send('Permission denied')

        if (setPrimary) {
            const user = await User.findByPk(req.user.id, {
                include: ['emails'],
            })
            user.email = emailAddress.email
            user.save()
            for (const e of user.emails) {
                e.primary = e.id == id
                await e.save()
            }
        }

        emailAddress.reload()
        res.status(200).send(emailAddress)

        // Update LDAP (do this after response as to not delay it)
        if (setPrimary)
            await ldapModify(req.user.username, 'mail', emailAddress.email)
    })
)

router.delete(
    '/email_addresses/:id(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const id = req.params.id

        const emailAddress = await EmailAddress.findOne({
            where: {
                id: id,
                user_id: req.user.id,
            },
            include: ['mailing_lists'],
        })
        if (!emailAddress)
            return res.status(404).send('Email address not found for user')
        if (emailAddress.primary)
            return res.status(403).send('Cannot delete primary email address')

        const subscriptions = await EmailAddressToMailingList.findAll({
            where: {
                email_address_id: emailAddress.id,
            },
        })

        for (const sub of subscriptions) await sub.destroy()
        await emailAddress.destroy()
        res.status(200).send('success')

        // Unsubscribe from all subscribed mailing lists in Mailman (do after response as to not delay it)
        if (config.MAILMAN_ENABLED) {
            for (const list of emailAddress.mailing_lists) {
                if (
                    subscriptions.find(
                        s => s.mailing_list_id == list.id && s.is_subscribed
                    )
                )
                    await mailmanUpdateSubscription(
                        list.list_name,
                        emailAddress.email,
                        false
                    )
            }
        }
    })
)

/*
 * List mailing lists (STAFF ONLY)
 *
 */
router.get(
    '/',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const lists = await MailingList.findAll({ include: 'service' })
        return res.status(200).json(lists)
    })
)

/*
 * Create mailing list (STAFF ONLY)
 *
 */
router.put(
    '/',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const fields = req.body
        const newList = await MailingList.create(fields)
        if (!newList) return res.status(500).send('error')
        res.status(200).send('success')
    })
)

/*
 * Delete mailing list (STAFF ONLY)
 *
 */
router.delete(
    '/:id(\\d+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const list = await MailingList.findByPk(req.params.id)
        if (!list) return res.status(404).send('Mailing list not found')

        await list.destroy()
        res.status(200).send('success')
    })
)

/*
 * Update mailing list subscription
 *
 * Called in "Account" page to subscribe/unsubscribe
 */
router.post(
    '/:id(\\d+)/subscriptions',
    getUser,
    asyncHandler(async (req, res) => {
        const id = req.params.id // mailing list id
        const email = req.body.email // email address
        const subscribe = !!req.body.subscribe
        const targetUserId = req.body.user_id // Allow admins to update other user's subscription, exclude if updating own record

        if (!email) return res.status(400).send('Missing required field')

        const mailingList = await MailingList.findByPk(id)
        if (!mailingList) return res.status(404).send('Mailing list not found')

        if (targetUserId && targetUserId != req.user.id && !req.user.is_staff)
            return res.status(403).send('Permission denied')

        const userId = targetUserId || req.user.id
        const emailAddress = await EmailAddress.findOne({
            where: {
                email: email,
                user_id: userId,
            },
        })
        if (!emailAddress)
            return res.status(404).send('Email address not found')

        const emailAddressToMailingList =
            await EmailAddressToMailingList.findOne({
                where: {
                    mailing_list_id: mailingList.id,
                    email_address_id: emailAddress.id,
                },
            })
        if (!emailAddressToMailingList)
            return res
                .status(404)
                .send('Email address to mailing list not found')

        if (emailAddressToMailingList.is_subscribed == subscribe)
            return res.status(200).send('success')

        emailAddressToMailingList.is_subscribed = subscribe
        await emailAddressToMailingList.save()

        res.status(200).send('success')

        // Update subscription status in Mailman (do after response as to not delay it)
        if (config.MAILMAN_ENABLED)
            await mailmanUpdateSubscription(
                mailingList.list_name,
                email,
                subscribe
            )
    })
)

module.exports = router
