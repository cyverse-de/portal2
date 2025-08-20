const router = require('express').Router()
const util = require('util')
const Argo = require('./lib/argo')

router.post('/bisque', async (req, res) => {
    console.log('BisQue test')
    console.log(req.body)
    return res.status(200).send('success')
})

router.get('/submit', async (req, res) => {
    console.log('Argo submit test')
    const resp = await Argo.submit('user.yaml', 'create-user', {
        user_id: 'mbomhoff',
        user_id_number: 1234,
        password: 'FIXME',
        email: 'mbomhoff@email.arizona.edu',
        ldap_host: 'ldap://pollit.iplantcollaborative.org',
        ldap_admin: 'cn=MANAGER,dc=iplantcollaborative,dc=org',
        ldap_password: 'QA-iplantLDAP',
        portal_api_base_url: 'http://10.0.2.15:3022',
        mailchimp_username: 'FIXME',
        mailchimp_api_key: 'FIXME',
        mailchimp_list_id: 'FIXME',
        user_id_number: 'FIXME',
        first_name: 'Matt',
        last_name: 'Bomhoff',
        department: 'foo',
        organization: 'foo',
        title: 'Software Developer',
    })
    //await Argo.submit('/Users/mbomhoff/repos/portal2/src/workflows/argo/helloworld.yaml');
    return res.status(200).send('success')
})

module.exports = router
