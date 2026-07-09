/**
 * HollowPay — Project Settings Config Service
 *
 * Persists project-specific configuration toggles (like checkout expiry duration)
 * locally, avoiding database schema migrations for lightweight key-value configs.
 */

import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.resolve(process.cwd(), 'project_settings.json');

interface ProjectConfig {
  checkoutSessionExpiryMinutes: number;
}

const DEFAULT_CONFIG: ProjectConfig = {
  checkoutSessionExpiryMinutes: 15,
};

function readSettingsFile(): Record<string, ProjectConfig> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read project settings file:', err);
  }
  return {};
}

function writeSettingsFile(data: Record<string, ProjectConfig>) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write project settings file:', err);
  }
}

/**
 * Gets config settings for a specific project.
 */
export function getProjectSettings(projectPublicId: string): ProjectConfig {
  const settings = readSettingsFile();
  return settings[projectPublicId] || { ...DEFAULT_CONFIG };
}

/**
 * Updates settings for a specific project.
 */
export function updateProjectSettings(
  projectPublicId: string,
  params: Partial<ProjectConfig>
): ProjectConfig {
  const settings = readSettingsFile();
  const current = settings[projectPublicId] || { ...DEFAULT_CONFIG };
  const updated = { ...current, ...params };
  settings[projectPublicId] = updated;
  writeSettingsFile(settings);
  return updated;
}
