import { Paper, Grid, Box, Button, Typography } from '@material-ui/core'
import BannerImage from './svg/bannerImage'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) => ({
    button: {
        margin: theme.spacing(1),
    },
    bannerImage: {
        //margin: '1px',
        [theme.breakpoints.down('sm')]: {
            display: 'none',
        },
    },
    padding: {
        padding: '4%',
        [theme.breakpoints.down('md')]: {
            padding: '3%',
        },
        [theme.breakpoints.down('sm')]: {
            padding: '2%',
        },
    },
    paper: {
        padding: theme.spacing(3),
        textAlign: 'center',
        color: theme.palette.text.secondary,
    }
}))

const WelcomeBanner = ({ closeHandler }) => {
    const classes = useStyles()

    return (
        <Box mt={3}>
            <Paper elevation={3} className={classes.paper}>
                <Grid
                    container
                    direction="row"
                    justify="center"
                    alignItems="center"
                    spacing={4}
                >
                    <Grid item sm={12} md={5} lg={5} className={classes.bannerImage}>
                        <BannerImage />
                    </Grid>
                    <Grid item xs={12} sm={12} md={7} lg={6} className={classes.padding}>
                        <Typography
                            component="h1"
                            variant="h4"
                            color="primary"
                        >
                            Welcome to the
                            <br />
                            CyVerse User Portal
                        </Typography>
                        <br />
                        <Typography
                            variant="body1"
                            color="textPrimary"
                            component="p"
                        >
                            The User Portal is the place to customize your
                            CyVerse experience. Request access to
                            services and explore learning materials and
                            workshops.
                        </Typography>
                        <br />
                        <Button
                            className={classes.button}
                            variant="contained"
                            color="primary"
                            size="large"
                            href="https://learning.cyverse.org"
                            target="_blank"
                        >
                            Learning Center
                        </Button>
                        <Button
                            className={classes.button}
                            size="large"
                            variant="contained"
                            color="primary"
                            href="https://www.youtube.com/watch?v=-1lQuIMLXvs&list=PL38WPXpo-ZW2Qay_04FuP8IeVbbUopoiw&index=3"
                            target="_blank"
                        >
                            Getting Started Webinar
                        </Button>
                        <br />
                        <br />
                        <Button size="small" onClick={closeHandler}>Close and don't show again</Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    )
}

export default WelcomeBanner
