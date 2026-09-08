import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = process.env.SEO_TOOL_CONFIG_DIR || path.join(os.homedir(), '.seo-tool');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

export const SETTINGS_FIELDS = [
  { key: 'GPT_CHAT_API_KEY', label: 'GPT Chat API Key', secret: true },
  { key: 'GPT_CHAT_BASE_URL', label: 'GPT Chat Base URL', secret: false },
  { key: 'GPT_CHAT_MODEL', label: 'GPT Chat Model', secret: false },
  { key: 'GPT_IMAGE_API_KEY', label: 'GPT Image API Key', secret: true },
  { key: 'GPT_IMAGE_BASE_URL', label: 'GPT Image Base URL', secret: false },
  { key: 'GPT_IMAGE_MODEL', label: 'GPT Image Model', secret: false },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', secret: true },
  { key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', secret: true },
  { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', secret: true },
  { key: 'GOOGLE_REDIRECT_URI', label: 'Google Redirect URI', secret: false },
];

function readSettingsFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSettingsFile(data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadSettingsIntoEnv() {
  const saved = readSettingsFile();
  for (const [key, value] of Object.entries(saved)) {
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getSettings() {
  return readSettingsFile();
}

export function updateSettings(partial) {
  const current = readSettingsFile();
  const next = { ...current };

  for (const [key, value] of Object.entries(partial)) {
    if (value === '' || value === null || value === undefined) {
      delete next[key];
      delete process.env[key];
    } else {
      next[key] = value;
      process.env[key] = value;
    }
  }

  writeSettingsFile(next);
  return next;
}

// Side effect: this must run as soon as this module is imported, and this
// module must be the first import in server.js, so saved settings land in
// process.env before any service module reads process.env at import time.
loadSettingsIntoEnv();
