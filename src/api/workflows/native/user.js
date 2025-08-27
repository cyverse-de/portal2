const {
    ldapCreateUser,
    ldapModify,
    ldapChangePassword,
    ldapAddUserToGroup,
    ldapDeleteUser,
    irodsCreateUser,
    irodsChMod,
    irodsChangePassword,
    irodsSafeDeleteHome,
    irodsDeleteUser,
    mailchimpSubscribe,
    mailchimpDelete,
    mailmanUpdateSubscription,
} = require('./lib')
const { logger } = require('../../lib/logging')
const config = require('../../lib/config')

async function userCreationWorkflow(user) {
    if (!user) throw 'Missing required property'

    logger.info(`Running native workflow for user ${user.username}: creation`)
}

async function userPasswordUpdateWorkflow(user) {
    if (!user) throw 'Missing required property'

    logger.info(
        `Running native workflow for user ${user.username}: password update`
    )
}

// Based on v1 portal:/account/views/user.py:perform_destroy()
async function userDeletionWorkflow(user) {
    if (!user || !user.emails) throw 'Missing required property'

    logger.info(`Running native workflow for user ${user.username}: deletion`)

    // Mailman: unsubscribe from mailing lists
    if (config.MAILMAN_ENABLED) {
        for (const email of user.emails) {
            for (const mailingList of email.mailing_lists) {
                try {
                    await mailmanUpdateSubscription(
                        mailingList.list_name,
                        user.email,
                        false
                    )
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }
}

module.exports = {
    userCreationWorkflow,
    userDeletionWorkflow,
    userPasswordUpdateWorkflow,
}
