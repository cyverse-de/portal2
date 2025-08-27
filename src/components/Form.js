import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    LinearProgress,
    MenuItem,
    Step,
    StepLabel,
    Stepper,
    Switch,
    TextField,
    Typography,
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import { Field, Form, Formik, useFormikContext } from 'formik'
import debounce from 'just-debounce-it'
import React, { useEffect, useState } from 'react'
import {
    isAlphanumeric,
    isDate,
    isEmail,
    isEmpty,
    isLowercase,
    isNumeric,
} from 'validator'
import config from '../lib/config'
import { validatePassword } from '../lib/misc'
import { makeStyles } from '../styles/tss'

const useStyles = makeStyles()(theme => ({
    formStepper: {
        [theme.breakpoints.down('xs')]: {
            display: 'none',
        },
    },
    checkbox: {
        paddingTop: '2em',
    },
    hidden: {
        display: 'none',
    },
    honeypot: {
        position: 'fixed',
        top: -100,
    },
}))

const initialValues = fields =>
    fields.reduce((acc, f) => {
        acc[f.id] = f.value
        return acc
    }, {})

const validateField = (field, value) => {
    if ((field.is_required || field.required) && isEmpty(value))
        return 'This field is required'
    if (field.type == 'email' && !isEmail(value))
        return 'A valid email address is required'
    if (field.type == 'number' && (!isNumeric(value) || value <= 0))
        return 'A valid numeric value is required'
    if (field.type == 'date' && !isDate(value))
        return 'A valid date value is required'
    if (field.type == 'password') {
        const error = validatePassword(value)
        if (error) return error
    }
    if (field.type == 'username') {
        if (value.length < 5)
            return 'Usernames must be at least 5 characters long'
        if (value.length > 150)
            return 'Usernames must be less than 150 characters long'
        if (!isAlphanumeric(value) || !isLowercase(value))
            return 'Usernames must be all lowercase and only contain letters and numbers (a-z, 0-9)'
    }

    return null
}

const validateFields = async (fields, values, customValidator) => {
    //if (values && Object.keys(values).length > 0) console.log('validate:', values)
    let errors = {}
    for (let field of fields) {
        const id = field.id
        const value = id in values ? '' + values[id] : '' // force to string type

        let error = validateField(field, value)
        if (!error && customValidator)
            error = await customValidator(field, value, values)
        if (error) errors[id] = error
    }
    //if (Object.keys(errors).length > 0) console.log('errors:', errors)
    return errors
}

function CircularProgressWithLabel(props) {
    return (
        <Box position="relative" display="inline-flex">
            <CircularProgress variant="indeterminate" />
            <Box
                top={0}
                left={0}
                bottom={0}
                right={0}
                position="absolute"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                <Typography
                    variant="caption"
                    component="div"
                    color="textSecondary"
                    style={{ fontSize: '0.7em' }}
                >
                    {props.value}
                </Typography>
            </Box>
        </Box>
    )
}

// From https://github.com/formium/formik/blob/e51f09a318cba216a1ba3932da0906202df0b979/examples/DebouncedAutoSave.js
const AutoSave = ({ debounceMs }) => {
    const formik = useFormikContext()
    const debouncedSubmit = React.useCallback(
        debounce(formik.submitForm, debounceMs),
        [debounceMs, formik.submitForm]
    )

    useEffect(() => {
        debouncedSubmit()
    }, [debouncedSubmit, formik.values])

    return (
        <></>
        // <div style={!!formik.isSubmitting ? null : {visibility: 'hidden'}}>
        //   <CircularProgressWithLabel value='Saving' />
        // </div>
    )
}

const UpdateForm = ({
    title,
    subtitle,
    fields,
    autosave,
    validate,
    onSubmit,
}) => {
    //FIXME Formik is submitting the form on load, thus check for submitCount > 1 when showing update indicator
    return (
        <Formik
            initialValues={initialValues(fields)}
            validate={async values =>
                await validateFields(fields, values, validate)
            }
            validateOnMount
            onSubmit={onSubmit}
        >
            {({
                handleChange,
                handleBlur,
                handleSubmit,
                submitCount,
                isSubmitting,
                isValid,
                values,
                errors,
                touched,
                dirty,
            }) => (
                <Form>
                    {title && (
                        <Grid
                            container
                            justifyContent="space-between"
                            style={{ height: '3em' }}
                        >
                            <Grid item>
                                <Typography component="div" variant="h5">
                                    {title}
                                </Typography>
                            </Grid>
                            <Grid item>
                                {submitCount > 1 && isSubmitting && (
                                    <CircularProgressWithLabel value="Saving" />
                                )}
                            </Grid>
                        </Grid>
                    )}
                    {subtitle && (
                        <Typography color="textSecondary">
                            {subtitle}
                        </Typography>
                    )}
                    {fields.map((field, index) => (
                        <div key={index}>
                            <FormField
                                onChange={handleChange}
                                onBlur={handleBlur}
                                errorText={
                                    touched[field.id] && errors[field.id]
                                }
                                {...field}
                            />
                        </div>
                    ))}
                    <Box display="flex" justifyContent="flex-end">
                        {autosave ? (
                            <AutoSave debounceMs={500} />
                        ) : (
                            <Button
                                variant="contained"
                                color="primary"
                                disabled={isSubmitting || !isValid || !dirty}
                                onClick={handleSubmit}
                            >
                                Update
                            </Button>
                        )}
                    </Box>
                </Form>
            )}
        </Formik>
    )
}

const Wizard = ({ form, initialValues, validate, onSelect, onSubmit }) => {
    const [stepNumber, setStepNumber] = useState(0)
    const [snapshot, setSnapshot] = useState(initialValues)
    const [isInitialValid, setInitialValid] = useState(false) // workaround for validateOnMount not working: https://github.com/formium/formik/issues/1950

    const handleNext = values => {
        console.log('next:', values)
        setSnapshot(values)
        setStepNumber(prevStep => prevStep + 1)
        setInitialValid(false)
    }

    const handleBack = values => {
        console.log('back:', values)
        setSnapshot(values)
        setStepNumber(prevStep => prevStep - 1)
        setInitialValid(true)
    }

    return (
        <div>
            <FormStepper
                activeStep={stepNumber}
                steps={form.sections.map(s => s.name)}
            />
            <Formik
                initialValues={snapshot}
                validate={async values =>
                    await validateFields(
                        form.sections[stepNumber].fields,
                        values,
                        validate
                    )
                }
                enableReinitialize //FIXME is this necessary?
                validateOnMount //FIXME is this necessary?
                isInitialValid={isInitialValid}
                onSubmit={onSubmit}
            >
                {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    isSubmitting,
                    isValid,
                    values,
                    errors,
                    touched,
                }) => (
                    <Form>
                        {form.sections[stepNumber].fields.map(field => (
                            <FormField
                                key={field.id}
                                onChange={handleChange}
                                onSelect={onSelect}
                                onBlur={handleBlur}
                                errorText={
                                    touched[field.id] && errors[field.id]
                                }
                                value={values[field.id]}
                                {...field}
                            />
                        ))}
                        <br />
                        <br />
                        {isSubmitting && <LinearProgress />}
                        <Box display="flex" justifyContent="flex-end">
                            <FormControls
                                disabled={isSubmitting || !isValid}
                                activeStep={stepNumber}
                                numSteps={form.sections.length}
                                nextHandler={handleNext.bind(null, values)}
                                backHandler={handleBack.bind(null, values)}
                                submitHandler={handleSubmit}
                            />
                        </Box>
                    </Form>
                )}
            </Formik>
        </div>
    )
}

const FormStepper = ({ activeStep, steps }) => {
    if (steps.length <= 1) return <></>
    const { classes } = useStyles()
    return (
        <Stepper className={classes.formStepper}>
            {steps.map((title, index) => (
                <Step
                    key={index}
                    completed={activeStep > index}
                    active={activeStep == index}
                >
                    <StepLabel>{title}</StepLabel>
                </Step>
            ))}
        </Stepper>
    )
}

const honeypotId = modulus =>
    (
        config.HONEYPOT_DIVISOR * Math.floor(Math.random() * 1000) +
        modulus
    ).toString()

const SwitchField = props => (
    <>
        <br />
        <FormControlLabel
            control={
                <Switch
                    color="primary"
                    id={props.id}
                    name={props.name}
                    defaultChecked={props.defaultValue}
                    onChange={props.onChange}
                />
            }
            label={props.label}
        />
    </>
)

const FormField = props => {
    const { classes } = useStyles()

    const commonProps = {
        id: props.id.toString(),
        name: props.id.toString(),
        label: props.name,
        type: props.type,
        error: props.errorText != null,
        helperText: props.errorText || props.description,
        placeholder: props.placeholder,
        fullWidth: true,
        margin: 'normal',
        required: props.is_required || props.required,
        disabled: props.disabled,
        multiline: props.multiline,
        rows: props.rows,
        autoFocus: props.autoFocus,
        onFocus: props.onFocus,
    }

    if (props.type === 'boolean') {
        return (
            <Field
                id={props.id.toString()}
                name={props.id.toString()}
                type="checkbox"
                component={CheckboxWithLabel}
                color="primary"
                defaultValue={!!props.value}
                onChange={props.onChange}
                Label={{ label: props.name, className: classes.checkbox }}
            />
        )
    }

    if (props.type === 'toggle') {
        return (
            <Field
                id={props.id.toString()}
                name={props.id.toString()}
                type="checkbox"
                label={props.name}
                component={SwitchField}
                defaultValue={!!props.value}
                onChange={props.onChange}
            />
        )
    }

    if (props.type === 'select') {
        return (
            <Field
                as="select"
                component={TextField}
                select
                onChange={
                    props.onChange && props.onChange(props.id.toString()) // workaround for "you didn't pass an id" error
                }
                defaultValue={props.value}
                {...commonProps}
                inputProps={{ style: { textAlign: 'left' } }}
            >
                {props.options.map((option, index) => (
                    <MenuItem
                        key={index}
                        value={option.id.toString()}
                        onClick={() =>
                            props.onSelect && props.onSelect(props, option)
                        }
                    >
                        {option.name}
                    </MenuItem>
                ))}
            </Field>
        )
    }

    if (props.type === 'number') {
        return (
            <Field
                id={props.id.toString()}
                name={props.id.toString()}
                type="number"
                component={TextField}
                defaultValue={props.value}
                onChange={props.onChange}
                InputLabelProps={{ shrink: true }}
                {...commonProps}
            />
        )
    }

    if (props.type === 'autocomplete') {
        const options = props.options || []

        return (
            <Field
                component={Autocomplete}
                onChange={(event, option) => {
                    //FIXME this is causing the controlled vs. uncontrolled warning
                    if (!option) return
                    event.target.name = props.id
                    event.target.value = option.id
                    if (typeof props.onChange === 'function')
                        props.onChange(event)
                    if (typeof props.onSelect === 'function')
                        props.onSelect(props, option)
                }}
                onInputChange={(event, value) =>
                    event &&
                    props.onInputChange &&
                    props.onInputChange(props.id, value)
                }
                options={options}
                filterOptions={x => x} // disable built-in filter (needed for "only first 100 results shown" option in institutions dropdown)
                getOptionSelected={(option, value) =>
                    option && value && option.id == value.id
                }
                getOptionDisabled={option => option && option.disabled}
                getOptionLabel={option =>
                    option && option.name ? option.name : ''
                }
                inputValue={props.inputValue}
                value={options.find(
                    option => option && option.id == props.value
                )}
                freeSolo={props.freeSolo} // when true prevents "no options" from showing in the dropdown while loading (for async mode)
                autoComplete={false} // attempt to prevent browser auto-fill
                renderInput={params => (
                    <TextField
                        {...params}
                        {...commonProps}
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <React.Fragment>
                                    {props.loading ? (
                                        <CircularProgress
                                            color="inherit"
                                            size={20}
                                        />
                                    ) : null}
                                    {params.InputProps.endAdornment}
                                </React.Fragment>
                            ),
                        }}
                    />
                )}
            />
        )
    }

    const fakeId = honeypotId(0) // 0 indicates that this is a honeypot field

    return (
        // type is 'char' or 'text'
        <>
            <Field
                component={TextField}
                autoFocus={props.index == 0}
                onChange={props.onChange}
                onBlur={props.onBlur}
                InputLabelProps={{ shrink: true }} // to prevent "mm/dd/yyyy" helper text bug
                defaultValue={props.value}
                {...commonProps}
            />
        </>
    )
}

const FormControls = ({
    disabled,
    activeStep,
    numSteps,
    backHandler,
    nextHandler,
    submitHandler,
}) => {
    const isLastStep = activeStep === numSteps - 1

    return (
        <div>
            {activeStep === numSteps ? (
                <div>
                    <Typography>
                        All steps completed - you&apos;re finished
                    </Typography>
                </div>
            ) : (
                <div>
                    {numSteps > 1 && activeStep > 0 && (
                        <Button onClick={backHandler}>Previous</Button>
                    )}{' '}
                    <Button
                        disabled={disabled}
                        variant="contained"
                        color="primary"
                        onClick={isLastStep ? submitHandler : nextHandler}
                    >
                        {isLastStep ? 'Submit' : 'Next'}
                    </Button>
                </div>
            )}
        </div>
    )
}

const FormDialog = ({ title, open, fields, handleClose, handleSubmit }) => {
    const [values, setValues] = useState({})
    const [errors, setErrors] = useState({})

    const handleChange = e => {
        const error = validateField(e.target, e.target.value)
        setErrors({ ...errors, [e.target.id]: error })
        setValues({ ...values, [e.target.id]: e.target.value })
    }

    return (
        <Dialog open={open} onClose={handleClose} fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {fields.map((field, index) => (
                    <TextField
                        key={index}
                        autoFocus={index == 0}
                        margin="normal"
                        fullWidth
                        error={!!errors[field.id]}
                        helperText={errors[field.id]}
                        onChange={handleChange}
                        {...field}
                    />
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} variant="outlined">
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    disabled={
                        Object.values(values).every(e => !e) ||
                        Object.values(errors).some(e => e) ||
                        !handleSubmit
                    }
                    onClick={() => handleSubmit(values)}
                >
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export {
    FormControls,
    FormDialog,
    FormField,
    FormStepper,
    honeypotId,
    UpdateForm,
    validateField,
    Wizard,
}
