const router = require('express').Router()
const { getUser, requireAdmin, asyncHandler } = require('./lib/auth')
const { logger } = require('./lib/logging')
const sequelize = require('sequelize')
const models = require('./models')
const User = models.account_user
const Workshop = models.api_workshop
const WorkshopEnrollmentRequest = models.api_workshopenrollmentrequest
const WorkshopEnrollmentRequestLog = models.api_workshopenrollmentrequestlog
const WorkshopOrganizer = models.api_workshoporganizer
const WorkshopContact = models.api_workshopcontact
const WorkshopService = models.api_workshopservice
const WorkshopParticipant = models.api_userworkshop
const WorkshopEmail = models.api_workshopuseremail
const Service = models.api_service
const AccessRequest = models.api_accessrequest
const { approveRequest, grantRequest } = require('./approvers/workshop')
const serviceApprovers = require('./approvers/service')
const { notifyClientOfWorkshopRequestStatusChange } = require('./lib/ws')
const config = require('../lib/config')

function hasHostAccess(workshop, user) {
    return workshop.creator_id == user.id || user.is_staff
}

function hasOrganizerAccess(workshop, user) {
    return (
        hasHostAccess(workshop, user) ||
        WorkshopOrganizer.findOne({
            where: { workshop_id: workshop.id, organizer_id: user.id },
        })
    )
}

// Get all workshops
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const workshops = await Workshop.findAll({
            include: [
                //TODO create scope for this
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: ['id'],
                },
            ],
            order: [['enrollment_begins', 'DESC']],
        })

        return res.status(200).json(workshops)
    })
)

// Get workshop by ID
router.get(
    '/:id(\\d+)',
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.id, {
            include: [
                //TODO create scope for this
                'contacts',
                {
                    model: User.unscoped(),
                    as: 'owner',
                    attributes: [
                        'id',
                        'username',
                        'first_name',
                        'last_name',
                        'email',
                    ],
                },
                {
                    model: models.api_service,
                    as: 'services',
                    through: { attributes: [] }, // remove connector table
                },
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: [
                        'id',
                        'username',
                        'first_name',
                        'last_name',
                        'email',
                    ],
                },
            ],
            order: [['services', 'name', 'ASC']],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        return res.status(200).json(workshop)
    })
)

// Download workshop ICS file
router.get(
    '/:id(\\d+)/download',
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.id)
        if (!workshop) return res.status(404).send('Workshop not found')

        try {
            const MAX_EVENTS = 1000 * 60 * 60 * 24 * 5 // 5 days
            const updateDate = new Date(workshop.updated_at)
            const startDate = new Date(workshop.start_date)
            const endDate = new Date(workshop.end_date)

            const dates = []
            if (endDate.getTime() - startDate.getTime() <= MAX_EVENTS) {
                // Generate an event for each day
                for (
                    let d = new Date(startDate);
                    d <= endDate;
                    d.setDate(d.getDate() + 1)
                ) {
                    const endOfDay = new Date(d)
                    endOfDay.setHours(endDate.getHours())
                    endOfDay.setMinutes(endDate.getMinutes())
                    dates.push({ start: new Date(d), end: endOfDay })
                }
            } else {
                // Generate one multi-day event
                dates.push({ start: startDate, end: endDate })
            }

            if (!dates) return res.status(500).send('Invalid date range')

            // Send ICS file
            res.setHeader(
                'Content-disposition',
                'attachment;filename=' + workshop.title + '.ics'
            )
            res.setHeader('Content-type', 'application/octet-stream')
            res.write(`BEGIN:VCALENDAR
CALSCALE:GREGORIAN
PRODID:-//CyVerse//User Portal//EN
VERSION:2.0
`)

            for (let i = 0; i < dates.length; i++) {
                res.write(`BEGIN:VEVENT
DTSTAMP:${convertToICSDate(updateDate)}
DTSTART:${convertToICSDate(dates[i].start)}
DTEND:${convertToICSDate(dates[i].end)}
SUMMARY:${workshop.title}
UID:${'workshop' + workshop.id + '-' + i + '@user.cyverse.org'}
URL:${config.UI_BASE_URL}/workshops/${workshop.id}
END:VEVENT
`)
            }

            res.write('END:VCALENDAR')
            res.end()
        } catch (error) {
            console.log(error)
            res.end()
        }
    })
)

function convertToICSDate(date) {
    const year = date.getFullYear().toString()
    const month =
        date.getMonth() + 1 < 10
            ? '0' + (date.getMonth() + 1).toString()
            : (date.getMonth() + 1).toString()
    const day =
        date.getDate() < 10
            ? '0' + date.getDate().toString()
            : date.getDate().toString()
    const hours =
        date.getHours() < 10
            ? '0' + date.getHours().toString()
            : date.getHours().toString()
    const minutes =
        date.getMinutes() < 10
            ? '0' + date.getMinutes().toString()
            : date.getMinutes().toString()
    return year + month + day + 'T' + hours + minutes + '00'
}

// Create workshop (STAFF ONLY)
router.put(
    '/',
    getUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
        if (!req.body.title) return res.status(400).send('Missing title')

        // Set default workshop properties
        const tomorrowMorning = new Date()
        tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
        tomorrowMorning.setHours(9)
        tomorrowMorning.setMinutes(0)
        tomorrowMorning.setMilliseconds(0)

        const defaults = {
            creator_id: req.user.id,
            about: '',
            description: '',
            enrollment_begins: tomorrowMorning,
            enrollment_ends: tomorrowMorning,
            contact_email: '',
            contact_name: '',
            end_date: tomorrowMorning,
            start_date: tomorrowMorning,
        }
        const fields = { ...defaults, ...req.body } // override default values with request values, if any

        // Create workshop
        const workshop = await Workshop.create(fields)
        if (!workshop) return res.status(500).send('Failed to create workshop')

        res.status(201).json(workshop)
    })
)

// Update workshop
router.post(
    '/:id(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const id = req.params.id
        const fields = req.body

        const workshop = await Workshop.findByPk(id, {
            include: [
                //TODO create scope for this
                {
                    model: User.unscoped(),
                    as: 'owner',
                    attributes: [
                        'id',
                        'username',
                        'first_name',
                        'last_name',
                        'email',
                    ],
                },
                {
                    model: models.api_service,
                    as: 'services',
                    through: { attributes: [] }, // remove connector table
                },
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: [
                        'id',
                        'username',
                        'first_name',
                        'last_name',
                        'email',
                    ],
                },
                'contacts',
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        // Verify and update fields
        for (let key in fields) {
            const SUPPORTED_FIELDS = [
                'title',
                'description',
                'about',
                'enrollment_begins',
                'enrollment_ends',
                'start_date',
                'end_date',
                'creator_id',
                'is_public',
            ]
            const RESTRICTED_FIELDS = [
                'enrollment_begins',
                'enrollment_ends',
                'start_date',
                'end_date',
                'creator_id',
            ]
            if (RESTRICTED_FIELDS.includes(key) && !req.user.is_staff)
                return res.status(403).send('Restricted field')
            if (!SUPPORTED_FIELDS.includes(key))
                return res.status(400).send('Unsupported field')
            workshop[key] = fields[key]
        }
        await workshop.save()
        await workshop.reload()

        res.status(200).json(workshop)
    })
)

// Get workshop participants (enrollees)
router.get(
    '/:id(\\d+)/participants',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.id, {
            include: [
                {
                    model: User.unscoped(), //TODO create scope for this
                    as: 'users',
                    attributes: [
                        'id',
                        'username',
                        'first_name',
                        'last_name',
                        'email',
                    ],
                    through: { attributes: [] }, // remove connector table
                },
            ],
            order: [
                [sequelize.fn('lower', sequelize.col('first_name')), 'ASC'],
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        return res.status(200).json(workshop.users)
    })
)

// Add participant to workshop (enroll user)
router.put(
    '/:id(\\d+)/participants',
    getUser,
    asyncHandler(async (req, res) => {
        const userId = req.body.userId
        if (!userId) return res.status(400).send('Missing user id')

        // Fetch user
        const user = await User.findByPk(userId)
        if (!user) return res.status(404).send('User not found')

        // Fetch workshop
        const workshop = await Workshop.findByPk(req.params.id, {
            include: ['services'],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        // Add to participants //FIXME also done in grantRequest() below
        const [participant] = await WorkshopParticipant.findOrCreate({
            where: {
                workshop_id: workshop.id,
                user_id: user.id,
            },
        })

        res.status(201).json(participant)

        // Call granter (do this after response as to not delay it)
        const [request] = await WorkshopEnrollmentRequest.findOrCreate({
            where: {
                workshop_id: workshop.id,
                user_id: user.id,
            },
            defaults: {
                status: WorkshopEnrollmentRequest.constants.STATUS_REQUESTED,
                message: WorkshopEnrollmentRequest.constants.MESSAGE_REQUESTED,
                auto_approve: true,
            },
        })
        request.user = user
        request.workshop = workshop
        await grantRequest(request)

        notifyClientOfWorkshopRequestStatusChange(req.ws, request)
    })
)

// Remove participant from workshop
router.delete(
    '/:workshopId(\\d+)/participants/:userId(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.workshopId)
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const participant = await WorkshopParticipant.findOne({
            where: {
                workshop_id: workshop.id,
                user_id: req.params.userId,
            },
        })
        if (!participant) return res.status(404).send('Participant not found')

        await participant.destroy()
        res.status(200).send('success')
    })
)

// Get workshop emails (pre-approved for enrollment)
router.get(
    '/:id(\\d+)/emails',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.id, {
            include: [
                {
                    model: WorkshopEmail, //TODO create scope for this
                    as: 'emails',
                    attributes: ['id', 'email'],
                },
            ],
            order: [[sequelize.fn('lower', sequelize.col('email')), 'ASC']],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        return res.status(200).json(workshop.emails)
    })
)

// Add email to workshop (pre-approve for enrollment)
router.put(
    '/:id(\\d+)/emails',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.id)
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const [email, created] = await WorkshopEmail.findOrCreate({
            where: {
                workshop_id: workshop.id,
                email: req.body.email,
            },
        })
        res.status(201).json(email)
    })
)

// Remove email from workshop
router.delete(
    '/:workshopId(\\d+)/emails/:email(\\S+)',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.workshopId)
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const email = await WorkshopEmail.findOne({
            where: {
                workshop_id: workshop.id,
                email: req.params.email,
            },
        })
        if (!email) return res.status(404).send('Email not found')

        await email.destroy()
        res.status(200).send('success')
    })
)

// Add organizer to workshop
router.put(
    '/:id(\\d+)/organizers',
    getUser,
    asyncHandler(async (req, res) => {
        const userId = req.body.userId
        if (!userId) return res.status(400).send('Missing user id')

        const workshop = await Workshop.findByPk(req.params.id)
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host and staff
        if (!hasHostAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const [organizer, created] = await WorkshopOrganizer.findOrCreate({
            where: {
                workshop_id: workshop.id,
                organizer_id: userId,
            },
        })
        res.status(201).json(organizer)
    })
)

// Remove organizer from workshop
router.delete(
    '/:workshopId(\\d+)/organizers/:userId(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.workshopId)
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host and staff
        if (!hasHostAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const organizer = await WorkshopOrganizer.findOne({
            where: {
                workshop_id: workshop.id,
                organizer_id: req.params.userId,
            },
        })
        if (!organizer) return res.status(404).send('Organizer not found')

        await organizer.destroy()
        res.status(200).send('success')
    })
)

// Add contact to workshop
router.put(
    '/:id(\\d+)/contacts',
    getUser,
    asyncHandler(async (req, res) => {
        const name = req.body.name
        const email = req.body.email
        if (!name || !email)
            return res.status(400).send('Missing required param')

        const workshop = await Workshop.findByPk(req.params.id, {
            include: [
                //TODO create scope for this
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: ['id'],
                },
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const [contact, created] = await WorkshopContact.findOrCreate({
            where: {
                workshop_id: workshop.id,
                name,
                email,
            },
        })
        res.status(201).json(contact)
    })
)

// Remove contact from workshop
router.delete(
    '/:workshopId(\\d+)/contacts/:email(\\S+)',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.workshopId, {
            include: [
                //TODO create scope for this
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: ['id'],
                },
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer and staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const contact = await WorkshopContact.findOne({
            where: {
                workshop_id: workshop.id,
                email: req.params.email,
            },
        })
        if (!contact) return res.status(404).send('Contact not found')

        await contact.destroy()
        res.status(200).send('success')
    })
)

// Add service to workshop
router.put(
    '/:id(\\d+)/services',
    getUser,
    asyncHandler(async (req, res) => {
        const serviceId = req.body.serviceId
        if (!serviceId) return res.status(400).send('Missing service id')

        const workshop = await Workshop.findByPk(req.params.id, {
            include: [
                //TODO create scope for this
                'users',
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: ['id'],
                },
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        const service = await Service.findByPk(serviceId)
        if (!service) return res.status(404).send('Service not found')

        // Check permission -- only workshop host/organizer or staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const [workshopService, created] = await WorkshopService.findOrCreate({
            where: {
                workshop_id: workshop.id,
                service_id: serviceId,
            },
        })

        res.status(201).json(workshopService)

        // Call service granter for each participant (do this after response as to not delay it)
        logger.info(
            `Granting new service access for ${workshop.users.length} participants for workshop ${workshop.id}`
        )
        for (const user of workshop.users) {
            logger.info(
                `grant: Grant access to service ${service.name} for user ${user.id}`
            )
            let serviceRequest = await AccessRequest.findOne({
                where: {
                    service_id: service.id,
                    user_id: user.id,
                },
            })
            if (!serviceRequest) {
                serviceRequest = await AccessRequest.create({
                    service_id: service.id,
                    user_id: user.id,
                    auto_approve: true,
                    status: AccessRequest.constants.STATUS_REQUESTED,
                    message: AccessRequest.constants.MESSAGE_REQUESTED,
                })
            }

            if (!serviceRequest.isGranted()) {
                serviceRequest.service = service
                serviceRequest.user = user
                serviceApprovers.grantRequest(serviceRequest)
            }
        }
    })
)

// Remove service from workshop
router.delete(
    '/:workshopId(\\d+)/services/:serviceId(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const workshop = await Workshop.findByPk(req.params.workshopId, {
            include: [
                //TODO create scope for this
                {
                    model: User.unscoped(),
                    as: 'organizers',
                    through: { attributes: [] }, // remove connector table
                    attributes: ['id'],
                },
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host and staff
        if (!hasHostAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const service = await WorkshopService.findOne({
            where: {
                workshop_id: workshop.id,
                service_id: req.params.serviceId,
            },
        })
        if (!service) return res.status(404).send('Service not found')

        await service.destroy()
        res.status(200).send('success')
    })
)

// Get workshop enrollment requests
router.get(
    '/:id(\\d+)/requests',
    getUser,
    asyncHandler(async (req, res) => {
        const workshopId = req.params.id

        // Fetch workshop
        const workshop = await Workshop.findByPk(workshopId)
        if (!workshop) return res.status(404).send('Workshop not found')

        // Check permission -- only workshop host/organizer or staff
        if (!hasOrganizerAccess(workshop, req.user))
            return res.status(403).send('Permission denied')

        const requests = await WorkshopEnrollmentRequest.findAll({
            where: {
                workshop_id: workshopId,
            },
            include: [
                'logs',
                {
                    model: User.unscoped(), //TODO create scope for this
                    as: 'user',
                    attributes: [
                        'id',
                        'username',
                        'first_name',
                        'last_name',
                        'email',
                        'institution',
                        'department',
                    ],
                    include: [
                        'funding_agency',
                        'occupation',
                        'research_area',
                        {
                            model: models.account_region,
                            as: 'region',
                            include: ['country'],
                        },
                    ],
                },
            ],
            order: [['logs', 'created_at', 'ASC']],
        })
        return res.status(200).json(requests)
    })
)

// Create new enrollment request
router.put(
    '/:id(\\d+)/requests',
    getUser,
    asyncHandler(async (req, res) => {
        const workshopId = req.params.id

        // Fetch workshop
        const workshop = await Workshop.findByPk(workshopId, {
            include: [
                //TODO move into scope
                'emails',
                'services',
                'owner',
            ],
        })
        if (!workshop) return res.status(404).send('Workshop not found')

        // Create enrolllment request if it doesn't already exist
        const [request, created] = await WorkshopEnrollmentRequest.findOrCreate(
            {
                where: {
                    workshop_id: workshop.id,
                    user_id: req.user.id,
                },
                defaults: {
                    status: WorkshopEnrollmentRequest.constants
                        .STATUS_REQUESTED,
                    message:
                        WorkshopEnrollmentRequest.constants.MESSAGE_REQUESTED,
                    auto_approve: false,
                },
            }
        )
        if (!request) return res.status(500).send('Failed to create request')

        // Create initial enrollment request log entry to record that user requested to enroll.
        // Subsequent entries will be automatically created each time the request is updated (see "afterUpdateRequest" hook in src/api/models/index.js).
        const log = await WorkshopEnrollmentRequestLog.create({
            workshop_enrollment_request_id: request.id,
            status: request.status,
            message: request.message,
        })
        if (!log)
            return res
                .status(500)
                .send('Failed to create enrollment request log')

        // Send response to client
        res.status(201).json(request)

        // Call approver and granter (do this after response as to not delay it)
        request.user = req.user
        request.workshop = workshop
        if (created)
            // new request
            await approveRequest(request)
        if (request.isApproved()) await grantRequest(request)

        notifyClientOfWorkshopRequestStatusChange(req.ws, request)
    })
)

// Update enrollment request status
router.post(
    '/requests/:id(\\d+)',
    getUser,
    asyncHandler(async (req, res) => {
        const requestId = req.params.id
        const status = req.body.status
        const message = req.body.message

        if (!status || !message)
            //TODO verify valid status value
            return res.status(400).send('Missing required field')

        // Fetch request
        const request = await WorkshopEnrollmentRequest.findByPk(requestId, {
            include: [
                'user',
                {
                    model: models.api_workshop,
                    as: 'workshop',
                    include: ['services'],
                },
            ],
        })
        if (!request) return res.status(404).send('Request not found')

        // Check permission -- only workshop host/organizer or staff
        if (!hasOrganizerAccess(request.workshop, req.user))
            return res.status(403).send('Permission denied')

        // Update request
        request.set('status', status)
        request.set('message', message)
        await request.save()

        // Send response to client
        res.status(200).json(request)

        // Call granter (do this after response as to not delay it)
        if (request.isApproved()) await grantRequest(request)

        notifyClientOfWorkshopRequestStatusChange(req.ws, request)
    })
)

module.exports = router
