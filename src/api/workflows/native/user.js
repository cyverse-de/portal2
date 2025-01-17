const { ldapCreateUser, ldapModify, ldapChangePassword, ldapAddUserToGroup, ldapDeleteUser, irodsCreateUser, irodsChMod, irodsChangePassword, irodsSafeDeleteHome, irodsDeleteUser, mailchimpSubscribe, mailchimpDelete, mailmanUpdateSubscription } = require('./lib');
const { logger } = require('../../lib/logging');

async function userCreationWorkflow(user) {
    if (!user)
        throw('Missing required property');

    logger.info(`Running native workflow for user ${user.username}: creation`);

    // LDAP: create user
    await ldapCreateUser(user);

    // LDAP: set user password
    await ldapChangePassword(user.username, user.password);

    // LDAP: add user to groups
    await ldapAddUserToGroup(user.username, "iplant-everyone");
    await ldapAddUserToGroup(user.username, "community");

    // IRODS: create user
    await irodsCreateUser(user.username);

    // IRODS: set user password
    await irodsChangePassword(user.username, user.password);

    // IRODS: grant access to user directory 
    await irodsChMod("own", "ipcservices", `/iplant/home/${user.username}`);
    await irodsChMod("own", "rodsadmin", `/iplant/home/${user.username}`);

    // Mailchimp: subscribe user to newsletter 
    if (process.env.MAILCHIMP_ENABLED.toLowerCase() === "true")
        await mailchimpSubscribe(user.email, user.first_name, user.last_name);
}

async function userPasswordUpdateWorkflow(user) {
    if (!user)
        throw('Missing required property');

    logger.info(`Running native workflow for user ${user.username}: password update`);

    // LDAP: update user password
    await ldapChangePassword(user.username, user.password);

    // LDAP: update shadowLastChange 
    const daysSinceEpoch = Math.floor(new Date()/8.64e7).toString();
    await ldapModify(user.username, 'shadowLastChange', daysSinceEpoch)

    // IRODS: set user password
    await irodsChangePassword(user.username, user.password);
}

// Based on v1 portal:/account/views/user.py:perform_destroy()
async function userDeletionWorkflow(user) {
    if (!user || !user.emails)
        throw('Missing required property');

    logger.info(`Running native workflow for user ${user.username}: deletion`);

    // LDAP: delete user
    try {
        await ldapDeleteUser(user.username);
    }
    catch(e) {
        console.error(e)
    }

    // IRODS: delete user
    try {
        await irodsSafeDeleteHome(user.username)
        await irodsDeleteUser(user.username);
    }
    catch(e) {
        console.error(e)
    }

    // Mailchimp: unsubscribe user from newsletter 
    if (process.env.MAILCHIMP_ENABLED.toLowerCase() === "true") {
        try {
            await mailchimpDelete(user.email);
        }
        catch(e) {
            console.error(e)
        }
    }

    // Mailman: unsubscribe from mailing lists
    if (process.env.MAILMAN_ENABLED) {
        for (const email of user.emails) {
            for (const mailingList of email.mailing_lists) {
                try {
                    await mailmanUpdateSubscription(mailingList.list_name, user.email, false);
                }
                catch(e) {
                    console.error(e)
                }
            }
        }
    }
}

module.exports = { userCreationWorkflow, userDeletionWorkflow, userPasswordUpdateWorkflow };
