const fs = require('fs');
const path = require('path');
// const sendmail = require('sendmail')({ silent: false });
const sendmail = require('sendmail')({ silent: false, smtpPort: process.env["SMTP_PORT"], smtpHost: process.env["SMTP_HOST"] });
const { logger } = require('./logging');
const { UI_WORKSHOPS_URL, UI_REQUESTS_URL, UI_SERVICES_URL, UI_PASSWORD_URL, UI_CONFIRM_EMAIL_URL } = require('../../constants');

const TIME_BETWEEN_EMAILS = 0 // No pause between sending emails.
let nextEmailSendTime = 0

function queueEmail(cfg) {
    const now = Date.now();
    nextEmailSendTime = Math.max(now, nextEmailSendTime + TIME_BETWEEN_EMAILS);
    const delay = nextEmailSendTime - now

    setTimeout(
        () => sendmail(cfg),
        delay + 100 // add small delay so log message can appear first
    );

    logger.debug(`queueEmail: queued ${cfg.to} "${cfg.subject}" for ${delay/1000}s`);
}

function renderEmail({ to, bcc, subject, templateName, fields, message }) {
    if (!to || !subject || (!templateName && !message))
        throw('Missing required field')
        
    const body = {};

    // Load and populate email template
    if (templateName) {
        for (let ext of ['html', 'txt']) {
            const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.${ext}`);
            if (fs.existsSync(templatePath)) {
                body[ext] = fs.readFileSync(templatePath, 'utf8').toString(); 
                for (f in fields) {
                    const regex = new RegExp('\\$\\{' + f + '\\}', 'gi');
                    body[ext] = body[ext].replace(regex, fields[f]);
                }
                if (!body[ext])
                    throw('Empty email template');
                break; // only load txt template if html template doesn't exist
            }
        }
    }
    else {
        body['txt'] = message
    }

    if (Array.isArray(to))
        to = to.join(',');

    const cfg = {
        from: 'support@cyverse.org', //FIXME move into config file
        to,
        subject
    };

    if (bcc) {
        if (Array.isArray(bcc))
            bcc = bcc.join(',');
        cfg['bcc'] = bcc;
    }

    if (body['html'])
        cfg.html = body['html']
    else
        cfg.text = body['txt']

    return cfg;
}

function emailNewAccountConfirmation(email, hmac) {
    const confirmationUrl = `${UI_PASSWORD_URL}?code=${hmac}`;
    logger.debug('emailNewAccountConfirmation:', email, confirmationUrl);
    queueEmail(
        renderEmail({
            to: email, 
            bcc: process.env.BCC_NEW_ACCOUNT_CONFIRMATION,
            subject: 'Please Confirm Your E-Mail Address',
            templateName: 'email_confirmation_signup',
            fields: {
                "ACTIVATE_URL": confirmationUrl,
                "FORMS_URL": UI_REQUESTS_URL
            }
        })
    );
}

async function emailNewEmailConfirmation(email, hmac) {
    const confirmationUrl = `${UI_CONFIRM_EMAIL_URL}?code=${hmac}`;
    logger.debug('emailNewEmailConfirmation:', email, confirmationUrl);
    queueEmail(
        renderEmail({
            to: email, 
            //bcc: null,
            subject: 'CyVerse Email Confirmation',
            templateName: 'add_email_confirmation',
            fields: {
                "ACTIVATE_URL": confirmationUrl,
            }
        })
    );
}

async function emailPasswordReset(emailAddress, hmac) {
    const resetUrl = `${UI_PASSWORD_URL}?reset&code=${hmac}`;
    logger.debug('emailPasswordReset:', emailAddress.email, resetUrl);
    queueEmail(
        renderEmail({
            to: emailAddress.email, 
            bcc: process.env.BCC_PASSWORD_CHANGE_REQUEST,
            subject: 'CyVerse Password Reset',
            templateName: 'password_reset',
            fields: {
                "PASSWORD_RESET_URL": resetUrl,
                "USERNAME": emailAddress.user.username
            }
        })
    );
}

async function emailServiceAccessGranted(request) {
    const service = request.service;
    const user = request.user;
    const serviceUrl = `${UI_SERVICES_URL}/${service.id}`;
    logger.debug('emailServiceAccessGranted:', user.email, serviceUrl);

    queueEmail(
        renderEmail({
            to: user.email, 
            bcc: process.env.BCC_SERVICE_ACCESS_GRANTED,
            subject: 'CyVerse Service Access Granted',
            templateName: 'access_granted',
            fields: {
                "SERVICE_NAME": service.name,
                "SERVICE_URL": serviceUrl
            }
        })
    );
}

async function emailWorkshopEnrollmentRequest(request) {
    const workshop = request.workshop;
    const user = request.user;
    const workshopEnrollmentRequestUrl = `${UI_WORKSHOPS_URL}/${workshop.id}?t=requests`;
    logger.debug('emailWorkshopEnrollmentRequest:', user.email, workshopEnrollmentRequestUrl);

    if (!workshop.owner) { // should never happen
      logger.error('No owner for workshop', request.workshop.id);
      return;
    }
    
    queueEmail(
        renderEmail({
            to: workshop.owner.email, 
            bcc: process.env.BCC_WORKSHOP_ENROLLMENT_REQUEST,
            subject: 'CyVerse Workshop Enrollment Request',
            templateName: 'review_workshop_enrollment_request',
            fields: {
                "WORKSHOP_NAME": workshop.title,
                "FULL_NAME": `${user.first_name} ${user.last_name}`,
                "USERNAME": user.username,
                "EMAIL": user.email,
                "INSTITUTION": user.institution,
                "COUNTRY": user.region.country.name,
                "WORKSHOP_ENROLLMENT_REQUEST_URL": workshopEnrollmentRequestUrl
            }
        })
    );
}

function emailWorkshopEnrollmentConfirmation(request) {
    const workshop = request.workshop;
    const user = request.user;
    const workshopUrl = `${UI_WORKSHOPS_URL}/${workshop.id}`;
    logger.debug('emailWorkshopEnrollmentConfirmation:', user.email, workshopUrl);

    queueEmail(
        renderEmail({
            to: user.email, 
            bcc: process.env.BCC_WORKSHOP_ENROLLMENT_REQUEST,
            subject: 'CyVerse Workshop Enrollment Approved',
            templateName: 'workshop_enrollment',
            fields: {
                "WORKSHOP_NAME": workshop.title,
                "WORKSHOP_URL": workshopUrl
            }
        })
    );
}

async function emailGenericMessage(opts) {
    logger.debug('emailGenericMessage:', opts.to, opts.subject);

    queueEmail(
        renderEmail(opts)
    );
}

module.exports = { 
    emailNewAccountConfirmation, 
    emailNewEmailConfirmation,
    emailPasswordReset,
    emailServiceAccessGranted, 
    emailWorkshopEnrollmentRequest, 
    emailWorkshopEnrollmentConfirmation,
    emailGenericMessage
};
