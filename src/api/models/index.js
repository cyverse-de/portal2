/**
 * Sequelize Models and Assocations
 *
 * Model files were automaticallly generated using sequelize-auto.
 * Customizations are made here.
 *
 */

const fs = require('fs')
const path = require('path')
const { Sequelize } = require('sequelize')

// Load config into process.env #FIXME in all other files this is handled by Next.js
const env = require('node-env-file')
env(__dirname + '../../../../.env.local', { raise: false })
env(__dirname + '../../../../.env', { raise: false })

/**
 * Connect to database
 */

console.log(
    'Connecting to db:',
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_NAME,
    process.env.DB_USER
)
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false, //process.env.DB_LOGGING,
        define: {
            timestamps: false,
            freezeTableName: true,
            underscored: true,
        },
        //    pool: {
        //      max: dbConfig.pool.max,
        //      min: dbConfig.pool.min,
        //      acquire: dbConfig.pool.acquire,
        //      idle: dbConfig.pool.idle
        //    }
    }
)

/**
 * Load models
 */

let modelPath = path.resolve(process.cwd(), 'src/api/models') // __dirname not working in Next.js
let models = {}
fs.readdirSync(modelPath)
    .filter(file => file.split('.').pop() === 'js' && file !== 'index.js')
    .forEach(file => {
        const model = require(path.join(modelPath, file))(
            sequelize,
            Sequelize.DataTypes
        )
        models[model.name] = model
    })

/**
 * Define associations
 */

models.account_user.belongsTo(models.account_ethnicity, { as: 'ethnicity' })
models.account_user.belongsTo(models.account_fundingagency, {
    as: 'funding_agency',
})
models.account_user.belongsTo(models.account_gender, { as: 'gender' })
models.account_user.belongsTo(models.account_occupation, { as: 'occupation' })
models.account_user.belongsTo(models.account_region, { as: 'region' })
models.account_user.belongsTo(models.account_researcharea, {
    as: 'research_area',
})
models.account_user.belongsTo(models.account_awarechannel, {
    as: 'aware_channel',
})
models.account_user.hasMany(models.account_emailaddress, {
    as: 'emails',
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_user.hasMany(models.api_accessrequestanswer, {
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_user.belongsToMany(models.api_service, {
    as: 'services',
    through: models.api_accessrequest,
    foreignKey: 'user_id',
    otherKey: 'service_id',
})
models.account_user.belongsToMany(models.api_workshop, {
    as: 'workshops',
    through: models.api_workshopenrollmentrequest,
    foreignKey: 'user_id',
    otherKey: 'workshop_id',
})
models.account_user.hasMany(models.api_accessrequest, {
    as: 'access_requests',
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_user.hasMany(models.api_workshopenrollmentrequest, {
    as: 'enrollment_requests',
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_user.hasMany(models.api_formsubmission, {
    as: 'form_submissions',
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_user.hasMany(models.account_passwordresetrequest, {
    as: 'password_reset_requests',
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_user.hasMany(models.account_passwordreset, {
    as: 'password_resets',
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true,
})

models.account_emailaddress.belongsToMany(models.api_mailinglist, {
    as: 'mailing_lists',
    through: models.api_emailaddressmailinglist,
    foreignKey: 'email_address_id',
    otherKey: 'mailing_list_id',
})
models.account_emailaddress.hasMany(models.api_emailaddressmailinglist, {
    foreignKey: 'email_address_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_emailaddress.hasMany(models.account_passwordresetrequest, {
    foreignKey: 'email_address_id',
    onDelete: 'cascade',
    hooks: true,
})
models.account_emailaddress.belongsTo(models.account_user, {
    as: 'user',
    foreignKey: 'user_id',
})

models.api_mailinglist.belongsTo(models.api_service, {
    as: 'service',
    foreignKey: 'service_id',
})

models.account_region.belongsTo(models.account_country, { as: 'country' })

models.api_service.hasMany(models.api_poweredservice, {
    as: 'powered_services',
    foreignKey: 'service_ptr_id',
})
models.api_service.hasMany(models.api_contact, {
    as: 'contacts',
    foreignKey: 'service_id',
})
models.api_service.hasMany(models.api_serviceresource, {
    as: 'resources',
    foreignKey: 'service_id',
})
models.api_service.belongsToMany(models.api_form, {
    as: 'forms',
    through: models.api_serviceform,
    foreignKey: 'service_id',
    otherKey: 'form_id',
})
models.api_service.belongsTo(models.api_servicemaintainer, {
    as: 'service_maintainer',
})
// models.api_service.hasMany(models.api_accessrequest, { as: 'requests', foreignKey: 'service_id' });
models.api_service.hasMany(models.api_accessrequestquestion, {
    as: 'questions',
    foreignKey: 'service_id',
})
models.api_cyverseservice.belongsTo(models.api_service, {
    as: 'service',
    foreignKey: 'service_ptr_id',
})

models.api_accessrequestquestion.hasMany(models.api_accessrequestanswer, {
    as: 'answers',
    foreignKey: 'access_request_question_id',
})

models.api_accessrequest.belongsTo(models.account_user, { as: 'user' })
models.api_accessrequest.belongsTo(models.api_service, { as: 'service' })
models.api_accessrequest.hasMany(models.api_accessrequestlog, {
    as: 'logs',
    foreignKey: 'access_request_id',
    onDelete: 'cascade',
    hooks: true,
})
models.api_accessrequest.hasMany(models.api_accessrequestconversation, {
    as: 'conversations',
    foreignKey: 'access_request_id',
    onDelete: 'cascade',
    hooks: true,
})

models.api_workshop.belongsTo(models.account_user, {
    as: 'owner',
    foreignKey: 'creator_id',
})
models.api_workshop.hasMany(models.api_workshopuseremail, {
    as: 'emails',
    foreignKey: 'workshop_id',
})
models.api_workshop.belongsToMany(models.api_service, {
    as: 'services',
    through: models.api_workshopservice,
    foreignKey: 'workshop_id',
    otherKey: 'service_id',
})
models.api_workshop.belongsToMany(models.account_user, {
    as: 'users',
    through: models.api_userworkshop,
    foreignKey: 'workshop_id',
    otherKey: 'user_id',
})
models.api_workshop.belongsToMany(models.account_user, {
    as: 'organizers',
    through: models.api_workshoporganizer,
    foreignKey: 'workshop_id',
    otherKey: 'organizer_id',
})
models.api_workshop.hasMany(models.api_workshopcontact, {
    as: 'contacts',
    foreignKey: 'workshop_id',
})
models.api_workshop.hasMany(models.api_workshopenrollmentrequest, {
    as: 'requests',
    foreignKey: 'workshop_id',
})

models.api_workshopenrollmentrequest.belongsTo(models.account_user, {
    as: 'user',
    foreignKey: 'user_id',
})
models.api_workshopenrollmentrequest.belongsTo(models.api_workshop, {
    as: 'workshop',
    foreignKey: 'workshop_id',
})
models.api_workshopenrollmentrequest.hasMany(
    models.api_workshopenrollmentrequestlog,
    {
        as: 'logs',
        foreignKey: 'workshop_enrollment_request_id',
        onDelete: 'cascade',
        hooks: true,
    }
)

models.api_formgroup.belongsToMany(models.api_form, {
    as: 'forms',
    through: models.api_formgroupform,
    foreignKey: 'form_group_id',
    otherKey: 'form_id',
})
models.api_form.hasMany(models.api_formsection, {
    as: 'sections',
    foreignKey: 'form_id',
})
models.api_formsection.hasMany(models.api_formfield, {
    as: 'fields',
    foreignKey: 'form_section_id',
})
models.api_formfield.hasMany(models.api_formfieldoption, {
    as: 'options',
    foreignKey: 'form_field_id',
})
// models.api_form.belongsToMany(models.api_intercomteam,
//   { as: 'intercom_teams', through: models.api_formintercomteam, foreignKey: 'form_id', otherKey: 'intercom_team_id' });

models.api_formsubmission.belongsTo(models.api_form, {
    as: 'form',
    foreignKey: 'form_id',
})
models.api_formsubmission.belongsTo(models.account_user, {
    as: 'user',
    foreignKey: 'user_id',
})
models.api_formsubmission.belongsToMany(models.api_formfield, {
    as: 'fields',
    through: models.api_formfieldsubmission,
    foreignKey: 'form_submission_id',
    otherKey: 'form_field_id',
})
models.api_formsubmission.hasMany(models.api_formfieldsubmission, {
    as: 'field_submissions',
    foreignKey: 'form_submission_id',
    onDelete: 'cascade',
    hooks: true,
})
models.api_formsubmission.hasMany(models.api_formsubmissionconversation, {
    as: 'conversations',
    foreignKey: 'form_submission_id',
    onDelete: 'cascade',
    hooks: true,
})

/**
 * Define scopes
 */

models.account_occupation.addScope('defaultScope', {
    attributes: ['id', 'name'],
})

models.account_researcharea.addScope('defaultScope', {
    attributes: ['id', 'name'],
})

models.account_fundingagency.addScope('defaultScope', {
    attributes: ['id', 'name'],
})

models.account_ethnicity.addScope('defaultScope', {
    attributes: ['id', 'name'],
})

models.account_gender.addScope('defaultScope', {
    attributes: ['id', 'name'],
})

models.account_awarechannel.addScope('defaultScope', {
    attributes: ['id', 'name'],
})

models.api_mailinglist.addScope('defaultScope', {
    attributes: ['id', 'name', 'list_name', 'service_id'],
})

models.account_region.addScope('defaultScope', {
    attributes: ['id', 'code', 'name', 'country_id'],
    include: [
        {
            model: models.account_country,
            as: 'country',
            attributes: ['code', 'name'],
        },
    ],
})

models.account_emailaddress.addScope('defaultScope', {
    attributes: ['id', 'email', 'verified', 'primary'],
    include: [
        {
            model: models.api_mailinglist,
            as: 'mailing_lists',
            through: { attributes: ['is_subscribed'] },
        },
    ],
})

models.account_user.addScope('defaultScope', {
    attributes: {
        exclude: [
            'last_login', // no longer used
            'is_active', // no longer used
            'has_verified_email', // no longer used
            'password', // important to exclude for security
            'user_institution_id', // no longer used
        ],
    },
    include: [
        'region',
        'occupation',
        'research_area',
        'funding_agency',
        'ethnicity',
        'gender',
        'aware_channel',
        'emails',
        'services',
        'workshops',
    ],
})

models.account_user.addScope('profile', {
    attributes: {
        exclude: [
            'settings',
            'last_login',
            'is_active',
            'ethnicity_id',
            'ethnicityId',
            'funding_agency_id',
            'fundingAgencyId',
            'gender_id',
            'genderId',
            'has_verified_email',
            'occupation_id',
            'occupationId',
            'password',
            'region_id',
            'regionId',
            'research_area_id',
            'researchAreaId',
            'aware_channel_id',
            'awareChannelId',
            'user_institution_id',
        ],
    },
    include: [
        'region',
        'occupation',
        'research_area',
        'funding_agency',
        'ethnicity',
        'gender',
        'aware_channel',
    ],
})

// models.api_formgroup.addScope('defaultScope',
//   { order: [ ['index', 'ASC'] ],
//     include: [
//       { model: models.api_form,
//         as: 'forms',
//         through: { attributes: [] } // remove connector table
//       }
//     ]
//   }
// );

// models.api_form.addScope('defaultScope',
//   { order: [ ['sections', 'index', 'ASC'] ],
//     include: [
//       { model: models.api_formsection,
//         as: 'sections',
//         include: [ 'fields' ],
//         order: [ ['fields', 'index', 'ASC'] ]
//       }
//     ]
//   }
// );
//
// models.api_service.addScope('defaultScope',
//   { include: [
//       'powered_services',
//       'contacts',
//       'resources',
//       { model: models.api_form,
//         as: 'forms',
//         through: { attributes: [] } // remove connector table
//       },
//       'service_maintainer'
//     ]
//   }
// );
//
// models.api_workshop.addScope('defaultScope',
//   { include: [
//       { model: models.api_service,
//         as: 'services',
//         through: { attributes: [] } // remove connector table
//       }
//     ]
//   }
// );

/**
 * Define hooks
 */

// Automatically log changes to service access request status
models.api_accessrequest.afterUpdate('afterUpdateRequest', async request => {
    await models.api_accessrequestlog.create({
        access_request_id: request.id,
        status: request.status,
        message: request.message,
    })
})

// Automatically log changes to workshop enrollment request status
models.api_workshopenrollmentrequest.afterUpdate(
    'afterUpdateRequest',
    async request => {
        await models.api_workshopenrollmentrequestlog.create({
            workshop_enrollment_request_id: request.id,
            status: request.status,
            message: request.message,
        })
    }
)

/**
 * Define class/instance methods
 */

// Service access request
models.api_accessrequest.constants = {
    STATUS_REQUESTED: 'requested',
    STATUS_PENDING: 'pending',
    STATUS_APPROVED: 'approved',
    STATUS_GRANTED: 'granted',
    STATUS_DENIED: 'denied',
    MESSAGE_REQUESTED: 'Access requested',
    MESSAGE_GRANTED: 'Access granted',
    MESSAGE_APPROVED: 'Request approved',
    MESSAGE_PENDING: 'Sent message requesting more information',
    MESSAGE_DENIED: 'Request denied',
}

models.api_accessrequest.prototype.pend = async function (message) {
    this.set('status', models.api_accessrequest.constants.STATUS_PENDING)
    this.set(
        'message',
        message || models.api_accessrequest.constants.MESSAGE_PENDING
    )
    await this.save()
}

models.api_accessrequest.prototype.approve = async function (message) {
    this.set('status', models.api_accessrequest.constants.STATUS_APPROVED)
    this.set(
        'message',
        message || models.api_accessrequest.constants.MESSAGE_APPROVED
    )
    await this.save()
}

models.api_accessrequest.prototype.grant = async function () {
    this.set('status', models.api_accessrequest.constants.STATUS_GRANTED)
    this.set('message', models.api_accessrequest.constants.MESSAGE_GRANTED)
    await this.save()
}

models.api_accessrequest.prototype.deny = async function (message) {
    this.set('status', models.api_accessrequest.constants.STATUS_DENIED)
    this.set(
        'message',
        message || models.api_accessrequest.constants.MESSAGE_DENIED
    )
    await this.save()
}

models.api_accessrequest.prototype.isApproved = function () {
    return this.status == models.api_accessrequest.constants.STATUS_APPROVED
}

models.api_accessrequest.prototype.isGranted = function () {
    return this.status == models.api_accessrequest.constants.STATUS_GRANTED
}

// Workshop enrollment request
models.api_workshopenrollmentrequest.constants = {
    STATUS_REQUESTED: 'requested',
    STATUS_PENDING: 'pending',
    STATUS_APPROVED: 'approved',
    STATUS_GRANTED: 'granted',
    STATUS_DENIED: 'denied',
    MESSAGE_REQUESTED: 'Enrollment requested',
    MESSAGE_PENDING: 'Sent enrollment request to instructor',
    MESSAGE_APPROVED: 'Request approved',
    MESSAGE_GRANTED: 'Enrollment granted',
    MESSAGE_DENIED: 'Request denied',
}

models.api_workshopenrollmentrequest.prototype.pend = async function (message) {
    this.set(
        'status',
        models.api_workshopenrollmentrequest.constants.STATUS_PENDING
    )
    this.set(
        'message',
        message || odels.api_workshopenrollmentrequest.constants.MESSAGE_PENDING
    )
    await this.save()
}

models.api_workshopenrollmentrequest.prototype.approve = async function (
    message
) {
    this.set(
        'status',
        models.api_workshopenrollmentrequest.constants.STATUS_APPROVED
    )
    this.set(
        'message',
        message ||
            models.api_workshopenrollmentrequest.constants.MESSAGE_APPROVED
    )
    await this.save()
}

models.api_workshopenrollmentrequest.prototype.grant = async function () {
    this.set(
        'status',
        models.api_workshopenrollmentrequest.constants.STATUS_GRANTED
    )
    this.set(
        'message',
        models.api_workshopenrollmentrequest.constants.MESSAGE_GRANTED
    )
    await this.save()
}

models.api_workshopenrollmentrequest.prototype.deny = async function (message) {
    this.set(
        'status',
        models.api_workshopenrollmentrequest.constants.STATUS_DENIED
    )
    this.set(
        'message',
        message || models.api_workshopenrollmentrequest.constants.MESSAGE_DENIED
    )
    await this.save()
}

models.api_workshopenrollmentrequest.prototype.isApproved = function () {
    return (
        this.status ==
        models.api_workshopenrollmentrequest.constants.STATUS_APPROVED
    )
}

models.api_workshopenrollmentrequest.prototype.isGranted = function () {
    return (
        this.status ==
        models.api_workshopenrollmentrequest.constants.STATUS_GRANTED
    )
}

models.sequelize = sequelize
module.exports = models
