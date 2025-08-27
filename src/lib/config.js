export const NODE_ENV = process.env.NODE_ENV || 'development'
export const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 3000
export const HONEYPOT_DIVISOR = parseInt(process.env.HONEYPOT_DIVISOR) || 7
export const DEBUG_USER = process.env.DEBUG_USER || ''
export const DB_SESSION_TABLE = process.env.DB_SESSION_TABLE || 'user_sessions'
export const SESSION_TTL = parseInt(process.env.SESSION_TTL) || 86400
export const SESSION_SECURE_COOKIE =
    process.env.SESSION_SECURE_COOKIE || 'false'
export const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:3000'
export const API_BASE_URL =
    process.env.API_BASE_URL || 'http://localhost:3000/api'
export const WS_BASE_URL = process.env.WS_BASE_URL || 'ws://localhost:3000/'
export const UID_NUMBER_OFFSET = process.env.UID_NUMBER_OFFSET || '2696'
export const HMAC_KEY = process.env.HMAC_KEY || ''
export const GOOGLE_ANALYTICS_ID = process.env.GOOGLE_ANALYTICS_ID || ''
export const SENTRY_DSN = process.env.SENTRY_DSN || ''
export const DB_HOST = process.env.DB_HOST || 'localhost'
export const DB_PORT = process.env.DB_PORT || '5432'
export const DB_NAME = process.env.DB_NAME || 'portal'
export const DB_USER = process.env.DB_USER || 'portal'
export const DB_PASSWORD = process.env.DB_PASSWORD || ''
export const SESSION_SECRET = process.env.SESSION_SECRET || ''
export const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || ''
export const KEYCLOAK_AUTH_URL = process.env.KEYCLOAK_AUTH_URL || ''
export const KEYCLOAK_CLIENT = process.env.KEYCLOAK_CLIENT || ''
export const KEYCLOAK_SECRET = process.env.KEYCLOAK_SECRET || ''
export const BCC_NEW_ACCOUNT_CONFIRMATION =
    process.env.BCC_NEW_ACCOUNT_CONFIRMATION || ''
export const BCC_PASSWORD_CHANGE_REQUEST =
    process.env.BCC_PASSWORD_CHANGE_REQUEST || ''
export const BCC_SERVICE_ACCESS_GRANTED =
    process.env.BCC_SERVICE_ACCESS_GRANTED || ''
export const BCC_WORKSHOP_ENROLLMENT_REQUEST =
    process.env.BCC_WORKSHOP_ENROLLMENT_REQUEST || ''
export const BCC_INTERCOM = process.env.BCC_INTERCOM || ''
export const INTERCOM_ENABLED = process.env.INTERCOM_ENABLED || 'false'
export const INTERCOM_APP_ID = process.env.INTERCOM_APP_ID || ''
export const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN || ''
export const INTERCOM_COMPANY_ID = process.env.INTERCOM_COMPANY_ID || ''
export const INTERCOM_ADMIN_USER_PORTAL_BOT_ID =
    process.env.INTERCOM_ADMIN_USER_PORTAL_BOT_ID || ''
export const INTERCOM_ADMIN_TIER1_ATMOSPHERE_BOT_ID =
    process.env.INTERCOM_ADMIN_TIER1_ATMOSPHERE_BOT_ID || ''
export const INTERCOM_ADMIN_TIER1_SCIENCE_TEAM_ID =
    process.env.INTERCOM_ADMIN_TIER1_SCIENCE_TEAM_ID || ''
export const INTERCOM_ADMIN_TIER1_DATA_WATCH_ID =
    process.env.INTERCOM_ADMIN_TIER1_DATA_WATCH_ID || ''
export const PROFILE_UPDATE_PERIOD = process.env.PROFILE_UPDATE_PERIOD || ''
export const PROFILE_WARNING_PERIOD = process.env.PROFILE_WARNING_PERIOD || ''
export const PROFILE_UPDATE_TEXT = process.env.PROFILE_UPDATE_TEXT || ''
export const PROFILE_WARNING_TEXT = process.env.PROFILE_WARNING_TEXT || ''
export const SMTP_HOST = process.env.SMTP_HOST || ''
export const SMTP_PORT = process.env.SMTP_PORT || ''
export const SMTP_FROM = process.env.SMTP_FROM || ''
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || ''
