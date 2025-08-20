// cURL is used for HTTP requests instead of native request because many of these tasks were ported from Argo workflows
const fs = require('fs')
const { exec, execFile, execSync } = require('child_process')
var crypto = require('crypto')

// Escape args with escapeShell() or use runFile() instead
function run(strOrArray) {
    let cmdStr = strOrArray
    if (Array.isArray(strOrArray)) cmdStr = strOrArray.join(' ')

    console.log('run: ' + cmdStr)

    return new Promise(function (resolve, reject) {
        exec(cmdStr, (error, stdout, stderr) => {
            console.log('run:stdout:', stdout)
            console.log('run:stderr:', stderr)

            if (error) {
                console.log('run:error:', error)
                reject(error)
            } else {
                resolve(stdout)
            }
        })
    })
}

// Safer than run, escaping of args not required
function runFile(cmd, args) {
    console.log('run:', cmd, args.join(' '))

    return new Promise(function (resolve, reject) {
        execFile(cmd, args, (error, stdout, stderr) => {
            console.log('run:stdout:', stdout)
            console.log('run:stderr:', stderr)

            if (error) {
                console.log('run:error:', error)
                reject(error)
            } else {
                resolve(stdout)
            }
        })
    })
}

function mailchimpSubscribe(email, firstName, lastName) {
    const data = {
        email_address: email,
        status: 'subscribed',
        merge_fields: {
            FNAME: firstName,
            LNAME: lastName,
        },
        tags: process.env.MAILCHIMP_TAGS
            ? process.env.MAILCHIMP_TAGS.split(',')
            : [],
    }
    return runFile('curl', [
        '--request',
        'POST',
        '--location',
        '--header',
        `Authorization: Basic ${process.env.MAILCHIMP_API_KEY}`,
        '--header',
        'Content-Type: application/json',
        '--data',
        JSON.stringify(data),
        `${process.env.MAILCHIMP_URL}/lists/${process.env.MAILCHIMP_LIST_ID}/members`,
    ])
}

function mailchimpDelete(email) {
    const hash = crypto.createHash('md5').update(email).digest('hex')
    return runFile('curl', [
        '--request',
        'POST',
        '--location',
        '--header',
        `Authorization: Basic ${process.env.MAILCHIMP_API_KEY}`,
        `${process.env.MAILCHIMP_URL}/lists/${process.env.MAILCHIMP_LIST_ID}/members/${hash}/actions/delete-permanent`,
    ])
}

function mailmanUpdateSubscription(listName, email, subscribe) {
    const baseUrl = `${process.env.MAILMAN_URL}/mailman/admin/${listName}/members`

    let params, endpoint
    if (subscribe) {
        params = new URLSearchParams({
            subscribe_or_invite: 0,
            send_welcome_msg_to_this_batch: 0,
            subscribees_upload: email,
            adminpw: process.env.MAILMAN_PASSWORD,
        }).toString()

        endpoint = 'add'
    } else {
        params = new URLSearchParams({
            send_unsub_ack_to_this_batch: 0,
            send_unsub_notifications_to_list_owner: 0,
            unsubscribees_upload: email,
            adminpw: process.env.MAILMAN_PASSWORD,
        }).toString()

        endpoint = 'remove'
    }

    return runFile('curl', [
        '--location',
        '-X',
        'POST',
        `${baseUrl}/${endpoint}?${params}`,
    ])
}

function terrainGetKeycloakToken() {
    return runFile('curl', [
        '--location',
        '--user',
        process.env.TERRAIN_USER + ':' + process.env.TERRAIN_PASSWORD,
        `${process.env.TERRAIN_URL}/token/keycloak`,
    ])
}

function terrainSetConcurrentJobLimits(token, username, limit) {
    return runFile('curl', [
        '--request',
        'PUT',
        '--location',
        '--header',
        `Authorization: Bearer ${token}`,
        '--header',
        'Content-Type: application/json',
        '--data',
        JSON.stringify({ concurrent_jobs: limit }),
        `${process.env.TERRAIN_URL}/admin/settings/concurrent-job-limits/${username}`, //FIXME define URL in constants.js
    ])
}

function terrainSubmitViceAccessRequest(token, user, usage) {
    const data = {
        name: user.first_name + ' ' + user.last_name,
        email: user.email,
        intended_use: usage,
        concurrent_jobs: 2, //FIXME hardcoded
    }

    return runFile('curl', [
        '--request',
        'POST',
        '--location',
        '--header',
        `Authorization: Bearer ${token}`,
        '--header',
        'Content-Type: application/json',
        '--data',
        JSON.stringify(data),
        `${process.env.TERRAIN_URL}/requests/vice`, //FIXME define URL in constants.js
    ])
}

function terrainBootstrapRequest(token) {
    return runFile('curl', [
        '--location',
        '--header',
        `Authorization: Bearer ${token}`,
        `${process.env.TERRAIN_URL}/secured/bootstrap`, //FIXME define URL in constants.js
    ])
}

function escapeShell(cmd) {
    if (typeof cmd != 'undefined' && cmd.length > 0)
        return cmd.replace(/(["'`\\])/g, '\\$1')
    return ''
}

module.exports = {
    run,
    mailchimpSubscribe,
    mailchimpDelete,
    mailmanUpdateSubscription,
    terrainGetKeycloakToken,
    terrainSetConcurrentJobLimits,
    terrainSubmitViceAccessRequest,
    terrainBootstrapRequest,
}
