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

// Determine whether or not we should use locally installed iCommands. This function assumes that locally installed
// iCommands are supposed to be used if and only if every iRODS connection setting environment variable contains a
// truthy value. This function is memoized to reduce repetitive (albeit not very expensive) computation.
const useLocalICommands = (function () {
    let cache = {}
    return function () {
        if (!('result' in cache)) {
            cache['result'] = [
                process.env.IRODS_HOST,
                process.env.IRODS_PORT,
                process.env.IRODS_ZONE_NAME,
                process.env.IRODS_USER_NAME,
                process.env.IRODS_PASSWORD,
            ].every(v => v)
        }
        return cache['result']
    }
})()

// Initializes the iRODS connection. Note: we use the same environment variables that iinit uses, so there's no need to
// pass the settings on the command line or respond to prompts. The only exception is the password, which doesn't have
// an official environment variable, but can be passed on the command line. This function is memoized so that the
// connection is only initialized once.
const initializeICommands = (function () {
    let cache = { initialized: false }
    return async function () {
        // if the file does not exist HOME/.irods/irods_environment.json
        if (
            !fs.existsSync(process.env.HOME + '/.irods/irods_environment.json')
        ) {
            var irodsEnvironment = {
                irods_host: process.env.IRODS_HOST,
                irods_zone_name: process.env.IRODS_ZONE_NAME,
                irods_port: parseInt(process.env.IRODS_PORT),
                irods_user_name: process.env.IRODS_USER_NAME,
            }
            dictstring = JSON.stringify(irodsEnvironment)
            try {
                if (!fs.existsSync(process.env.HOME + '/.irods')) {
                    fs.mkdirSync(process.env.HOME + '/.irods')
                }
                await fs.promises.writeFile(
                    process.env.HOME + '/.irods/irods_environment.json',
                    dictstring
                )
            } catch (err) {
                console.error(err)
            }
        }
        if (!cache['initialized']) {
            execSync('iinit', { input: process.env.IRODS_PASSWORD })
            cache['initialized'] = true
        }
    }
})()

// Runs one of the iCommands in a Docker container for environments where the iCommands can't be installed locally.
// For this to work, the Docker image must have the iCommands initialized already.
function dockerRun(args) {
    return runFile('docker', [
        'run',
        '--rm',
        process.env.NATIVE_WORKFLOW_IMAGE_ID,
        ...args,
    ])
}

// Runs one of the icommands commands. If all if the IRODS connection settings environment variables contain truthy
// values then locally installed iCommands will be used. Otherwise, the NATIVE_WORKFLOW_IMAGE_ID environment variable
// must be defined and the command will be run in a Docker container created from that image.
function runICommands(args) {
    if (useLocalICommands()) {
        initializeICommands()
        return runFile(args[0], args.slice(1))
    } else {
        return dockerRun(args)
    }
}

function ldapGetUser(username) {
    return runFile('ldapsearch', [
        '-H',
        process.env.LDAP_HOST,
        '-x',
        '-LLL',
        '-o',
        'nettimeout=5', // shorten the network timeout, default 30s causes API requests to timeout
        `uid=${username}`,
    ])
}

function ldapCreateUser(user) {
    // Calculate number of days since epoch (needed for LDAP)
    const daysSinceEpoch = Math.floor(new Date() / 8.64e7)

    // Calculate uidNumber
    // Old method: /repos/portal/cyverse_ldap/utils/get_uid_number.py
    const uidNumber = user.id + process.env.UID_NUMBER_OFFSET

    // username and occupation name will be shell safe values but others should be escaped
    return run(
        `echo "dn: uid=${user.username},ou=People,${
            process.env.LDAP_BASE_DN
        }\nobjectClass: posixAccount\nobjectClass: shadowAccount\nobjectClass: inetOrgPerson\ngivenName: ${escapeShell(
            user.first_name
        )}\nsn: ${escapeShell(user.last_name)}\ncn: ${escapeShell(
            user.first_name + ' ' + user.last_name
        )}\nuid: ${user.username}\nmail: ${escapeShell(
            user.email
        )}\ndepartmentNumber: ${escapeShell(user.department)}\no: ${escapeShell(
            user.institution
        )}\ntitle: ${user.occupation.name}\nhomeDirectory: /home/${
            user.username
        }\nloginShell: /bin/bash\ngidNumber: 10013\nuidNumber: ${uidNumber}\nshadowLastChange:${daysSinceEpoch}\nshadowMin: 1\nshadowMax: 730\nshadowInactive: 10\nshadowWarning: 10" | ldapadd -H ${
            process.env.LDAP_HOST
        } -D ${process.env.LDAP_ADMIN} -w ${
            process.env.LDAP_PASSWORD
        } -o nettimeout=5`
    )
}

function ldapModify(username, attribute, value) {
    // username and attribute will be shell safe values but value should be escaped
    return run(
        `echo "dn: uid=${username},ou=People,${
            process.env.LDAP_BASE_DN
        }\nreplace: ${attribute}\n${attribute}: ${escapeShell(
            value
        )}" | ldapmodify -H ${process.env.LDAP_HOST} -D ${
            process.env.LDAP_ADMIN
        } -w ${process.env.LDAP_PASSWORD} -o nettimeout=5`
    )
}

function ldapChangePassword(username, password) {
    return runFile('ldappasswd', [
        '-H',
        process.env.LDAP_HOST,
        '-D',
        process.env.LDAP_ADMIN,
        '-w',
        process.env.LDAP_PASSWORD,
        '-s',
        password,
        '-o',
        'nettimeout=5', // shorten the network timeout, default 30s causes API requests to timeout
        `uid=${username},ou=People,${process.env.LDAP_BASE_DN}`,
    ])
}

function ldapAddUserToGroup(username, group) {
    return run(
        `echo "dn: cn=${group},ou=Groups,${process.env.LDAP_BASE_DN}\nchangetype: modify\nadd: memberUid\nmemberUid: ${username}" | ldapmodify -H ${process.env.LDAP_HOST} -D ${process.env.LDAP_ADMIN} -w ${process.env.LDAP_PASSWORD} -o nettimeout=5`
    )
}

function ldapDeleteUser(username) {
    return runFile('ldapdelete', [
        '-H',
        process.env.LDAP_HOST,
        '-D',
        process.env.LDAP_ADMIN,
        '-w',
        process.env.LDAP_PASSWORD,
        '-o',
        'nettimeout=5', // shorten the network timeout, default 30s causes API requests to timeout
        `uid=${username},ou=People,${process.env.LDAP_BASE_DN}`,
    ])
}

function irodsCreateUser(username) {
    return runICommands(['iadmin', 'mkuser', username, 'rodsuser'])
}

function irodsMkDir(path) {
    return runICommands(['imkdir', '-p', path])
}

function irodsChMod(permission, username, path) {
    return runICommands(['ichmod', permission, username, path])
}

function irodsChangePassword(username, password) {
    return runICommands([
        'iadmin',
        'moduser',
        username,
        'password',
        '--',
        password,
    ]) // UP-61 added "--" argument for passwords that start with a hyphen
}

// See https://cyverse.atlassian.net/browse/UP-82
async function irodsSafeDeleteHome(username) {
    await runICommands([
        'irm',
        '-rf',
        `/${process.env['IRODS_ZONE_NAME']}/trash/home/` + username,
    ])
    await runICommands([
        'imv',
        `/${process.env['IRODS_ZONE_NAME']}/home/` + username,
        `/${process.env['IRODS_ZONE_NAME']}/trash/home/uportal_admin2/`,
    ])
}

function irodsDeleteUser(username) {
    return runICommands(['iadmin', 'rmuser', username])
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
    ldapGetUser,
    ldapCreateUser,
    ldapModify,
    ldapChangePassword,
    ldapAddUserToGroup,
    ldapDeleteUser,
    irodsCreateUser,
    irodsMkDir,
    irodsChMod,
    irodsChangePassword,
    irodsSafeDeleteHome,
    irodsDeleteUser,
    mailchimpSubscribe,
    mailchimpDelete,
    mailmanUpdateSubscription,
    terrainGetKeycloakToken,
    terrainSetConcurrentJobLimits,
    terrainSubmitViceAccessRequest,
    terrainBootstrapRequest,
}
