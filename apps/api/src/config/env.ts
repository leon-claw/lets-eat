import { z } from 'zod';

const SAMPLE_JWT_SECRET = 'replace-with-at-least-32-random-characters';
const SAMPLE_DATABASE_PASSWORD = 'lets_eat_dev';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().default('postgresql://lets_eat:lets_eat_dev@localhost:5432/lets_eat'),
  JWT_SECRET: z.string().min(32).default(SAMPLE_JWT_SECRET),
  WEB_ORIGINS: z.string().min(1).default('http://localhost:3000'),
  TRUST_PROXY: z.string().default('loopback'),
  CATALOG_VERSION: z.string().regex(/^v[1-9]\d*$/).default('v3'),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const env = EnvSchema.parse(input);
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET === SAMPLE_JWT_SECRET) {
      throw new Error('JWT_SECRET must be changed in production');
    }
    if (new URL(env.DATABASE_URL).password === SAMPLE_DATABASE_PASSWORD) {
      throw new Error('DATABASE_URL password must be changed in production');
    }
  }
  return env;
}
