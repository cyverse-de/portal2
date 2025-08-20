const router = require('express').Router()
const models = require('./models')
const sequelize = require('sequelize')
const Service = models.api_service
const ServiceContact = models.api_contact
const ServiceResource = models.api_serviceresource
const ServiceForm = models.api_serviceform
const User = models.account_user
const AccessRequest = models.api_accessrequest
const AccessRequestLog = models.api_accessrequestlog
const AccessRequestQuestion = models.api_accessrequestquestion
const AccessRequestAnswer = models.api_accessrequestanswer
const { approveRequest, grantRequest } = require('./approvers/service')
const intercom = require('./lib/intercom')
const { notifyClientOfServiceRequestStatusChange } = require('./lib/ws')
const { getUser, requireAdmin, asyncHandler } = require('./lib/auth')

const poweredServiceQuery = [
    sequelize.literal(
        '(select exists(select 1 from api_poweredservice where service_ptr_id=id))'
    ),
    'is_powered',
]

//TODO move into module
const like = (key, val) =>
    sequelize.where(sequelize.fn('lower', sequelize.col(key)), {
        [sequelize.Op.like]: '%' + val.toLowerCase() + '%',
    })

// Get all service access requests (STAFF ONLY)
router.get(
    '/requests',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const offset = req.query.offset
        const limit = req.query.limit || 10
        const keyword = req.query.keyword

        const where = keyword
            ? {
                  where: sequelize.or(
                      { id: isNaN(keyword) ? 0 : keyword },
                      like('status', keyword),
                      like('service.name', keyword),
                      like('user.username', keyword),
                      like('user.email', keyword),
                      like('user.region.country.name', keyword)
                  ),
                  subQuery: false,
              }
            : {}

        const { count, rows } = await AccessRequest.findAndCountAll({
            ...where,
            include: [{ model: User.scope('profile'), as: 'user' }, 'service'],
            order: [['updated_at', 'DESC']],
            offset: offset,
            limit: limit,
            distinct: true,
        })

        return res.status(200).json({ count, results: rows })
    })
)

// Get individual service access request (STAFF ONLY)
router.get(
    '/requests/:id(\\d+)',
    requireAdmin,
    asyncHandler(async (req, res) => {
        const request = await AccessRequest.findByPk(req.params.id, {
            include: [
                'user',
                {
                    model: Service,
                    as: 'service',
                    include: {
                        model: AccessRequestQuestion,
                        as: 'questions',
                    },
                },
                'conversations',
                'logs',
            ],
            order: [['logs', 'created_at', 'DESC']],
        })
        if (!request) return res.status(404).send('Request not found')

        let answers = await AccessRequestAnswer.findAll({
            where: {
                access_request_question_id: request.service.questions.map(
                    q => q.id
                ),
                user_id: request.user.id,
            },
        })
        request.setDataValue('answers', answers)

        // Fetch conversations from Intercom
        if (intercom) {
            const users = {}
            for (const conversation of request.conversations) {
                const c = await intercom.getConversation(
                    conversation.intercom_conversation_id
                )
                if (c) {
                    conversation.setDataValue('source', c.source)
                    if (c.conversation_parts) {
                        for (const part of c.conversation_parts
                            .conversation_parts) {
                            // is there a better way to do this?
                            // Get author name
                            const user =
                                part.author.id in users
                                    ? users[part.author.id]
                                    : await intercom.getUser(
                                          part.author.id,
                                          part.author.type
                                      )
                            if (user) part.author.name = user.body.name
                            users[part.author.id] = user

                            // Get assignee name
                            if (part.assigned_to) {
                                const user =
                                    part.assigned_to.id in users
                                        ? users[part.assigned_to.id]
                                        : await intercom.getUser(
                                              part.assigned_to.id,
                                              part.assigned_to.type
                                          )
                                if (user) part.assigned_to.name = user.body.name
                                users[part.assigned_to.id] = user
                            }
                        }
                        conversation.setDataValue(
                            'parts',
                            c.conversation_parts.conversation_parts
                        )
                    }
                }
            }
        }

        return res.status(200).json(request)
    })
)

// Create new access request
router.put(
    '/:id(\\d+)/requests',
    getUser,
    asyncHandler(async (req, res) => {
        const serviceId = req.params.id
        const answers = req.body.answers // [ { questionId, value } ]

        // Fetch service
        const service = await Service.findByPk(serviceId, {
            include: ['questions'],
        })
        if (!service) return res.status(404).send('Service not found')

        // Verify there is an answer for every question
        // for (question of service.questions) {
        //     const answer = answers ? answers.filter(a => a.questionId == question.id) : null;
        //     if (!answer || typeof answer.value == 'undefined')
        //         return res.status(400).send('Missing answer to question ' + question.id);
        // }

        // Create access request if it doesn't already exist
        const [request, created] = await AccessRequest.findOrCreate({
            where: {
                service_id: service.id,
                user_id: req.user.id,
            },
            defaults: {
                status: AccessRequest.constants.STATUS_REQUESTED,
                message: AccessRequest.constants.MESSAGE_REQUESTED,
            },
        })
        if (!request) return res.status(500).send('Failed to create request')

        request.service = service
        request.user = req.user
        request.user.token = req.api.token

        // Create answers
        request.answers = []
        if (service.questions && answers) {
            for (const question of service.questions) {
                for (const answer of answers) {
                    if (answer.questionId == question.id) {
                        const [ans, created] =
                            await AccessRequestAnswer.findOrCreate({
                                where: {
                                    user_id: req.user.id,
                                    access_request_question_id: question.id,
                                },
                                defaults: {
                                    value_text: answer.value,
                                },
                            })
                        request.answers.push(ans) // Save answers for use in approveRequest call below -- a little kludgey
                    }
                }
            }
        }

        // Create initial access request log entry to record that user requested access.
        // Subsequent entries will be automatically created each time the request is updated (see "afterUpdateRequest" hook in src/api/models/index.js).
        const log = await AccessRequestLog.create({
            access_request_id: request.id,
            status: request.status,
            message: request.message,
        })
        if (!log)
            return res.status(500).send('Failed to create access request log')

        // Send response to client
        res.status(201).json(request)

        // Call approver and granter (do this after response as to not delay it)
        if (created)
            // new request
            await approveRequest(request)
        if (request.isApproved()) await grantRequest(request)

        notifyClientOfServiceRequestStatusChange(req.ws, request)
    })
)

/*
 * Update request status (STAFF ONLY)
 *
 * Called in admin "Access Requests" page to grant/deny request.
 *
 * For Argo workflow completion callback see src/api/public.js:/services/requests/:id
 *
 */
router.post(
    '/requests/:id(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const id = req.params.id
        const status = req.body.status
        const message = req.body.message

        if (!status || (status != 'approved' && status != 'denied'))
            return res.status(400).send('Invalid status')

        if (!message) return res.status(400).send('Missing message')

        // Get request
        const request = await AccessRequest.findByPk(id, {
            include: ['service', 'user'],
        })
        if (!request) return res.status(404).send('Request not found')

        // Update request
        request.set('status', status)
        request.set('message', message)
        await request.save()

        // Send response to client
        res.status(200).json(request)

        // Call granter (do this after response as to not delay it)
        if (request.isApproved()) await grantRequest(request)

        // Update status on client
        notifyClientOfServiceRequestStatusChange(req.ws, request)
    })
)

// Grant access to service (STAFF ONLY)
router.put(
    '/:serviceId(\\d+)/users/:userId(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { serviceId, userId } = req.params

        // Fetch user
        const user = await User.findByPk(userId)
        if (!user) return res.status(404).send('User not found')

        // Fetch workshop
        const service = await Service.findByPk(serviceId)
        if (!service) return res.status(404).send('Service not found')

        // Create access request if it doesn't already exist
        const [request, created] = await AccessRequest.findOrCreate({
            where: {
                service_id: service.id,
                user_id: userId,
            },
            defaults: {
                status: AccessRequest.constants.STATUS_REQUESTED,
                message: AccessRequest.constants.MESSAGE_REQUESTED,
            },
        })
        if (!request) return res.status(500).send('Failed to create request')

        res.status(201).json(request)

        // Call granter (do this after response as to not delay it)
        request.user = user
        request.service = service
        await grantRequest(request)

        // Update status on client
        notifyClientOfServiceRequestStatusChange(req.ws, request)
    })
)

// Fetch all services
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const services = await Service.findAll({
            attributes: { include: [poweredServiceQuery] },
            order: [[sequelize.fn('lower', sequelize.col('name')), 'ASC']],
        })

        return res.status(200).json(services)
    })
)

// Fetch service by name or ID
router.get(
    '/:nameOrId(\\w+)',
    asyncHandler(async (req, res) => {
        const nameOrId = req.params.nameOrId

        const service = await Service.findOne({
            include: [
                //TODO create scope for this
                'service_maintainer',
                'contacts',
                'resources',
                'questions',
                {
                    model: models.api_form,
                    as: 'forms',
                    through: { attributes: [] }, // remove connector table
                },
            ],
            attributes: { include: [poweredServiceQuery] },
            where: sequelize.or(
                { id: isNaN(nameOrId) ? 0 : nameOrId },
                sequelize.where(
                    sequelize.fn('lower', sequelize.col('name')),
                    nameOrId.toLowerCase()
                )
            ),
            order: [['questions', 'id', 'ASC']],
        })

        if (!service) return res.status(404).send('Service not found')

        return res.status(200).json(service)
    })
)

// Update service (STAFF ONLY)
router.post(
    '/:id(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const id = req.params.id
        const fields = req.body

        const service = await Service.findByPk(id, {
            include: [
                //TODO create scope for this
                'service_maintainer',
                'contacts',
                'resources',
                'questions',
                {
                    model: models.api_form,
                    as: 'forms',
                    through: { attributes: [] }, // remove connector table
                },
            ],
        })
        if (!service) return res.status(404).send('Service not found')

        // Verify and update fields
        for (let key in fields) {
            const SUPPORTED_FIELDS = [
                'name',
                'description',
                'about',
                'service_url',
                'icon_url',
                'is_public',
            ]
            if (!SUPPORTED_FIELDS.includes(key))
                return res.status(400).send('Unsupported field')
            service[key] = fields[key]
        }
        await service.save()
        await service.reload()

        res.status(200).json(service)
    })
)

// Add question to service (STAFF ONLY)
router.put(
    '/:id(\\d+)/questions',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const questionText = req.body.question
        const is_required = true //req.body.is_required;
        if (!questionText)
            return res.status(400).send('Missing required fields')

        const service = await Service.findByPk(req.params.id)
        if (!service) return res.status(404).send('Service not found')

        const [question, created] = await AccessRequestQuestion.findOrCreate({
            where: {
                service_id: service.id,
                question: questionText,
                type: 'text',
                is_required,
            },
        })
        res.status(201).json(question)
    })
)

// Remove question from service (STAFF ONLY)
router.delete(
    '/:serviceId(\\d+)/questions/:questionId(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const service = await Service.findByPk(req.params.serviceId)
        if (!service) return res.status(404).send('Service not found')

        const question = await AccessRequestQuestion.findByPk(
            req.params.questionId
        )
        if (!question) return res.status(404).send('Question not found')

        await question.destroy()
        res.status(200).send('success')
    })
)

// Add contact to service (STAFF ONLY)
router.put(
    '/:id(\\d+)/contacts',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const name = req.body.name
        const email = req.body.email
        if (!name || !email) return res.status(400).send('Missing params')

        const service = await Service.findByPk(req.params.id)
        if (!service) return res.status(404).send('Service not found')

        const [contact, created] = await ServiceContact.findOrCreate({
            where: {
                service_id: service.id,
                name,
                email,
            },
        })
        res.status(201).json(contact)
    })
)

// Remove contact from service (STAFF ONLY)
router.delete(
    '/:serviceId(\\d+)/contacts/:contactId(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const service = await Service.findByPk(req.params.serviceId)
        if (!service) return res.status(404).send('Service not found')

        const contact = await ServiceContact.findByPk(req.params.contactId)
        if (!contact) return res.status(404).send('Contact not found')

        await contact.destroy()
        res.status(200).send('success')
    })
)

// Add resource to service (STAFF ONLY)
router.put(
    '/:id(\\d+)/resources',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const fields = req.body
        if (!fields.name || !fields.url)
            return res.status(400).send('Missing required fields')

        const service = await Service.findByPk(req.params.id)
        if (!service) return res.status(404).send('Service not found')

        const [resource, created] = await ServiceResource.findOrCreate({
            where: {
                service_id: service.id,
                name: fields.name,
                url: fields.url,
                description: fields.description || '',
                icon_url: fields.icon_url || '',
            },
        })
        res.status(201).json(resource)
    })
)

// Remove resource from service (STAFF ONLY)
router.delete(
    '/:serviceId(\\d+)/resources/:resourceId(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const service = await Service.findByPk(req.params.serviceId)
        if (!service) return res.status(404).send('Service not found')

        const resource = await ServiceResource.findByPk(req.params.resourceId)
        if (!resource) return res.status(404).send('Resource not found')

        await resource.destroy()
        res.status(200).send('success')
    })
)

// Add form to service (STAFF ONLY)
router.put(
    '/:id(\\d+)/forms',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const fields = req.body
        if (!fields.formId)
            return res.status(400).send('Missing required fields')

        const service = await Service.findByPk(req.params.id)
        if (!service) return res.status(404).send('Service not found')

        const [form, created] = await ServiceForm.findOrCreate({
            where: {
                service_id: service.id,
                form_id: fields.formId,
            },
        })
        res.status(201).json(form)
    })
)

// Remove form from service (STAFF ONLY)
router.delete(
    '/:serviceId(\\d+)/forms/:formId(\\d+)',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const service = await Service.findByPk(req.params.serviceId)
        if (!service) return res.status(404).send('Service not found')

        const serviceForm = await ServiceForm.findOne({
            where: {
                service_id: service.id,
                form_id: req.params.formId,
            },
        })
        if (!serviceForm) return res.status(404).send('Form not found')

        await serviceForm.destroy()
        res.status(200).send('success')
    })
)

module.exports = router
