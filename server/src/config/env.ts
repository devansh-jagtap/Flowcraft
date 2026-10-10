const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) throw new Error('JWT_SECRET must be set in production');
  // Convenient default for local development and tests only.
  return 'dev-only-insecure-secret';
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/flowcraft',
  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    // Overridable so tests and local demos can point at a fake server.
    baseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
  },
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
} as const;
