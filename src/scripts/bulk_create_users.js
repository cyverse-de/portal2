#!/usr/bin/env node
const crypto = require('crypto')
const { ArgumentParser } = require('argparse')
const models = require('../api/models')
const { userCreationWorkflow } = require('../api/workflows/native/user.js')
const { serviceRegistrationWorkflow } = require('../api/workflows/native/services')

const MAX_USERS = 100
const SERVICES = [1, 2, 3] // Atmosphere, Discovery Environment, Data Commons

async function createUser(username, email, args) {
  console.log(username, email)

  const fields = {
    username,
    email,
    'first_name': 'Workshop',
    'last_name': 'User',
    'grid_institution_id': 1, // other
    'institution': 'other',
    'department': 'CyVerse',
    'occupation_id': 13, // not provided
    'research_area_id': 155, // not provided
    'funding_agency_id': 21, // not provided
    'country_id': 249, // not provided
    'region_id': 4585, // not provided
    'gender_id': 11, // not provided
    'ethnicity_id': 8, // not provided
    'aware_channel_id': 11, // not provided
    'password': crypto.createHash('md5').update(username).digest('hex').substring(0, 8),
    'is_superuser': false,
    'is_staff': false,
    'is_active': true,
    'has_verified_email': false,
    'participate_in_study': true,
    'subscribe_to_newsletter': true,
    'orcid_id': '',
    'updated_at': Date.now()
  }

  // Create user
  let newUser = await models.account_user.create(fields)
  if (!newUser)
      throw('Error creating user')
  newUser = await models.account_user.unscoped().findByPk(newUser.id, { include: [ 'occupation' ] })

  // Create primary email address
  const emailAddress = await models.account_emailaddress.create({
      user_id: newUser.id,
      email: newUser.email,
      primary: true,
      verified: true
  })
  if (!emailAddress)
      throw('Error creating email address')

  await userCreationWorkflow(newUser);

  for (let serviceId of SERVICES) {
    const service = await models.api_service.findByPk(serviceId)

    const request = await models.api_accessrequest.create({
      service_id: serviceId,
      user_id: newUser.id,
      auto_approve: true,
      status: models.api_accessrequest.constants.STATUS_REQUESTED,
      message: models.api_accessrequest.constants.MESSAGE_REQUESTED
    });

    request.service = service
    request.user = newUser;

    await serviceRegistrationWorkflow(request);
  }
}


async function main() {
  const parser = new ArgumentParser({ description: 'Bulk user creation for workshops' })
  parser.add_argument('-u', '--username', { required: true, help: 'Username prefix for new users' })
  parser.add_argument('-e', '--email', { required: true, help: 'Email address for new users (must be Gmail)' })
  parser.add_argument('-n', '--number', { required: true, type: 'int', help: 'Number of new users to create' })
  parser.add_argument('-s', '--start', { type: 'int', default: 1, help: 'Start of numbering' })	
  parser.add_argument('-f', '--force', { action: 'store_true', help: 'Ignore warnings and force creation' })
  args = parser.parse_args()

  if (args.number > MAX_USERS && !args.force) {
    console.log('Too many users, use -f to ignore')
    process.exit(1)
  }

  for (let i = args.start; i < args.number + args.start; i++) {
    const id = i.toString().padStart(args.number.toString().length, '0')
    const username = args.username + id
    const position = args.email.indexOf('@')
    const email = args.email.substring(0, position) + '+' + username + args.email.substring(position)
    await createUser(username, email, args)
  }
  await models.sequelize.close()

  console.log('All done, created', args.number, 'users')
}

main()
