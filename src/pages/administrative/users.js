import { useState, useEffect } from 'react'
import Link from "next/link"
import { makeStyles } from '@material-ui/core/styles'
import { Container, Grid, Paper, Typography, TextField, CircularProgress, TableContainer, Table, TableHead, TableBody, TableFooter, TableRow, TableCell, TablePagination } from '@material-ui/core'
import Layout from '../../components/Layout'
import { useAPI } from '../../contexts/api'
import { withGetServerSideError } from '../../contexts/error'

//FIXME duplicated elsewhere
const useStyles = makeStyles((theme) => ({
  paper: {
    padding: '3em'
  }
}))

//TODO move pagination code into shared component
const Users = props => {
  const api = useAPI()
  const classes = useStyles()

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [keyword, setKeyword] = useState()
  const [count, setCount] = useState(props.count)
  const [rows, setRows] = useState(props.results)
  const [debounce, setDebounce] = useState(null)
  const [searching, setSearching] = useState(false)
  
  const handleChangePage = async (event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = async (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleChangeKeyword = async (event) => {
    setSearching(true)
    setKeyword(event.target.value)
    setPage(0)
  }

  useEffect(() => {
    if (debounce) clearTimeout(debounce)
    setDebounce(
      setTimeout(async () => {
          const { count, results } = await api.users({ 
            offset: page * rowsPerPage, 
            limit: rowsPerPage,
            keyword: keyword
          })
          setCount(count)
          setRows(results)
          setSearching(false)
        }, 500)
    )},
    [page, rowsPerPage, keyword]
  )

  return (
    <Layout breadcrumbs>
      <Container maxWidth='lg'>
        <br />
        <Paper elevation={3} className={classes.paper}>
          <Grid container justify="space-between">
            <Grid item>
              <Typography component="h1" variant="h4" gutterBottom>Users</Typography>
            </Grid>
            <Grid item>
              <TextField 
                style={{width: '20em'}} 
                placeholder="Search ..." 
                onChange={handleChangeKeyword} 
                InputProps={{ 
                  endAdornment: (
                    <React.Fragment>
                      {searching && <CircularProgress color="inherit" size={20} />}
                    </React.Fragment>
                  )
                }}
              />
            </Grid>
          </Grid>
          <Typography color="textSecondary" gutterBottom>
            Search across first name, last name, username, email, institution, occupation, region, and country.<br />
            Enter multiple keywords separated by spaces.
          </Typography>
          <br />
          <UserTable 
            rows={rows} 
            rowsPerPage={rowsPerPage} 
            count={count} 
            page={page} 
            handleChangePage={handleChangePage} 
            handleChangeRowsPerPage={handleChangeRowsPerPage} 
          />
        </Paper>
      </Container>
    </Layout>
  )
}

const UserTable = ({ rows, rowsPerPage, count, page, handleChangePage, handleChangeRowsPerPage }) => (
  <TableContainer component={Paper}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>First Name</TableCell>
          <TableCell>Last Name</TableCell>
          <TableCell>Username</TableCell>
          <TableCell>Email</TableCell>
          <TableCell>Institution</TableCell>
          <TableCell>Occupation</TableCell>
          <TableCell>Region</TableCell>
          <TableCell>Country</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((user, index) => (
          <Link key={index} href={`/administrative/users/${user.id}`}>
            <TableRow hover style={{cursor: 'pointer'}}>
              <TableCell>{user.first_name}</TableCell>
              <TableCell>{user.last_name}</TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.institution}</TableCell>
              <TableCell>{user.occupation.name}</TableCell>
              <TableCell>{user.region.name}</TableCell>
              <TableCell>{user.region.country.name}</TableCell>
            </TableRow>
          </Link>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TablePagination
            rowsPerPage={rowsPerPage}
            count={count}
            page={page}
            onChangePage={handleChangePage}
            onChangeRowsPerPage={handleChangeRowsPerPage}
          />
        </TableRow>
      </TableFooter>
    </Table>
  </TableContainer>
)

export const getServerSideProps = withGetServerSideError(
  async ({ req }) => {
    const { count, results } = await req.api.users()

    return {
      props: {
        count,
        results
      }
    }
  }
)

export default Users