import {
    Dashboard as DashboardIcon,
    List as ListIcon,
    Event as EventIcon,
    Help as HelpIcon,
    Lock as LockIcon,
    Group as GroupIcon,
    Block as BlockIcon,
    PersonAdd as PersonAddIcon,
    Edit as EditIcon,
    Inbox as InboxIcon,
} from '@material-ui/icons'

import SvgLearnIcon from './svg/learnIcon'
import SvgCalIcon from './svg/calendarIcon'
import SvgPoliciesIcon from './svg/policiesIcon'
import SvgWikiIcon from './svg/wikiIcon'
import SvgVideoIcon from './svg/videoIcon'
import SvgForumIcon from './svg/forumIcon'
import SvgStatusIcon from './svg/statusIcon'
import SvgRocketIcon from './svg/rocketIcon'

const menuItems = [
    {
        label: 'Services',
        icon: <DashboardIcon fontSize="large" />,
        path: '/services',
        items: [],
    },
    {
        label: 'Requests',
        icon: <ListIcon fontSize="large" />,
        path: '/requests',
        items: [],
    },
    {
        label: 'Workshops',
        icon: <EventIcon fontSize="large" />,
        path: '/workshops',
        items: [],
    },
    {
        label: 'Help',
        icon: <HelpIcon fontSize="large" />,
        path: '/help',
        items: [
            {
                label: 'Getting Started',
                path: 'https://www.youtube.com/channel/UC-gvdjTz9rq6RovZ57LoDDA',
                description:
                    'Get help on creating an account and learn about our services.',
                icon: <SvgRocketIcon />,
                category: 'learn',
            },
            {
                label: 'CyVerse Learning',
                path: 'https://learning.cyverse.org',
                description:
                    'Explore our learning materials in the popular “Read the Docs” formatting.',
                icon: <SvgLearnIcon />,
                category: 'learn',
            },
            {
                label: 'Webinars',
                path: 'https://www.youtube.com/@CyverseOrgProject',
                description:
                    'Browse webinars on how to use CyVerse services.',
                category: 'learn',
                icon: <SvgVideoIcon />,
            },
            {
                label: 'Policies',
                path: 'https://cyverse.org/policies',
                description: 'View CyVerse policies that apply to all users.',
                category: 'support',
                icon: <SvgPoliciesIcon />,
            },
            {
                label: 'CyVerse Wiki',
                path: 'https://cyverse.atlassian.net/wiki',
                description: 'A space for collaboration.',
                category: 'learn',
                icon: <SvgWikiIcon />,
            },
            {
                label: 'FAQ',
                path: "https://learning.cyverse.org/faq/",
                description: 'Answers to frequently asked questions about CyVerse.',
                category: 'support',
                icon: <SvgForumIcon />,
            },
            {
                label: 'Maintenance Calendar',
                path: 'https://cyverse.org/maintenance',
                description: 'Check for scheduled downtime for maintenance.',
                category: 'support',
                icon: <SvgCalIcon />,
            },
            {
                label: 'Status',
                path: 'http://status.cyverse.org/',
                description: 'View operational status of all CyVerse resources.',
                category: 'support',
                icon: <SvgStatusIcon />,
            },
        ],
    },
    {
        label: 'Administrative',
        icon: <LockIcon fontSize="large" />,
        path: '/administrative',
        restricted: true,
        items: [
            {
                label: 'Users',
                icon: <GroupIcon />,
                path: '/administrative/users',
                description:
                    'Search across all CyVerse users and view details about individual users.',
            },
            {
                label: 'Restricted Usernames',
                icon: <BlockIcon />,
                path: '/administrative/usernames',
                description: 'Show and edit restricted usernames.',
            },
            {
                label: 'Access Requests',
                icon: <PersonAddIcon />,
                path: '/administrative/requests',
                description:
                    'Search across all access requests and view/deny/approve individual requests.',
            },
            {
                label: 'Services',
                icon: <DashboardIcon />,
                path: '/administrative/services',
                description: 'View and modify services.',
            },
            {
                label: 'Workshops',
                icon: <EventIcon />,
                path: '/administrative/workshops',
                description: 'View, create, and modify workshops.',
            },
            {
                label: 'Form Submissions',
                icon: <InboxIcon />,
                path: '/administrative/submissions',
                description:
                    'Search across all form submissions and view individual submissions.',
            },
            {
                label: 'Forms',
                icon: <EditIcon />,
                path: '/administrative/forms',
                description: 'View and edit forms.',
            },
        ],
    },
]

const getMenuItem = label => {
    return menuItems.find(item => item.label === label)
}

export { menuItems, getMenuItem }
