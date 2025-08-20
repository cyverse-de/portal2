const router = require('express').Router()
const { requireAdmin, getUser, asyncHandler } = require('./lib/auth')
const sequelize = require('sequelize')
const models = require('./models')
const User = models.account_user
const FormGroup = models.api_formgroup
const Form = models.api_form
const FormSection = models.api_formsection
const FormField = models.api_formfield
const FormSubmission = models.api_formsubmission
const FormFieldSubmission = models.api_formfieldsubmission
const FormSubmissionConversation = models.api_formsubmissionconversation
const { UI_ADMIN_FORM_SUBMISSION_URL } = require('../constants')
const { emailGenericMessage } = require('./lib/email')
const intercom = require('./lib/intercom')

//TODO move into module
const like = (key, val) =>
    sequelize.where(sequelize.fn('lower', sequelize.col(key)), {
        [sequelize.Op.like]: '%' + val.toLowerCase() + '%',
    })

// Get all forms
router.get(
    '/',
    asyncHandler(async (req, res) => {
        let formGroups = await FormGroup.findAll({
            include: [
                {
                    model: models.api_form,
                    as: 'forms',
                    through: { attributes: [] }, // remove connector table
                },
            ],
            order: [['index', 'ASC']],
        })

        return res.status(200).json(formGroups)
    })
)

// Create form (STAFF ONLY)
router.put(
    '/',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        if (!req.body || !req.body.name)
            return res.status(400).send('Missing name')

        // Set default form properties
        const defaults = {
            //creator_id: req.user.id, //TODO add field
            description: '',
            explanation: '',
        }
        const fields = { ...defaults, ...req.body } // override default values with request values, if any

        // Create form
        const form = await Form.create(fields)
        if (!form) return res.status(500).send('Failed to create form')

        res.status(201).json(form)
    })
)

// Search form submissions (STAFF ONLY)
router.get(
    '/submissions',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const offset = req.query.offset
        const limit = req.query.limit || 10
        const keyword = req.query.keyword

        const where = keyword
            ? {
                  where: sequelize.or(
                      { id: isNaN(keyword) ? 0 : keyword },
                      like('form.name', keyword),
                      like('user.username', keyword),
                      like('user.email', keyword),
                      like('user.region.country.name', keyword)
                  ),
                  subQuery: false,
              }
            : {}

        const { count, rows } = await models.api_formsubmission.findAndCountAll(
            {
                ...where,
                include: [{ model: User.scope('profile'), as: 'user' }, 'form'],
                order: [['updated_at', 'DESC']],
                offset: offset,
                limit: limit,
                distinct: true,
            }
        )

        return res.status(200).json({ count, results: rows })
    })
)

// Get single form submission (STAFF ONLY)
router.get(
    '/submissions/:id(\\d+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const submission = await models.api_formsubmission.findByPk(
            req.params.id,
            {
                include: [
                    'user',
                    {
                        model: Form,
                        as: 'form',
                        include: ['sections'],
                    },
                    {
                        model: FormField,
                        as: 'fields',
                        include: ['options'],
                    },
                    'conversations',
                ],
            }
        )
        if (!submission) return res.status(404).send('Submission not found')

        // Set field 'value' property based on type for convenience
        for (const field of submission.fields) {
            field.setDataValue(
                'value',
                getFormFieldValue(field, field.api_formfieldsubmission)
            )
        }

        // Fetch conversations from Intercom
        if (intercom) {
            for (let conversation of submission.conversations) {
                const c = await intercom.getConversation(
                    conversation.intercom_conversation_id
                )
                if (c) {
                    conversation.setDataValue('source', c.source)
                    if (c.conversation_parts)
                        conversation.setDataValue(
                            'parts',
                            c.conversation_parts.conversation_parts
                        )
                }
            }
        }

        return res.status(200).json(submission)
    })
)

function getFormFieldValue(field, submission) {
    switch (field.type) {
        case 'char':
            return submission.value_string
        case 'select':
            if (submission.value_select_id)
                return field.options.find(
                    o => o.id == submission.value_select_id
                ).name
            else return submission.value_select_id
        default:
            return submission['value_' + field.type]
    }
}

function getFormFieldValueKey(type) {
    switch (type) {
        case 'char':
            return 'value_string'
        case 'select':
            return 'value_select_id'
        default:
            return 'value_' + type
    }
}

// Create new form submission
router.put(
    '/:id(\\d+)/submissions',
    getUser,
    asyncHandler(async (req, res) => {
        const formId = req.params.id
        const fields = req.body
        if (!fields || fields.length == 0)
            return res.status(400).send('Missing fields')

        // Fetch form
        const form = await Form.findByPk(formId)
        if (!form) return res.status(404).send('Form not found')

        // Create form submission
        let submission = await FormSubmission.create({
            form_id: formId,
            user_id: req.user.id,
        })
        if (!submission)
            return res.status(500).send('Failed to create form submission')

        // Save field values
        for (const field of fields) {
            const fieldSubmission = await FormFieldSubmission.create({
                form_submission_id: submission.id,
                form_field_id: field.id,
                [getFormFieldValueKey(field.type)]: field.value,
            })
            if (!fieldSubmission)
                return res
                    .status(500)
                    .send('Failed to create form field submission')
        }

        // Refetch submission with additional info
        submission = await FormSubmission.findByPk(submission.id, {
            include: [
                'user',
                {
                    model: FormField,
                    as: 'fields',
                    include: ['options'],
                },
                {
                    model: Form,
                    as: 'form',
                    include: ['sections'],
                },
            ],
        })

        // Send response to client
        res.status(201).json(submission)

        // Send confirmation message via Intercom (do this after response as to not delay it)
        sendFormSubmissionConfirmationMessage(submission)
    })
)

function getFormSubmissionConversationBody(submission) {
    const form = submission.form
    const fields = submission.fields
    if (!form || !fields) throw 'Missing required property'

    let body = `${form.name} form submitted.`

    body += ' Here are the details:'

    for (let section of form.sections) {
        body += `\n\n${section.name}`

        for (let field of fields.filter(f => f.form_section_id == section.id)) {
            body += `\n\n<strong>${field.name}</strong>:`
            body +=
                '\n\n' + getFormFieldValue(field, field.api_formfieldsubmission)
        }
    }

    return body
}

async function sendFormSubmissionConfirmationMessage(submission) {
    const user = submission.user
    const form = submission.form
    if (!user || !form) throw 'Missing required property'

    const body = getFormSubmissionConversationBody(submission)
    const linkText = `This form submission can be viewed at ${UI_ADMIN_FORM_SUBMISSION_URL}/${submission.id}`

    if (intercom) {
        const [conversation, message] = await intercom.startConversation(
            user,
            body
        )

        await FormSubmissionConversation.create({
            form_submission_id: submission.id,
            intercom_message_id: message.id,
            intercom_conversation_id: conversation.id,
        })

        await intercom.addNoteToConversation(conversation.id, linkText)

        await intercom.replyToConversation(
            conversation.id,
            `Hi ${user.first_name}! Thanks for submitting the request. One of the staff will review it and get back to you. In the meantime, feel free to respond to this message if you'd like to chat more about your request.`
        )

        if (form.intercom_team_id)
            await intercom.assignConversation(
                conversation.id,
                form.intercom_team_id
            )
    }

    if (process.env.BCC_INTERCOM) {
        const message = body + '\n\n' + linkText
        emailGenericMessage({
            to: process.env.BCC_INTERCOM,
            subject: 'User Portal Form Submission',
            message,
        })
    }
}

// Fetch form by ID or name
router.get(
    '/:nameOrId([\\w\\%]+)',
    asyncHandler(async (req, res) => {
        const nameOrId = decodeURI(req.params.nameOrId)

        let form = await Form.findOne({
            where: sequelize.or(
                { id: isNaN(nameOrId) ? 0 : nameOrId },
                sequelize.where(
                    sequelize.fn('lower', sequelize.col('name')),
                    nameOrId.toLowerCase()
                )
            ),
            include: [
                // move to default scope
                {
                    model: FormSection,
                    as: 'sections',
                    include: [
                        {
                            model: FormField,
                            as: 'fields',
                            include: ['options'],
                        },
                    ],
                },
            ],
            order: [
                [{ model: FormSection, as: 'sections' }, 'index', 'asc'],
                [
                    { model: FormSection, as: 'sections' },
                    { model: FormField, as: 'fields' },
                    'index',
                    'asc',
                ],
            ],
        })
        if (!form) return res.status(404).send('Form not found')

        return res.status(200).json(form)
    })
)

// Update form
router.post(
    '/:id(\\d+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const formId = req.params.id
        const newForm = req.body

        // Fetch form
        const form = await Form.findByPk(formId, {
            // include: [ // move to default scope
            //     {
            //         model: FormSection,
            //         as: 'sections',
            //         include: [
            //             {
            //                 model: FormField,
            //                 as: 'fields',
            //                 include: [ 'options' ],
            //                 order: [ ['index', 'ASC'] ]
            //             }
            //         ],
            //         order: [ ['index', 'ASC'] ]
            //     }
            // ]
        })
        if (!form) return res.status(404).send('Form not found')

        // Update form fields
        if (newForm.name != null) form.name = newForm.name
        if (newForm.description != null) form.description = newForm.description
        await form.save()

        // Update/create sections/fields
        // for (let newSection of newForm.sections) {
        //     const section = await FormSection.upsert({
        //         form_id: formId,
        //         name: newSection.name,
        //         description: newSection.description,
        //         index: newSection.index
        //     }, { returning: true });
        //     if (!section)
        //         return res.status(500).send('Failed to upsert form section');

        //     for (let newField of newSection.fields) {
        //         const field = await FormField.upsert({
        //             form_section_id: section.id,
        //             name: newField.name,
        //             description: newField.description,
        //             type: newField.type,
        //             index: newField.index,
        //             is_required: newField.is_required,
        //             conversion_key: newField.conversion_key
        //         }, { returning: true });
        //         if (!field)
        //             return res.status(500).send('Failed to upsert form field');
        //     }
        // }

        await form.reload()
        return res.status(200).json(form)
    })
)

// Create form section
router.put(
    '/sections',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const newSection = req.body
        if (!newSection || !newSection.name)
            return res.status(400).send('Missing fields')

        const section = await FormSection.create(newSection)
        if (!section) return res.status(500).send('Failed to create section')

        return res.status(201).json(section)
    })
)

// Update form section
router.post(
    '/sections/:id(\\d+)/',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const sectionId = req.params.id
        const newSection = req.body

        const section = await FormSection.update(newSection, {
            where: { id: sectionId },
            fields: ['name', 'description', 'index'],
            returning: true,
        })
        if (!section) return res.status(500).send('Failed to update section')

        return res.status(200).json(section)
    })
)

// Delete form section
router.delete(
    '/sections/:id(\\d+)/',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const section = await FormSection.findByPk(req.params.id)
        if (!section) return res.status(404).send('Section not found')

        await section.destroy()

        return res.status(200).send(req.params.id)
    })
)

// Create form field
router.put(
    '/fields',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const newField = req.body

        if (!newField || !newField.name || !newField.type)
            return res.status(400).send('Missing fields')

        const field = await FormField.create(newField)
        if (!field) return res.status(500).send('Failed to create field')

        return res.status(201).json(field)
    })
)

// Update form field
router.post(
    '/fields/:id(\\d+)/',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const fieldId = req.params.id
        const newField = req.body

        const field = await FormField.update(newField, {
            where: { id: fieldId },
            fields: [
                'name',
                'type',
                'description',
                'index',
                'conversion_key',
                'is_required',
            ],
            returning: true,
        })
        if (!field) return res.status(500).send('Failed to update field')

        return res.status(200).json(field)
    })
)

// Delete form field
router.delete(
    '/fields/:id(\\d+)/',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const field = await FormField.findByPk(req.params.id)
        if (!field) return res.status(404).send('Field not found')

        await field.destroy()

        return res.status(200).send(req.params.id)
    })
)

module.exports = router
