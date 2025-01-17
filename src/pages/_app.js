// From https://github.com/mui-org/material-ui/tree/master/examples/nextjs

import React from 'react'
import * as Sentry from "@sentry/react";
import Head from 'next/head'
import { ThemeProvider } from '@material-ui/core/styles'
import CssBaseline from '@material-ui/core/CssBaseline'
import theme from '../theme'
//import { KeycloakProvider } from '../contexts/keycloak'
import { APIProvider } from '../contexts/api'
import { UserProvider } from '../contexts/user'
import { ErrorProvider } from '../contexts/error'
import Custom404 from './404'
import Custom500 from './500'

if (process.env.SENTRY_DSN) {
  Sentry.init({ 
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
  });
}

// From https://github.com/vercel/next.js/blob/canary/examples/with-google-analytics/pages/_document.js
export function reportWebVitals({ id, name, label, value }) {
  if (window?.gtag)
    window?.gtag('event', name, {
      event_category:
        label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
      value: Math.round(name === 'CLS' ? value * 1000 : value), // values must be integers
      event_label: id, // id unique to current page load
      non_interaction: true, // avoids affecting bounce rate.
    })
}

function MyApp(props) {
  const { Component, pageProps, kauth, user, baseUrl, token } = props

  // Added to handle errors from API during SSR
  if (pageProps.error) {
    console.log('Error in getServerSideProps:', pageProps.error)
    if (pageProps.error.statusCode == 404)
      return Custom404()
    else
      return Custom500()
  }

  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector('#jss-server-side')
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles)
    }
  })

  return (
    <Sentry.ErrorBoundary fallback={"An error has occurred"}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
          {/* <KeycloakProvider kauth={kauth}> */}
            <APIProvider baseUrl={baseUrl} token={token}>
              <UserProvider user={user}>
                <Head>
                  <title>User Portal - CyVerse</title>
                </Head>
                <ErrorProvider>
                  <Component {...pageProps} />
                </ErrorProvider>
              </UserProvider>
            </APIProvider>
          {/* </KeycloakProvider> */}
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  )
}

export default MyApp

MyApp.getInitialProps = async ({ Component, ctx }) => {
  const req = ctx.req
  const api = req && req.api
  return {
    kauth: req && req.kauth,
    baseUrl: api && api.baseUrl, 
    token: api && api.token,
    user: api && api.token ? await api.user() : null,
    pageProps: Component.getInitialProps ? await Component.getInitialProps(ctx) : {},
  }
}