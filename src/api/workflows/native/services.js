const crypto = require("crypto");
const axios = require('axios');
const { ldapAddUserToGroup, irodsMkDir, irodsChMod, mailmanUpdateSubscription, terrainGetKeycloakToken, terrainSetConcurrentJobLimits } = require('./lib');
const { logger } = require('../../lib/logging');
const models = require('../../models');
const MailingList = models.api_mailinglist;
const EmailAddress = models.account_emailaddress;
const EmailAddressToMailingList = models.api_emailaddressmailinglist;

const servicesConfig = {
    ATMOSPHERE: {
        ldapGroup: 'atmo-user',
        mailingList: 'atmosphere-users'
    },
    BISQUE: {
        irodsPath: 'bisque_data',
        mailingList: 'bisque-users',
        customAction: createBisqueUser
    },
    COGE: {
        irodsPath: 'coge_data'
    },
    DISCOVERY_ENVIRONMENT: {
        ldapGroup: 'de-preview-access',
        mailingList: [ 'de-users', 'datastore-users' ]
    },
    SCI_APPS: {
        irodsPath: 'sci_data',
        irodsUser: 'maizecode'
    },
    VICE: {
        customAction: setViceJobLimit
    }
}

async function serviceRegistrationWorkflow(request) {
    const user = request.user;
    const service = request.service;
    if (!user || !service)
        throw('serviceRegistrationWorkflow: Missing required property');

    logger.info(`Running native workflow for service ${service.name} and user ${user.username}`);

    const cfg = servicesConfig[request.service.approval_key];
    if (!cfg)
	return

    // LDAP: add user to service group
    if (cfg.ldapGroup)
        await ldapAddUserToGroup(user.username, cfg.ldapGroup);

    // IRODS: create service directory
    if (cfg.irodsPath) {
        const fullPath = `/iplant/home/${user.username}/${cfg.irodsPath}`
        await irodsMkDir(fullPath);
        await irodsChMod('inherit', '', fullPath);
        await irodsChMod('own', user.username, fullPath);

        if (cfg.irodsUser)
            await irodsChMod('own', cfg.irodsUser, fullPath);
    }

    // Add user's primary email to service mailing list(s)
    if (cfg.mailingList) {
        const lists = Array.isArray(cfg.mailingList) ? cfg.mailingList : [ cfg.mailingList ];
        for (let list of lists)
            await addEmailToMailingList(user.email, list);
    }

    // Execute custom steps
    if (cfg.customAction) {
        const actions = Array.isArray(cfg.customAction) ? cfg.customAction : [ cfg.customAction ];
        for (let fn of actions) {
            if (typeof fn === "function")
                await fn(request);
        }
    }
}

async function addEmailToMailingList(email, listName) {
    const mailingList = await MailingList.findOne({ where: { list_name: listName } });
    if (!mailingList) {
        logger.error(`addEmailToMailingList: list not found: ${listName}`);
        return;
    }

    const emailAddress = await EmailAddress.findOne({ where: { email } });
    if (!emailAddress) {
        logger.error(`addEmailToMailingList: email not found: ${email}`);
        return;
    }

    await EmailAddressToMailingList.findOrCreate({ 
        where: {
          mailing_list_id: mailingList.id,
          email_address_id: emailAddress.id
        },
        defaults: {
          is_subscribed: true
        }
    });

    if (process.env.MAILMAN_ENABLED)
        await mailmanUpdateSubscription(listName, email, true);
}

async function createBisqueUser(request) {
    const password = crypto.randomBytes(12).toString('hex');
    const xml = `<user name="${request.user.username}">
        <tag name="password" value="${password}" />
        <tag name="email" value="${request.user.email}"/>
        <tag name="display_name" value="${request.user.username}"/>
    </user>`;

    const token = Buffer.from(`${process.env.BISQUE_USER}:${process.env.BISQUE_PASSWORD}`).toString('base64');

    logger.info(`POST request to ${process.env.BISQUE_URL}`);
    return await axios.post(process.env.BISQUE_URL, xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Basic ${token}`
        },
        timeout: 30*1000
    });
}

// Called for workshop registration
async function setViceJobLimit(request) {
    // Get auth token for admin account
    const token = await terrainGetKeycloakToken();
    console.log('Terrain token:', token);
    const obj = JSON.parse(token);

    // Send request to Terrain API
    const resp = await terrainSetConcurrentJobLimits(obj.access_token, request.user.username, 2); //FIXME hardcoded limit of 2
    console.log(resp);
}

module.exports = { serviceRegistrationWorkflow };
