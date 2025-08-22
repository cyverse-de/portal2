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

    return fetch(`${baseUrl}/${endpoint}?${params}`, {
        method: 'POST',
    })
}

function terrainGetKeycloakToken() {
    return fetch(`${process.env.TERRAIN_URL}/token/keycloak`, {
        method: 'GET',
        headers: {
            Authorization:
                'Basic ' +
                Buffer.from(
                    process.env.TERRAIN_USER +
                        ':' +
                        process.env.TERRAIN_PASSWORD
                ).toString('base64'),
        },
    }).then(res => res.text())
}

function terrainSetConcurrentJobLimits(token, username, limit) {
    return fetch(
        `${process.env.TERRAIN_URL}/admin/settings/concurrent-job-limits/${username}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ concurrent_jobs: limit }),
        }
    ).then(res => res.text())
}

function terrainSubmitViceAccessRequest(token, user, usage) {
    const data = {
        name: user.first_name + ' ' + user.last_name,
        email: user.email,
        intended_use: usage,
        concurrent_jobs: 2, //FIXME hardcoded
    }

    return fetch(`${process.env.TERRAIN_URL}/requests/vice`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    }).then(res => res.text())
}

function terrainBootstrapRequest(token) {
    return fetch(`${process.env.TERRAIN_URL}/secured/bootstrap`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(res => res.text())
}

module.exports = {
    run,
    mailmanUpdateSubscription,
    terrainGetKeycloakToken,
    terrainSetConcurrentJobLimits,
    terrainSubmitViceAccessRequest,
    terrainBootstrapRequest,
}
