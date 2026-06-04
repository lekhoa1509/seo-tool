import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_REDIRECT_URI = 'http://localhost:3001/api/gsc/callback';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/spreadsheets',
];

let tokens = null;

function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
}

function sanitizeReturnTo(value = '/gsc') {
  const text = String(value || '/gsc').trim();
  if (!text.startsWith('/') || text.startsWith('//')) return '/gsc';
  return text;
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getGoogleAuthUrl({ returnTo = '/gsc' } = {}) {
  const oauth2Client = getGoogleOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
    state: JSON.stringify({ returnTo: sanitizeReturnTo(returnTo) }),
  });
}

export async function handleGoogleOAuthCallback(code, state = '') {
  const oauth2Client = getGoogleOAuthClient();
  const { tokens: newTokens } = await oauth2Client.getToken(code);
  tokens = newTokens;
  oauth2Client.setCredentials(tokens);

  let returnTo = '/gsc';
  try {
    returnTo = sanitizeReturnTo(JSON.parse(String(state || '{}')).returnTo || returnTo);
  } catch {}

  return `${getFrontendUrl()}${returnTo}${returnTo.includes('?') ? '&' : '?'}googleConnected=true`;
}

export function disconnectGoogleAuth() {
  tokens = null;
}

export function getGoogleAuthStatus() {
  const scopeText = String(tokens?.scope || '');

  return {
    connected: Boolean(tokens),
    configured: isGoogleConfigured(),
    sheetsConnected: Boolean(tokens && scopeText.includes('https://www.googleapis.com/auth/spreadsheets')),
  };
}

export function getAuthenticatedGoogleClient() {
  if (!tokens) {
    throw new Error('Chưa kết nối Google. Hãy kết nối Google Sheets trước.');
  }

  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}
