import { useState } from 'react'
import { useRouter } from 'next/router'
import { makeStyles } from '@material-ui/core/styles'
import { Container, AppBar, Toolbar, Box, Paper, Typography, Link, Button, IconButton, TextField, Avatar, List, ListItem, ListItemText, ListItemAvatar, ListItemSecondaryAction, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@material-ui/core'
import { Person as PersonIcon, Mail as MailIcon, Delete as DeleteIcon } from '@material-ui/icons'
import { Layout, UpdateForm, MailingListForm, MainLogo } from '../components'
import { isEmail, isEmpty } from 'validator'
import { useUser } from '../contexts/user'
import { useAPI } from '../contexts/api'
import { useError } from '../contexts/error'
import { sortCountries } from '../lib/misc'
const properties = require('../user-properties.json')

const countries = properties.countries.sort(sortCountries)
const regions = {}
for (const r of properties.regions) {
  if (!(r.country_id in regions))
    regions[r.country_id] = []
  regions[r.country_id].push(r)
}

//FIXME duplicated elsewhere
const useStyles = makeStyles((theme) => ({
  paper: {
    padding: '3em'
  },
  appBarIcon: {
    color: "white",
  },
  appBar: {
    backgroundColor:'#084060', //FIXME use theme
    display: 'flex'
  },
}))

const Account = () => {
  const classes = useStyles()
  const router = useRouter()
  const api = useAPI()
  const [_, setError] = useError()
  const [user, setUser] = useUser()
  const [sentEmails, setSentEmails] = useState([])
  const [institutions, setInstitutions] = useState()
  const [institutionKeyword, setInstitutionKeyword] = useState(user && user.institution)
  const [institutionError, setInstitutionError] = useState()
  const [forms, setForms] = useState()
  const [inputDebounce, setInputDebounce] = useState(null)
  const [updateDebounce, setUpdateDebounce] = useState(null)

  const reviewMode = router && router.query && router.query.reviewMode
  const redirectUrl = router && router.query && router.query.redirectUrl

  const changeHandler = async (data) => {
    try {
      if (data && 'old_password' in data && 'new_password' in data) {
        const res = await api.updatePassword({ 
          oldPassword: data['old_password'], 
          password: data['new_password'] 
        })
        if (res !== 'success')
          setError(res)
        return
      }

      // Reload user
      const newUser = await api.user()
      if (data && data.email) {
        sentEmails.push(data.email)
        setSentEmails(sentEmails)
        for (const email of newUser.emails) // set sent flag for "resend confirmation email" on newly added email addresses
          email.sent = email.email == data.email.email
      }
      setUser(newUser)
    }
    catch (error) {
      setError(error.response && error.response.data ? error.response.data : error.message)
    }
  }

  const inputHandler = (fieldId, value) => {
    if (fieldId == 'grid_institution_id') {
      setInstitutionKeyword(value)
      if (inputDebounce) clearTimeout(inputDebounce)
      if (value.length >= 3) {
        setInputDebounce(
          setTimeout(async () => {
            const institutions = await api.institutions({ keyword: value, limit: 100 })
            if (institutions.length == 0)
              setInstitutionError('Not found, please try a different search term')
            else {
              setInstitutions(institutions)
              setInstitutionError()
            }
          }, 500)
        )
      }
    }
  }

  React.useEffect(() => {
    setForms(getForms({ user, countries, regions, institutions, institutionKeyword, institutionError, changeHandler, inputHandler }))
  }, [user, institutions, institutionKeyword, institutionError])

  // Default submit handler for all forms
  const submitForm = async (submission) => {
    try {
      const newUser = await api.updateUser(user.id, submission)
      for (let email of newUser.emails) // set sent flag for "resend confirmation email" on newly added email addresses
        email.sent = !!sentEmails.find(e => e.email == email.email)
      setUser(newUser)
    }
    catch(error) {
      console.log(error)
      setError(error.message)
    }
  }

  const title = 
    <div style={{display: 'flex', alignItems: 'center'}}>
      <PersonIcon fontSize="large" style={{marginRight: "0.25em"}}/>Account
    </div>

  const logoutButton =
    <Button variant="contained" color="primary" style={{"width": "8em"}} href="/logout">Sign Out</Button>

  const initialValues = (fields) =>
    fields.reduce((acc, f) => { acc[f.id] = f.value; return acc }, {})

  const validate = (field, value, values) => {
    if (field.id == 'confirm_password' && value != values['new_password'])
      return 'Passwords must match'
  }

  return (
    <ReviewWrapper reviewMode={reviewMode} redirectUrl={redirectUrl} title={title} actions={logoutButton}>
      <Container maxWidth='md'>
        {forms && forms.filter(f => !reviewMode || !f.hideReviewMode).map((form, index) => (
          <Box key={index} className={classes.box} mt={3} mb={5}>
            <Paper elevation={3} className={classes.paper}>
              {form.render ||
                <UpdateForm 
                  title={form.title}
                  subtitle={form.subtitle}
                  fields={form.fields} 
                  initialValues={initialValues(form.fields)} 
                  validate={validate}
                  autosave={form.autosave}
                  onSubmit={(values, { setSubmitting }) => {
                    // Special case: reset region_id to "not provided" if country_id changed
                    const countryId = values['country_id']
                    if (countryId && countryId != user.region.country_id) {
                      const region = regions[countryId].find(r => r.name == "Not Provided")
                      if (region)
                        values['region_id'] = region.id
                    }

                    if (updateDebounce) clearTimeout(updateDebounce)
                    setUpdateDebounce(
                      setTimeout(() => {
                        console.log('Submit:', values)
                        if (form.submitHandler)
                          form.submitHandler(values)
                        else
                          submitForm(values)
                        setSubmitting(false)
                      }, 1000)
                    )
                  }}
                />
              }
            </Paper>
          </Box>
        ))}
      </Container>
    </ReviewWrapper>
  )
}

const ReviewWrapper = (props) => {
  if (props.reviewMode) {
    const classes = useStyles()
    const api = useAPI()
    const [user] = useUser()

    const redirect = async () => {
      await api.updateUser(user.id, { updated_at: Date.now() })
      window.open(props.redirectUrl, "_self")
    }

    return (
      <>
        <AppBar position="absolute" className={classes.appBar}>
          <Toolbar>
            <MainLogo size="medium" />
            <div style={{flexGrow: 1}}></div>
            <Typography>
              Please update your profile information
            </Typography>
            <div style={{flexGrow: 1}}></div>
            <Button variant="contained" onClick={redirect}>
              Proceed to Application
            </Button>
          </Toolbar>
        </AppBar>
        <Box mt={15}>
          {props.children}
        </Box>
      </>
    )
  }
  
  return (
    <Layout title={props.title} actions={props.actions}>
      {props.children}
    </Layout>
  )
}

const getForms = ({ user, countries, regions, institutions, institutionKeyword, institutionError, changeHandler, inputHandler }) => {
  return [ 
    { title: "Identification",
      autosave: true,
      fields: [
        { id: "first_name",
          name: "First Name",
          type: "text",
          required: true,
          width: 6,
          value: user.first_name
        },
        { id: "last_name",
          name: "Last Name",
          type: "text",
          required: true,
          width: 6,
          value: user.last_name
        },
        { id: "username",
          name: "Username",
          description: "Your username cannot be changed",
          type: "text",
          value: user.username,
          disabled: true
        },
        { id: "orcid_id",
          name: "ORCID",
          description: <span>Persistent digital identifier that distinguishes you from every other researcher (<a href="https://orcid.org" target="_blank">https://orcid.org</a>)</span>,
          type: "text",
          value: user.orcid_id
        }
      ]
    },
    { title: "Password",
      subtitle: <>Reset your password <a href="https://user.cyverse.org/forgot">here</a> if you have forgotten it</>,
      autosave: false,
      hideReviewMode: true,
      submitHandler: changeHandler,
      fields: [
        { id: "old_password",
          name: "Old Password",
          type: "password",
          required: true
        },
        { id: "new_password",
          name: "New Password",
          type: "password",
          required: true
        },
        { id: "confirm_password",
          name: "Confirm New Password",
          type: "password",
          required: true
        }
      ],
    },
    { hideReviewMode: true,
      render: 
        <EmailForm 
          emails={user.emails} 
          title="Email" 
          subtitle="Email addresses associated with this account" 
          onChange={changeHandler}
        />
    },
    { hideReviewMode: true,
      render: 
        <MailingListForm 
          emails={user.emails} 
          title="Mailing List Subscriptions" 
          subtitle="Select which service-related email notifications you’d like to receive" 
        />
    },
    { title: "Institution / Research",
      autosave: true,
      fields: [
        { id: "grid_institution_id",
          name: 'Company/Institution (enter "other" if not found)',
          type: "autocomplete",
          required: true,
          value: user.grid_institution_id,
          inputValue: institutionKeyword,
          options: institutions,
          placeholder: "Search ...",
          errorText: institutionError,
          freeSolo: true,
          onInputChange: inputHandler,
          //filterOptions: (options, _) => options // this is needed for "not found" message to be shown
        },
        { id: "department",
          name: "Department",
          type: "text",
          required: true,
          value: user.department
        },
        { id: "occupation_id",
          name: "Occupation",
          type: "select",
          required: true,
          value: user.occupation.id,
          options: properties.occupations
        },
        { id: "research_area_id",
          name: "Research Area",
          type: "select",
          required: true,
          value: user.research_area.id,
          options: properties.research_areas
        },
        { id: "funding_agency_id",
          name: "Funding Agency",
          type: "select",
          required: true,
          value: user.funding_agency.id,
          options: properties.funding_agencies
        }
      ]
    },
    { title: "Demographics",
      autosave: true,
      fields: [
        { id: "country_id",
          name: "Country",
          type: "autocomplete",
          required: true,
          value: user.region.country_id,
          options: countries,
        },
        { id: "region_id",
          name: "Region",
          type: "select",
          required: true,
          value: user.region.id,
          options: regions[user.region.country_id]
        },
        { id: "gender_id",
          name: "Gender Identity",
          type: "select",
          required: true,
          value: user.gender.id,
          options: properties.genders
        },
        { id: "ethnicity_id",
          name: "Ethnicity",
          type: "select",
          required: true,
          value: user.ethnicity.id,
          options: properties.ethnicities
        },
        // { id: "aware_channel_id",
        //   name: "How did you hear about us?",
        //   type: "select",
        //   required: true,
        //   value: user.aware_channel.id,
        //   options: properties.aware_channels
        // }
      ]
    }
  ]
}

const EmailForm = ({ emails, title, subtitle, onChange }) => {
  const api = useAPI()
  const [_, setError] = useError()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [emailToAdd, setEmailToAdd] = useState('')
  const [validationError, setValidationError] = useState()

  const handleCloseDialog = () => {
    setDialogOpen(false)
  }

  const handleChangeEmail = async (event) => {
    setEmailToAdd(event.target.value)
    setValidationError(await validateEmail(event.target.value))
  }

  const validateEmail = async (value) => {
    if (!isEmail(value))
      return 'A valid email address is required'

    const res = await api.checkEmail(value)
    if (res && res.email)
      return 'Email already assigned to an account'

    return null
  }

  const submitEmail = async () => {
    try {
      await api.createEmailAddress({ email: emailToAdd })
      if (onChange) await onChange()
      handleCloseDialog()
    }
    catch(error) {
      console.log(error)
      setError(error.message)
    }
  }

  const resendConfirmationEmail = async (email) => {
    try {
      await api.createEmailAddress({ email: email.email })
      if (onChange) await onChange({ email })
      handleCloseDialog()
    }
    catch(error) {
      console.log(error)
      setError(error.message)
    }
  }

  const removeEmailAddress = async (id) => {
    try {
      await api.deleteEmailAddress(id)
      if (onChange) await onChange()
      handleCloseDialog()
    }
    catch(error) {
      console.log(error)
      setError(error.message)
    }
  }

  const setPrimaryEmail = async (id) => {
    try {
      await api.updateEmailAddress(id, { setPrimary: true })
      if (onChange) await onChange()
    }
    catch(error) {
      console.log(error)
      setError(error.message)
    }
  }

  const statusMsg = (email) => email.verified 
    ? <>
        Confirmed 
        {email.primary 
          ? ', Primary' 
          : <Link onClick={() => setPrimaryEmail(email.id)} style={{marginLeft: '1em'}}>[ Make primary ]</Link>
        }
      </>
    : <>
        A confirmation email has been sent. 
        Click on the link in the email to verify that this is your address.<br />
        {email.sent
          ? '[ Sent! ]'
          : <Link onClick={() => resendConfirmationEmail(email)}>[ Resend Confirmation Email ]</Link>
        }
      </>

  return (
    <div>
      <Box>
        <Typography component="div" variant="h5">{title}</Typography>
        <Typography color="textSecondary" gutterBottom>{subtitle}</Typography>
        <List>
          {emails.sort(sortPrimaryFirst).map(email => (
            <ListItem key={email.id}>
              <ListItemAvatar>
                <Avatar>
                  <MailIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={email.email} 
                secondary={statusMsg(email)} 
              />
              {!email.primary &&
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="delete" onClick={() => removeEmailAddress(email.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              }
            </ListItem>
          ))}
        </List>
      </Box>
      <Box display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          color="primary"
          onClick={() => setDialogOpen(true)}
        >
          Add Email Address
        </Button>
      </Box>
      <AddEmailAddressDialog 
        open={dialogOpen}
        error={validationError}
        handleChange={handleChangeEmail}
        handleClose={handleCloseDialog} 
        handleSubmit={!isEmpty(emailToAdd) && !validationError ? submitEmail : null}
      />
    </div>
  )
}

function sortPrimaryFirst(a, b) {
  if (a.primary)
    return -1
  if (b.primary)
    return 1
  return a.email.localeCompare(b.email)
}

const AddEmailAddressDialog = ({ open, error, handleChange, handleClose, handleSubmit }) => (
  <Dialog open={open} onClose={handleClose} fullWidth aria-labelledby="form-dialog-title">
    <DialogTitle id="form-dialog-title">Add Email Address</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Enter the email address to add to your account.
      </DialogContentText>
      <TextField
        autoFocus
        margin="dense"
        fullWidth
        id="name"
        type="email"
        error={!!error}
        helperText={error}
        onChange={handleChange}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={handleClose}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} variant="contained" color="primary" disabled={!handleSubmit}>
        Add
      </Button>
    </DialogActions>
  </Dialog>
)

export default Account
