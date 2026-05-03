import fs from 'node:fs';
import path from 'node:path';

try {
  const envPath = path.resolve('.env');
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2]?.replace(/^["']|["']$/g, '') ?? '';
  }
} catch {
  // .env is optional; deployed environments should inject variables directly.
}
