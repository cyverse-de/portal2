import { useState } from 'react'
import { useRouter } from 'next/router'
import { isEmpty, isEmail } from 'validator'
import { Link, Box, Grid, Typography, TextField, Button, LinearProgress, makeStyles} from '@material-ui/core'
import { MainLogo, Wizard, WelcomeAnimation, honeypotId } from '../components'
import { useAPI } from '../contexts/api'
import { sortCountries } from '../lib/misc'
const properties = require('../user-properties.json')

const useStyles = makeStyles((theme) => ({
  //MOBILE STYLES
  boxWelcome: {
    paddingTop:'30%',
    [theme.breakpoints.down('md')]:
    {paddingTop:'10%',},
    [theme.breakpoints.down('xs')]: {
      paddingTop:'5%',
    },
  },
  logo: {
    paddingTop: "10%",
    marginTop:'0',
    [theme.breakpoints.down('md')]:
    {paddingTop: "10%",
    marginTop:'0',},
  },
  tagline: {
    [theme.breakpoints.down('md')]:
    {fontSize:"1.5rem",
      marginTop:"3%"},
    [theme.breakpoints.down('sm')]:
    {fontSize:"1.7rem",
      marginTop:"5%"},
      [theme.breakpoints.down('xs')]:
    {fontSize:"1.3rem",
      marginTop:"5%"},
  },
  blueSection: {
    height: "100vh",
    width: "50vw",
    [theme.breakpoints.down('md')]: {
      height: '30vh',
    },
    // [theme.breakpoints.down('sm')]: {
    //   height: '30vh',
    // },
    // [theme.breakpoints.down('xs')]: {
    //   height: '30vh',
    // },
    [theme.breakpoints.up('md')]: {
      height: '100vh',
    },
  },
  //DESKTOP STYLES
  grid: {
    height: "100vh",
    width: "50vw",
  },
  button: {
    width: "17vw",
    whiteSpace: 'nowrap',
    minWidth: '10em'
  },
  title: {
    color: '#0971ab',
    fontWeight: "bold"
  },
}))

const Welcome = (props) => {
  const classes = useStyles()

  return (
    <div>
      <div id="home-announcement">Due to electrical maintenance @ Cyverse from Tuesday, October 22nd at 4 PM MST through Thursday, October 24th at 4 PM MST DNA Subway will be completely offline. The maintenance may extend through October 25th, although that is not expected.</div>
      <Grid container>
        <Grid className={classes.blueSection} item xs={12} sm={12} md={6} lg={6} xl={6} align="center" style={{backgroundColor: '#0971AB'}}>
          <Left {...props} />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={6} xl={6} align="center" className={classes.grid} style={{backgroundColor: '#ffffff'}}>
          <Right {...props} />
        </Grid>
      </Grid>
    </div>
  )
}

const Left = () => {
  const classes = useStyles()
return (
    <div>
        <Box className={classes.logo}>
            <MainLogo size="large" />
        </Box>
        <Box>
            <WelcomeAnimation />
        </Box>
        <Box>
            <Typography
                className={classes.tagline}
                variant="h5"
                style={{ color: 'white' }}
            >
                The Open Science Workspace for
                <br />
                Collaborative Data-driven Discovery
            </Typography>
        </Box>
    </div>
)
}

const Right = (props) => {
  const classes = useStyles()
  const router = useRouter()
  const query = router && router.query ? router.query : {}

  const [signup, setSignup] = useState(!!query.signup)
  const [forgotPassword, setForgotPassword] = useState(!!query.forgot)

  if (forgotPassword)
    return <ForgotPassword {...props} cancelHandler={() => setForgotPassword(false)} />

  if (signup)
    return <SignUp {...props} />

  return ( //FIXME use column grid here instead
    <div>
      <Box className={classes.boxWelcome}>
        <Typography variant="h4" className={classes.title}>
          Welcome to CyVerse!
        </Typography>
      </Box>
      <Box pt={"5em"}>
        <Typography gutterBottom>
          New to CyVerse?
        </Typography>
      </Box>
      <Box>
        <Button variant="contained" color="primary" size="large" disableElevation className={classes.button} onClick={() => setSignup(true)}>
          Sign Up
        </Button>
      </Box>
      <Box mt={5}>
        <Button variant="outlined" color="primary" size="large" disableElevation className={classes.button} href="/login">
          Login
        </Button>
      </Box>
      <Box mt={7} mb={5}>
        <Button variant="text" size="small" onClick={() => setForgotPassword(true)}>Forgot Password</Button>
      </Box>
    </div>
  )
}

const ForgotPassword = ({ startTimeHMAC, cancelHandler }) => {
  const classes = useStyles()
  const api = useAPI()

  const [email, setEmail] = useState()
  const [debounce, setDebounce] = useState(null)
  const [validationError, setValidationError] = useState()
  const [isSubmitting, setSubmitting] = useState(false)
  const [isSubmitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState()

  const handleChangeEmail = async (e) => {
    const value = e.target.value
    setEmail(value)

    if (debounce) clearTimeout(debounce)
    if (value && value.length >= 3) {
      setDebounce(
        setTimeout(async () => {
          setValidationError(await validateEmail(value))
        }, 500)
      )
    }
  }

  const validateEmail = async (value) => {
    if (isEmpty(value))
      return 'This field is required'
    if (!isEmail(value))
      return 'Please enter a valid email address'

    const res = await api.checkEmail(value)
    if (res && !res.email)
      return 'Email address not associated with an account'

    return null
  }

  const submitPasswordReset = async (email) => {
    try {
      const resp = await api.resetPassword({ email, hmac: startTimeHMAC })
      setSubmitting(false)
      setSubmitted(true)
      if (resp !== 'success') 
        setSubmitError(resp)
    }
    catch(error) {
      setSubmitError(error.response ? error.response.data : error.message)
    }
  }

  const backButton = <Link onClick={cancelHandler}>Back to Sign-in / Sign-Up</Link>

  if (isSubmitted && !submitError) {
    return (
      <Box pt={"35vh"} style={{width:'30vw'}}>
        <Typography variant="h5" color="primary">
          We sent an email containing a link to reset your password to
        </Typography>
        <br />
        <Typography variant="h5">
          {email}
        </Typography>
        <br />
        <Typography variant="h5" color="primary">
          Please check your email now.
        </Typography>
        <br />
        <br />
        {backButton}
      </Box>
    )
  }

  return ( //FIXME use column grid here instead
    <Box width="60%" className={classes.boxWelcome}>
      <Typography variant="h4" className={classes.title}>
        Reset Password
      </Typography>
      <Box mt={5}>
        <Typography variant="button" gutterBottom>
          Enter your email address and we will send you a link to reset your password.
        </Typography>
        </Box>
      <Box mt={4}>
        <TextField 
          id="email" 
          type="email" 
          label="Email" 
          required
          variant="outlined" 
          fullWidth
          error={!!validationError}
          helperText={validationError}
          onChange={handleChangeEmail}
        />
        {isSubmitting && <LinearProgress />}
      </Box>
      <Box mt={1} display="flex" justifyContent="flex-end">
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          disabled={isSubmitting || !!validationError || !email}
          onClick={() => {
            console.log('Submit')
            setSubmitting(true)
            setSubmitted(false)
            setSubmitError(false)
            submitPasswordReset(email)
          }}
        >
          Submit
        </Button>
      </Box>
      <br />
      <Typography variant="button" color="error">
        {submitError}
      </Typography>
      <br />
      <br />
      {backButton}
    </Box>
  )
}

const SignUp = ({ startTimeHMAC, firstNameId, lastNameId }) => {
  const classes = useStyles()
  const api = useAPI()
  const [error, setError] = useState()

  const [institutions, setInstitutions] = useState([])
  const [institutionId, setInstitutionId] = useState()
  const [institutionError, setInstitutionError] = useState()
  const [countryId, setCountryId] = useState()
  const [isSubmitted, setSubmitted] = useState(false)
  const [user, setUser] = useState() // newly created user
  const debounce = React.useRef()

  const inputHandler = (fieldId, value) => {
    if (fieldId == 'grid_institution_id') {
      const MAX_RESULTS = 100
      if (debounce.current) clearTimeout(debounce.current)
      if (value.length >= 3) {
        debounce.current =
          setTimeout(async () => {
            const institutions = await api.institutions({ keyword: value, limit: MAX_RESULTS })
            if (institutions.length == 0)
              setInstitutionError('Not found, please try a different search term or enter "other"')
            else {
              if (institutions.length == MAX_RESULTS)
                institutions.unshift({ disabled: true, id: 0, name: `Only first ${MAX_RESULTS} matching results shown, please narrow your search` })
              setInstitutions(institutions)
              setInstitutionError()
            }
          }, 300)
      }
      else {
        setInstitutionId()
        setInstitutions([])
      }
    }
  }

  // Show error when user clicks away from institution input with no result selected
  // UP-87: https://cyverse.atlassian.net/browse/UP-87?atlOrigin=eyJpIjoiNDU3YmYzNmM4MmQwNDQ5MTgwMzUwZGIxZDVlOTVmODAiLCJwIjoiaiJ9
  const focusHandler = (e) => {
    console.log(institutionId)
    if (e.target.id != 'grid_institution_id' && typeof institutionId === 'undefined')
      setInstitutionError('This field is required, please select a result from the dropdown list')
  }

  const [form, setForm] = useState(getForm({ firstNameId, lastNameId, inputHandler, focusHandler }))

  const handleSelect = (field, option) => {
    if (field.id == 'country_id') 
      setCountryId(option.id) // set region based on country
    else if (field.id == 'grid_institution_id')
      setInstitutionId(option.id)
  }

  const submitCreateUser = async (submission) => {
    // Make sure not submitted twice (should never happen)
    if (isSubmitted) {
      console.log('submitCreateUser: Blocking second submit')
      return
    }

    try {
      const newUser = await api.createUser(submission)
      if (!newUser || typeof newUser != 'object')
        setError('An error occurred')
      else {
        setUser(newUser)
        setSubmitted(true)
      }
    }
    catch(error) {
      console.log(error)
      setError(error.response ? error.response.data : error.message)
    }
  }
  
  React.useEffect(() => {
    setForm(getForm({ firstNameId, lastNameId, countryId, institutionId, institutionError, institutions, inputHandler, focusHandler }))
  }, [countryId, institutionId, institutions, institutionError])

  // Custom validator for username & email fields
  const validate = async (field, value) => {
    if (field.type == 'username') {
      const res = await api.checkUsername(value)
      //TODO add error checking here
      if (res && res.username)
        return 'Username already taken'
    }
    else if (field.type == 'email') {
      const res = await api.checkEmail(value)
      //TODO add error checking here
      if (res && res.email)
        return 'Email already assigned to an account'
    }

    return null
  }

  const allFields = form.sections.reduce((acc, s) => acc.concat(s.fields), [])
  const initialValues = 
    allFields.reduce((acc, f) => { acc[f.id.toString()] = ''; return acc }, {})

  return (
    <Box width="60%" className={classes.boxWelcome}>
        {isSubmitted 
        ? <Box p={7}>
            <Typography variant='h5' color='textSecondary'>
              A confirmation email was sent to
            </Typography>
            <br /><br />
            <Typography variant='h5' color='primary'>		  
              <b>{user ? user.email : '<error>'}</b>
            </Typography>
            <br /><br />
            <Typography variant='h5' color='textSecondary'>
              Please click on the confirmation link in the email to activate your account.
            </Typography>
          </Box>
        : <Box>
            <Typography variant="h4" className={classes.title}>Create your account</Typography>
            <br />
            <Wizard
              form={form}
              initialValues={initialValues}
              validate={validate}
              onSelect={handleSelect}
              onSubmit={(values, { setSubmitting }) => {
                values['plt'] = startTimeHMAC // encrypted page load time
                console.log('Submit', values)
                submitCreateUser(values)
                setSubmitting(false)
              }}
            />
            <br />
            {error && <Typography variant="button" color="error">{error}</Typography>}
            <br />
            <Link href="/login">Already have an account?</Link>
          </Box>
        }
    </Box>
  )
}

const getForm = ({ firstNameId, lastNameId, countryId, institutionId, institutions, institutionError, inputHandler, focusHandler }) => {
  return {
    sections: [
      { autosave: true,
        fields: [
          { id: firstNameId, 
            honeypot: true, // tells Wizard to generate a duplicate honey pot field
            name: "First Name",
            type: "text",
            required: true,
            autoFocus: true
          },
          { id: lastNameId,
            honeypot: true, // tells Wizard to generate a duplicate honey pot field
            name: "Last Name",
            type: "text",
            required: true,
          },
          { id: "username",
            name: "Username",
            type: "username",
            required: true
          },
          { id: "email",
            name: "Email",
            type: "email",
            required: true
          }
        ]
      },
      { autosave: true,
        fields: [
          { id: "grid_institution_id",
            name: "Company/Institution",
            type: "autocomplete",
            required: true,
            value: institutionId,
            options: institutions,
            placeholder: `Enter a search term and select from results or enter "other"`,
            errorText: institutionError,
            freeSolo: true,
            onInputChange: inputHandler,
            autoFocus: true
          },
          { id: "department",
            name: "Department",
            type: "text",
            required: true,
            onFocus: focusHandler
          },
          { id: "occupation_id",
            name: "Occupation",
            type: "select",
            required: true,
            options: properties.occupations,
            onFocus: focusHandler
          },
          { id: "research_area_id",
            name: "Research Area",
            type: "select",
            required: true,
            options: properties.research_areas,
            onFocus: focusHandler
          },
          { id: "funding_agency_id",
            name: "Funding Agency",
            type: "select",
            required: true,
            options: properties.funding_agencies,
            onFocus: focusHandler
          }
        ]
      },
      { autosave: true,
        fields: [
          { id: "country_id",
            name: "Country",
            type: "autocomplete",
            required: true,
            autoFocus: true,
            options: properties.countries.sort(sortCountries),
          },
          { id: "region_id",
            name: "Region",
            type: "select",
            required: true,
            options: countryId
              ? properties.regions.filter(r => r.country_id == countryId) // populate based on selected country
              : [ { id: 4585, name: "Please select a country first ...", disabled: true } ] 
          },
          { id: "gender_id",
            name: "Gender Identity",
            type: "select",
            required: true,
            options: properties.genders
          },
          { id: "ethnicity_id",
            name: "Ethnicity",
            type: "select",
            required: true,
            options: properties.ethnicities
          },
          { id: "aware_channel_id",
            name: "How did you hear about us?",
            type: "select",
            required: true,
            options: properties.aware_channels
          }
        ]
      }
    ]
  }
}

export async function getServerSideProps() {
  const { generateHMAC } = require('../api/lib/hmac')
  
  const startTimeHMAC = generateHMAC(Date.now()) // for securing create user and password reset
  const firstNameId = honeypotId(1)
  const lastNameId = honeypotId(2)

  return { 
    props: { 
      startTimeHMAC,
      firstNameId,
      lastNameId
    } 
  }
}

export default Welcome
