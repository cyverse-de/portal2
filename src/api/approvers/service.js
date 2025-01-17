const models = require('../models');
const AccessRequestConversation = models.api_accessrequestconversation;
const Argo = require('../lib/argo');
const { emailServiceAccessGranted } = require('../lib/email')
const { logger } = require('../lib/logging');
const intercom = require('../lib/intercom');
const { emailGenericMessage } = require('../lib/email')
const { serviceRegistrationWorkflow } = require('../workflows/native/services');
const { terrainBootstrapRequest, terrainSubmitViceAccessRequest } = require('../workflows/native/lib');
const { UI_ADMIN_SERVICE_ACCESS_REQUEST_URL, EXT_ADMIN_VICE_ACCESS_REQUEST_URL } = require('../../constants');

// Services with special approval requirements, all other services are auto-approved.
const APPROVERS = {
    ATMOSPHERE: approveAtmosphere,
    VICE: approveVICE,
    DATAWATCH: approveDataWatch
};

async function approveRequest(request) {
    const key = request.service.approval_key;
    
    if (!request.auto_approve && key in APPROVERS)
        await APPROVERS[key](request);
    else
        await request.approve();
    
    logger.info(`approve: Set service access request ${request.id} status to "${request.status}"`);
}

// Map service approval keys to Argo workflow templates
const GRANTERS = {
    ATMOSPHERE: 'atmosphere-grant-access',
    //DATA_COMMONS: 'data-commmons-grant-access', // use AUTO_APPROVE 
    DISCOVERY_ENVIRONMENT: 'discovery-environment-grant-access',
    COGE: 'coge-grant-access',
    BISQUE: 'bisque-grant-access',
    SCI_APPS: 'sciapps-grant-access',
    VICE: 'vice-grant-access'
};

async function grantRequest(request) {
    logger.info(`grant: Service ${request.service.name} for user ${request.user.username} (approval_key="${request.service.approval_key}")`);
    if (!request.service || !request.user)
        throw('service:grantRequest: Missing required property')

    const key = request.service.approval_key;
    if (key in GRANTERS) {
        if (process.env.ARGO_ENABLED) {
            const workflow = GRANTERS[key];
            logger.info('grantRequest:', key, workflow);

            // Submit Argo workflow
            await Argo.submit(
                'services.yaml',
                workflow,
                {
                    // User params
                    request_id: request.id,
                    user_id: request.user.username,
                    email: request.user.email,

                    // Other params
                    portal_api_base_url: process.env.API_BASE_URL,
                    ldap_host: process.env.LDAP_HOST,
                    ldap_admin: process.env.LDAP_ADMIN,
                    ldap_password: process.env.LDAP_PASSWORD,
                    bisque_url: process.env.BISQUE_URL,
                    bisque_username: process.env.BISQUE_USER,
                    bisque_password: process.env.BISQUE_PASSWORD
                }
            );

            // Status is set to "granted" in Argo workflow via POST to /api/services/requests/[id]
        }
        else { // Argo disabled, fall back to native workflow
            await serviceRegistrationWorkflow(request);
            await request.grant();
            await emailServiceAccessGranted(request);
        }
    }
    else { // AUTO_APPROVE
        logger.info('grantRequest: AUTO_APPROVE');
        await request.grant();
        await emailServiceAccessGranted(request);
    }

    logger.info(`grant: Set service access request ${request.id} status to "${request.status}"`);
}


/*
 * Service-specific approvers
 */

// Based on v1 portal:/warden/approvers/atmosphere.py
// Approval policy and messages updated 12/3/2020 per https://cyverse.atlassian.net/browse/UP-47
async function approveAtmosphere(request) {
    const user = request.user;
    if (!user)
        throw('service:approveAtmosphere: Missing required property');

    const intro = `Hi ${user.first_name}! Thanks for requesting access to Atmosphere.`;
    const faqUrl = 'https://learning.cyverse.org/projects/faq/en/latest/atmosphere-faq.html';

    // Check if user is a student
    if (user.occupation.name && user.occupation.name.toLowerCase().indexOf('student') >= 0) {
        logger.info(`approveAtmosphere: Pend student user "${user.username}" for request ${request.id}`);
        await request.pend();
        await sendAtmosphereSignupMessage(request,
`${intro}

We are no longer approving student access for Atmosphere unless you are part of a workshop. Please ask your instructor for details on enrolling in the workshop.

For more information please see the FAQ: ${faqUrl}`
        );
        return;
    }

    // Deny all other requests
    logger.info(`approveAtmosphere: Deny user "${user.username}" for request ${request.id}`);
    await request.deny();
    await sendAtmosphereSignupMessage(request, 
`${intro}

We are no longer accepting new accounts as Atmosphere is being changed from a general purpose cloud computing environment to one that supports cloud-native development projects.

For more information please see the FAQ: ${faqUrl}`
    );
    return;
}

function getAtmosphereConversationBody(questions, answers) {
    let body = "Atmosphere access requested.";

    if (questions && questions.length > 0) {
        body += " Here are the details:";

        for (question of questions) {
            body += "\n\n" + question.question + "\n\n";
            const answer = answers.find(a => a.access_request_question_id == question.id);
            if (!answer) 
                body += "[blank]"
            else if (question.type == 'char')
                body += answer.value_char;
            else if (question.type == 'text')
                body += answer.value_text;
            else if (question.type == 'bool')
                body += answer.value_bool;
        }
    }

    return body;
}

async function sendAtmosphereSignupMessage(request, responseMessage) {
    const service = request.service;
    const user = request.user;
    if (!service || !user)
        throw('service:sendAtmosphereSignupMessage: Missing required property')

    const body = getAtmosphereConversationBody(service.questions, request.answers);
    const linkText = `This request can be viewed at ${UI_ADMIN_SERVICE_ACCESS_REQUEST_URL}/${request.id}`;

    if (intercom) {
        const [conversation, message] = await intercom.startConversation(user, body);

        await AccessRequestConversation.create({
            access_request_id: request.id,
            intercom_message_id: message.id,
            intercom_conversation_id: conversation.id
        });

        await intercom.addNoteToConversation(conversation.id, linkText);
        await intercom.replyToConversation(conversation.id, responseMessage);
        await intercom.assignConversation(conversation.id, process.env.INTERCOM_ADMIN_TIER1_ATMOSPHERE_ID);
    }

    if (process.env.BCC_INTERCOM) {
        const message = body + "\n\n" + linkText
        emailGenericMessage({ 
            to: process.env.BCC_INTERCOM,
            subject: 'User Portal Atmosphere Request',
            message
        })
    }
}

async function approveVICE(request) {
    const user = request.user;
    if (!user)
        throw('service:approveVICE: Missing required property');

    const intro = `Hi ${user.first_name}! Thanks for requesting access to VICE.`;

    logger.info(`approveVICE: Pend user "${user.username}" for request ${request.id}`);
    await request.pend();

    await createViceAccessRequest(request)
    
    await sendVICESignupMessage(request,
`${intro}

VICE access must be approved unless you are part of a workshop. Please ask your instructor for details on enrolling in the workshop.`
        );
}

async function createViceAccessRequest(request) {
    // Get response to usage question
    const answer = request.answers[0]; // only one question
    let usage = ''
    if (answer.value_text)
        usage = answer.value_text
    else if (answer.value_char)
        usage = answer.value_char
    else if (answer.value_bool)
        usage = answer.value_bool

    // Send request to Terrain API
    let resp = await terrainBootstrapRequest(request.user.token) // added 5/19/21 -- workaround for user not yet present in DE database
    resp = await terrainSubmitViceAccessRequest(request.user.token, request.user, usage) 
    console.log(resp)
}

async function sendVICESignupMessage(request, responseMessage) {
    const service = request.service;
    const user = request.user;
    if (!service || !user)
        throw('service:sendVICESignupMessage: Missing required property')

    const body = getVICEConversationBody(service.questions, request.answers);
    const linkText = `This request can be viewed at ${EXT_ADMIN_VICE_ACCESS_REQUEST_URL}`;

    if (intercom) {
        const [conversation, message] = await intercom.startConversation(user, body);

        await AccessRequestConversation.create({
            access_request_id: request.id,
            intercom_message_id: message.id,
            intercom_conversation_id: conversation.id
        });

        await intercom.addNoteToConversation(conversation.id, linkText);
        await intercom.replyToConversation(conversation.id, responseMessage);
        await intercom.assignConversation(conversation.id, process.env.INTERCOM_ADMIN_TIER1_SCIENCE_TEAM_ID);
    }

    if (process.env.BCC_INTERCOM) {
        const message = body + "\n\n" + linkText
        emailGenericMessage({ 
            to: process.env.BCC_INTERCOM,
            subject: 'User Portal VICE Request',
            message
        })
    }
}

function getVICEConversationBody(questions, answers) { // TODO can be merged with getAtmosphereConverstationBody
    let body = "VICE access requested.";

    if (questions && questions.length > 0) {
        body += " Here are the details:";

        for (question of questions) {
            body += "\n\n" + question.question + "\n\n";
            const answer = answers.find(a => a.access_request_question_id == question.id);
            if (!answer) 
                body += "[blank]"
            else if (question.type == 'char')
                body += answer.value_char;
            else if (question.type == 'text' || question.type == 'number')
                body += answer.value_text;
            else if (question.type == 'bool')
                body += answer.value_bool;
        }
    }

    return body;
}

async function approveDataWatch(request) {
    const user = request.user;
    if (!user)
        throw('service:approveDataWatch: Missing required property');

    const intro = `Hi ${user.first_name}! Thanks for requesting access to Data Watch.`;

    logger.info(`approveDataWatch: Pend user "${user.username}" for request ${request.id}`);
    await request.pend();

    await sendDataWatchSignupMessage(request,
    `${intro}

    Your request has been sent to CyVerse staff and will be reviewed soon.`
    );
}

async function sendDataWatchSignupMessage(request, responseMessage) {
    const service = request.service;
    const user = request.user;
    if (!service || !user)
        throw('service:sendDataWatchSignupMessage: Missing required property')

    const body = 'Data Watch access requested';
    const linkText = `This request can be viewed at ${UI_ADMIN_SERVICE_ACCESS_REQUEST_URL}/${request.id}`;

    if (intercom) {
        const [conversation, message] = await intercom.startConversation(user, body);

        await AccessRequestConversation.create({
            access_request_id: request.id,
            intercom_message_id: message.id,
            intercom_conversation_id: conversation.id
        });

        await intercom.addNoteToConversation(conversation.id, linkText);
        await intercom.replyToConversation(conversation.id, responseMessage);
        await intercom.assignConversation(conversation.id, process.env.INTERCOM_ADMIN_TIER1_DATA_WATCH_ID);
    }

    if (process.env.BCC_INTERCOM) {
        const message = body + "\n\n" + linkText
        emailGenericMessage({ 
            to: process.env.BCC_INTERCOM,
            subject: 'User Portal Data Watch Request',
            message
        })
    }
}

module.exports = { approveRequest, grantRequest };
