import { Box, Paper, Typography, Link } from '@material-ui/core'
import { Warning as WarningIcon } from '@material-ui/icons'

const DataLimitAnnouncement = () => {
  return (
    <Paper elevation={3} style={{ marginTop: '24px', maxWidth: '1000px', margin: '24px auto' }}>
      <Box bgcolor="primary.main" px={3} py={2} display="flex" alignItems="center">
        <WarningIcon style={{ color: '#FFD700', marginRight: '16px' }} />
        <Typography variant="h6" component="h2" style={{ color: 'white' }}>
          Data Storage Limits
        </Typography>
      </Box>
      <Box p={3}>
        <Typography variant="body1">
          Starting <strong>March 1, 2025</strong>, we will begin to enforce data storage quotas on all Basic (free) and paid subscription accounts.{' '}
          <Link
            href="https://cyverse.org/quota-enforce"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            style={{ textDecoration: 'underline' }}
          >
            More information and FAQ here
          </Link>
        </Typography>
      </Box>
    </Paper>
  )
}

export default DataLimitAnnouncement