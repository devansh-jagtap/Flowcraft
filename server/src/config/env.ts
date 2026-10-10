const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/flowcraft',
  clerk: {
    // Used to verify session tokens and look up profiles. Get it from the Clerk dashboard → API keys.
    secretKey: process.env.CLERK_SECRET_KEY,
    // Optional PEM public key for verifying tokens without a network call.
    jwtKey: process.env.CLERK_JWT_KEY,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    // Overridable so tests and local demos can point at a fake server.
    baseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
  },
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
} as const;
