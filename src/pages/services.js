import {
    HelpOutlineOutlined as HelpIcon,
    Launch as LaunchIcon,
} from '@mui/icons-material'
import {
    Box,
    Button,
    Divider,
    Grid,
    IconButton,
    Link,
    Typography,
} from '@mui/material'
import { parseCookie } from 'cookie'
import { useState } from 'react'
import { Layout, SummaryCard, WelcomeBanner } from '../components'
import DataLimitAnnouncement from '../components/DataLimitAnnouncement'
import { WELCOME_BANNER_COOKIE } from '../constants/client'
import { useUser } from '../contexts/user'
const inlineIcons = require('../inline_icons.json')

const Services = props => {
    const [user] = useUser()
    const services = props.services || []

    // Handle case where user is not authenticated (user will be null for unauthenticated users)
    const userServices = (user?.services || []).filter(
        s => s.api_accessrequest.status != 'denied'
    )
    const available = services.filter(
        s =>
            s.is_public &&
            s.approval_key != '' &&
            !userServices.map(s => s.id).includes(s.id)
    )
    const powered = services.filter(s => s.is_powered)

    const [welcomeBannerOpen, setWelcomeBannerOpen] = useState(
        !(WELCOME_BANNER_COOKIE in props.cookies)
    )

    const poweredByButton = (
        <IconButton
            aria-label="delete"
            onClick={e => {
                window.open('https://cyverse.org/powered-by-cyverse')
                e.preventDefault()
            }}
        >
            <HelpIcon fontSize="small" />
        </IconButton>
    )

    const handleCloseWelcomeBanner = () => {
        document.cookie = 'welcome_banner=' // create cookie
        setWelcomeBannerOpen(false)
    }

    return (
        <Layout title="Services">
            <DataLimitAnnouncement />
            {welcomeBannerOpen && (
                <WelcomeBanner closeHandler={handleCloseWelcomeBanner} />
            )}
            <Box mt={3}>
                <Typography variant="h6" component="h2">
                    My Services
                </Typography>
                <Divider />
                <br />
                <MyServices services={userServices} />
                <br />
            </Box>
            <Box mt={3}>
                <Typography variant="h6" component="h2">
                    Available
                </Typography>
                <Divider />
                <br />
                <AvailableServices services={available} />
                <br />
            </Box>
            <Box mt={3}>
                <Typography variant="h6" component="h2">
                    Powered by CyVerse{poweredByButton}
                </Typography>
                <Divider />
                <br />
                <PoweredServices services={powered} />
                <br />
            </Box>
        </Layout>
    )
}

const MyServices = ({ services }) => {
    if (services && services.length > 0)
        return <ServiceGrid services={services} launch={true} />

    return (
        <Typography variant="body1">
            Looks like you don't have access to any services. If you request
            access to one, you'll find it here.
        </Typography>
    )
}

const AvailableServices = ({ services }) => {
    if (services && services.length > 0)
        return <ServiceGrid services={services} launch={false} />

    return (
        <Typography variant="body1">
            There are no additional services available.
        </Typography>
    )
}

const PoweredServices = ({ services }) => {
    if (services && services.length > 0)
        return <ServiceGrid services={services} launch={true} />

    return (
        <Typography variant="body1">
            There are no additional services available.
        </Typography>
    )
}

const ServiceGrid = ({ services, launch }) => (
    <Grid container spacing={4}>
        {services.map((service, index) => (
            <Grid item key={index} xs={12} sm={12} md={6} lg={4} xl={3}>
                <Service {...service} launch={launch} />
            </Grid>
        ))}
    </Grid>
)

const Service = ({ id, name, description, icon_url, service_url, launch }) => {
    const action = launch ? (
        <Button
            size="small"
            color="primary"
            onClick={e => {
                window.open(`${service_url}`)
                e.preventDefault()
            }}
        >
            LAUNCH
            <LaunchIcon style={{ fontSize: '1em', marginLeft: '0.5em' }} />
        </Button>
    ) : (
        <Button size="small" color="primary" href={`services/${id}`}>
            REQUEST ACCESS
        </Button>
    )

    // Icons were moved inline for performance
    if (icon_url in inlineIcons) icon_url = inlineIcons[icon_url] // replace with inline image data

    return (
        <Link
            underline="none"
            href={`services/${id}`}
            sx={{ textDecoration: 'none' }}
        >
            <SummaryCard
                title={name}
                description={description}
                iconUrl={icon_url}
                action={action}
            />
        </Link>
    )
}

/**
 * Parses the request cookies into a plain object. The `cookie` package returns
 * an object with a null-prototype parent, which fails the Next.js check for
 * serializable props.
 */
const requestCookies = req => ({ ...parseCookie(req.headers.cookie || '') })

export async function getServerSideProps({ req }) {
    const cookies = requestCookies(req)

    try {
        // Check if API is available
        if (!req.api) {
            console.error('API middleware not available on request object')
            return {
                props: {
                    services: [],
                    cookies,
                },
            }
        }

        const services = await req.api.services()

        // Handle case where API returns undefined or null
        if (services === undefined || services === null) {
            console.warn('Services API returned undefined/null')
            return {
                props: {
                    services: [],
                    cookies,
                },
            }
        }

        // Handle case where API returns array directly (expected case)
        if (Array.isArray(services)) {
            return { props: { services, cookies } }
        }

        // Handle case where API returns an object with services property (fallback)
        if (
            services &&
            typeof services === 'object' &&
            services.services &&
            Array.isArray(services.services)
        ) {
            console.warn(
                'API returned services wrapped in object, using services.services'
            )
            return { props: { services: services.services, cookies } }
        }

        // Fallback for any other case
        console.warn(
            'Unexpected services API response format:',
            typeof services,
            services
        )
        return {
            props: {
                services: [],
                cookies,
            },
        }
    } catch (error) {
        console.error('Failed to fetch services:', error)
        return {
            props: {
                services: [],
                cookies,
            },
        }
    }
}

export default Services
