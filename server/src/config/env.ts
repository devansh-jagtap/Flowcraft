const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

/** Express "trust proxy": hop count, true/false, or a list of addresses. Needed for real visitor IPs behind a proxy. */
function trustProxy(value = process.env.TRUST_PROXY): boolean | number | string {
  if (!value) return isProduction ? 1 : false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 5000),
  // Neon Postgres. `neon deploy` pulls both into the repo's .env.local: pooled for the app, direct for migrations.
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? '',
  clerk: {
    // Used to verify session tokens and look up profiles. Get it from the Clerk dashboard → API keys.
    secretKey: process.env.CLERK_SECRET_KEY,
    // Optional PEM public key for verifying tokens without a network call.
    jwtKey: process.env.CLERK_JWT_KEY,
  },
  aiGateway: {
    // Vercel AI Gateway (https://vercel.com/docs/ai-gateway). Preferred over GEMINI_API_KEY when set.
    apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
    model: process.env.AI_GATEWAY_MODEL ?? 'google/gemini-2.5-flash',
    baseUrl: process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1',
  },
  openai: {
    // Only used with a visitor's own OpenAI key (bring your own key).
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    // Overridable so tests and local demos can point at a fake server.
    baseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
  },
  freeAi: {
    // Generations a signed-in account gets on the server's key per window. After that they need their own key. 0 = own keys only.
    limit: Math.max(0, Number(process.env.AI_FREE_LIMIT ?? 5) || 0),
    // Guests are counted per network address, so they get a smaller trial. Signing up unlocks the full allowance.
    guestLimit: Math.max(0, Number(process.env.AI_FREE_GUEST_LIMIT ?? 2) || 0),
    windowHours: Math.max(1, Number(process.env.AI_FREE_WINDOW_HOURS ?? 24) || 24),
  },
  // Encrypts the API keys users save to their account. Keep it secret and stable: changing it makes saved keys unreadable.
  aiKeysSecret: process.env.AI_KEYS_SECRET ?? '',
  trustProxy: trustProxy(),
  clientOrigins: [
    ...(process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
    // On Vercel, the project's production address and this deployment's own URL are always allowed.
    ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL].filter(Boolean).map((host) => `https://${host}`),
  ].filter((origin) => origin),
} as const;
