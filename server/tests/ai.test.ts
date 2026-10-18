import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSource } from '../src/ai/checkSource.js';
import { generateDiagram, normalise } from '../src/ai/diagramGenerator.js';
import { env } from '../src/config/env.js';
import { api, signUp } from './helpers.js';

const FLOW = {
  title: 'Login flow',
  type: 'flowchart',
  direction: 'TB',
  source: '(Open app) -> Logged in?\nLogged in? -> (Home): yes\nLogged in? -> Login screen: no',
};

/** Fakes Gemini's REST response shape around a JSON payload. */
const geminiReply = (payload: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** Fakes AI Gateway's OpenAI-compatible response shape around a JSON payload. */
const gatewayReply = (payload: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('checkSource', () => {
  it('accepts valid flowcharts and trees', () => {
    expect(checkSource('flowchart', FLOW.source)).toEqual([]);
    // A lone "(Start)" line only sets the shape; the step is connected on the next line.
    expect(checkSource('flowchart', '(Customer opens app)\nCustomer opens app -> Browse\nBrowse -> (Done)')).toEqual([]);
    // Loops back to earlier steps, labelled edges and shape wrappers are fine.
    expect(checkSource('flowchart', '(Start) -> Valid?\nValid? -> (End): yes\nValid? -> Fix it: no\nFix it -> Valid?')).toEqual([]);
    expect(checkSource('mindmap', 'Root\n  A\n    B\n  C')).toEqual([]);
  });

  it('reports common model mistakes', () => {
    expect(checkSource('flowchart', 'Just one line')).toEqual(['The diagram needs at least 2 lines.']);
    expect(checkSource('flowchart', 'Step one\nStep two')[0]).toMatch(/arrows/);
    expect(checkSource('flowchart', 'A ->\nB -> C')[0]).toMatch(/nothing on one side/);
    // Seen with real Gemini output: steps listed on their own lines float unconnected.
    expect(checkSource('flowchart', '(Start) -> Register\nFill form\nRegister -> (End)')).toEqual([
      'Line 2 "Fill form" has no arrow, so it is not connected. Every line must be "A -> B".',
    ]);
    // Also seen: a typo in a repeated step name splits the flow in two.
    expect(checkSource('flowchart', '(Start) -> Choose UPI\nChose UPI -> Enter PIN\nEnter PIN -> (Done)')[0]).toMatch(
      /can't be reached.*"Chose UPI", "Enter PIN", "\(Done\)"/
    );
    expect(checkSource('mindmap', 'Root\nOther root\n  Child')[0]).toMatch(/exactly one root/);
    expect(checkSource('orgchart', '  Indented root\n    Child')[0]).toMatch(/must not be indented/);
  });

  it('accepts valid ER and UML diagrams', () => {
    expect(checkSource('er', 'Student\n  Roll no (key)\nCourse\n  Id (key)\nStudent == Enrolls -- Course: M:N')).toEqual([]);
    expect(checkSource('class', 'class User\n  - id: int\n  + login(): bool\nAdmin --|> User\nCustomer "1" -- "*" Order: places')).toEqual([]);
    expect(checkSource('class', 'class User {\n+login() bool\n}\nAdmin --|> User')).toEqual([]);
    expect(checkSource('usecase', 'system Shop\nCustomer -> Place order\nPlace order -> Pay: include')).toEqual([]);
    expect(checkSource('sequence', 'actor User\nUser -> App: Log in\nalt ok\n  App --> User: Home\nelse fail\n  App --> User: Error\nend')).toEqual([]);
    expect(checkSource('state', '[*] -> Idle\nIdle -> Busy: start\nBusy -> [*]')).toEqual([]);
  });

  it('reports common ER and UML mistakes', () => {
    expect(checkSource('er', 'Student\n  Name (primary)')).toEqual(
      expect.arrayContaining([expect.stringMatching(/needs relationship lines/), expect.stringMatching(/unknown tag/)])
    );
    expect(checkSource('er', 'A\nB\nA -- R -- B: 1')[0]).toMatch(/one cardinality per connection/);
    expect(checkSource('class', 'class A\nB -> A')[0]).toMatch(/not "->"/);
    expect(checkSource('class', 'class A\nB--|>A')[0]).toMatch(/space on both sides/);
    expect(checkSource('sequence', 'A -> B: hi\nloop forever\n  B -> A: hi')).toEqual(['Every loop, alt or opt block needs a closing "end" line.']);
    expect(checkSource('sequence', 'A -> B: hi\nnote over A: x')[0]).toMatch(/notes are not supported/);
    expect(checkSource('state', 'Idle -> Busy\nBusy -> Idle')[0]).toMatch(/initial state/);
  });
});

describe('normalise', () => {
  it('turns escaped "\\n" sequences from the model into real line breaks', () => {
    // Seen with real Gemini output: the whole diagram arrived on one line.
    expect(normalise('(Start)\\nStart -> Cook\\nCook -> (Eat)')).toBe('(Start)\nStart -> Cook\nCook -> (Eat)');
  });

  it('fixes line endings and tabs but leaves normal text alone', () => {
    expect(normalise('Root\r\n\tChild\n')).toBe('Root\n  Child');
    expect(normalise('A -> B\nB -> C')).toBe('A -> B\nB -> C');
  });
});

describe('generateDiagram', () => {
  it('returns validated output and normalises whitespace', async () => {
    const generate = vi.fn().mockResolvedValue({ ...FLOW, source: `${FLOW.source.replace(/\n/g, '\r\n')}\n\n` });
    const result = await generateDiagram({ prompt: 'login flow' }, generate);
    expect(result).toEqual(FLOW);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('feeds problems back to the model and retries once', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ ...FLOW, source: 'Open app\nLog in' })
      .mockResolvedValueOnce(FLOW);

    await expect(generateDiagram({ prompt: 'login flow' }, generate)).resolves.toEqual(FLOW);
    const retry = generate.mock.calls[1][0];
    expect(retry.messages.at(-1).text).toMatch(/must connect steps with "->"/);
  });

  it('gives up with a friendly error after two bad answers', async () => {
    const generate = vi.fn().mockResolvedValue({ nonsense: true });
    await expect(generateDiagram({ prompt: 'x y z' }, generate)).rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('includes the current diagram when refining', async () => {
    const generate = vi.fn().mockResolvedValue(FLOW);
    await generateDiagram({ prompt: 'add a forgot password step', current: { type: 'flowchart', source: 'A -> B' } }, generate);
    const text = generate.mock.calls[0][0].messages[0].text;
    expect(text).toContain('Current diagram text:\nA -> B');
    expect(text).toContain('Requested change: add a forgot password step');
  });
});

describe('AI routes', () => {
  const originalKey = env.gemini.apiKey;
  const originalGatewayKey = env.aiGateway.apiKey;
  const originalLimit = env.freeAi.limit;
  const setLimit = (limit: number) => ((env.freeAi as { limit: number }).limit = limit);
  let fetchMock: ReturnType<typeof vi.fn>;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    (env.gemini as { apiKey: string }).apiKey = 'test-key';
    (env.aiGateway as { apiKey: string }).apiKey = '';
    fetchMock = vi.fn();
    // Only intercept calls to the AI providers; supertest talks to the app directly.
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
      [env.gemini.baseUrl, env.aiGateway.baseUrl, env.openai.baseUrl].some((base) => String(input).startsWith(base))
        ? fetchMock(input, init)
        : realFetch(input, init)) as typeof fetch;
  });

  afterEach(() => {
    (env.gemini as { apiKey: string }).apiKey = originalKey;
    (env.aiGateway as { apiKey: string }).apiKey = originalGatewayKey;
    setLimit(originalLimit);
    globalThis.fetch = realFetch;
  });

  it('reports whether AI is configured and how many free generations are left', async () => {
    expect((await api().get('/api/ai/status').expect(200)).body).toEqual({
      enabled: true,
      free: { limit: env.freeAi.limit, remaining: env.freeAi.limit, resetsAt: null },
      freeTier: { provider: 'gemini', label: 'Gemini', model: env.gemini.model },
    });
    (env.gemini as { apiKey: string }).apiKey = '';
    expect((await api().get('/api/ai/status').expect(200)).body).toEqual({ enabled: false, free: null, freeTier: null });
  });

  it('returns 503 with setup instructions when no key is set', async () => {
    (env.gemini as { apiKey: string }).apiKey = '';
    const res = await api().post('/api/ai/generate').send({ prompt: 'how tea is made' }).expect(503);
    expect(res.body.error.message).toMatch(/GEMINI_API_KEY/);
    expect(res.body.error.code).toBe('AI_KEY_REQUIRED');
  });

  it('validates the prompt', async () => {
    await api().post('/api/ai/generate').send({ prompt: 'x' }).expect(400);
    await api().post('/api/ai/generate').send({ prompt: 'a'.repeat(601) }).expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls Gemini in JSON mode with the key in a header and returns the diagram', async () => {
    fetchMock.mockResolvedValue(geminiReply(FLOW));
    const res = await api().post('/api/ai/generate').send({ prompt: 'login flow for an app' }).expect(200);

    expect(res.body.diagram).toEqual(FLOW);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/models\/.+:generateContent$/);
    expect(String(url)).not.toContain('test-key');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.contents[0].parts[0].text).toBe('login flow for an app');
  });

  it('retries once when the provider has a temporary server error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"The model is overloaded."}}', { status: 503 })).mockResolvedValueOnce(geminiReply(FLOW));
    const res = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(200);
    expect(res.body.diagram).toEqual(FLOW);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A second failure in a row is reported, not retried forever.
    fetchMock.mockReset().mockResolvedValue(new Response('down', { status: 503 }));
    await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps Gemini rate limits to a friendly 429', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429 }));
    const res = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(429);
    expect(res.body.error.message).toMatch(/too many requests/);
  });

  it('reports blocked prompts', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    await api().post('/api/ai/generate').send({ prompt: 'something blocked' }).expect(400);
  });

  describe('free quota on the server key', () => {
    beforeEach(() => setLimit(2));

    it('counts down and then asks for an own key', async () => {
      fetchMock.mockImplementation(async () => geminiReply(FLOW));
      const first = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(200);
      expect(first.body.free).toMatchObject({ limit: 2, remaining: 1 });
      const second = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(200);
      expect(second.body.free.remaining).toBe(0);

      const res = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(429);
      expect(res.body.error.code).toBe('AI_FREE_LIMIT');
      expect(res.body.error.message).toMatch(/2 free AI generations today/);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect((await api().get('/api/ai/status').expect(200)).body.free).toMatchObject({ remaining: 0, resetsAt: expect.any(String) });
    });

    it('gives a failed generation back', async () => {
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
      await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(502);
      expect((await api().get('/api/ai/status').expect(200)).body.free.remaining).toBe(2);
    });

    it('counts signed-in users separately from guests on the same IP', async () => {
      fetchMock.mockImplementation(async () => geminiReply(FLOW));
      setLimit(1);
      await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(200);
      await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(429);

      const { auth } = await signUp();
      expect((await api().get('/api/ai/status').set(auth).expect(200)).body.free.remaining).toBe(1);
      await api().post('/api/ai/generate').set(auth).send({ prompt: 'login flow' }).expect(200);
      await api().post('/api/ai/generate').set(auth).send({ prompt: 'login flow' }).expect(429);
    });

    it('requires an own key when the free tier is turned off', async () => {
      setLimit(0);
      const res = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(402);
      expect(res.body.error.code).toBe('AI_KEY_REQUIRED');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("with the visitor's own key", () => {
    const own = (provider: string, key = 'my-own-key-123', model?: string) => ({
      'X-AI-Provider': provider,
      'X-AI-Key': key,
      ...(model && { 'X-AI-Model': model }),
    });

    it('calls Gemini with their key and skips the free quota', async () => {
      setLimit(0);
      fetchMock.mockResolvedValue(geminiReply(FLOW));
      const res = await api().post('/api/ai/generate').set(own('gemini', 'my-own-key-123', 'gemini-2.5-pro')).send({ prompt: 'login flow' }).expect(200);

      expect(res.body).toEqual({ diagram: FLOW, usage: { provider: 'gemini', model: 'gemini-2.5-pro', inputTokens: 0, outputTokens: 0 } });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${env.gemini.baseUrl}/models/gemini-2.5-pro:generateContent`);
      expect(init.headers['x-goog-api-key']).toBe('my-own-key-123');
    });

    it('works even when the server has no key', async () => {
      (env.gemini as { apiKey: string }).apiKey = '';
      fetchMock.mockResolvedValue(gatewayReply(FLOW));
      await api().post('/api/ai/generate').set(own('gateway')).send({ prompt: 'login flow' }).expect(200);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer my-own-key-123');
    });

    it('calls OpenAI chat completions with the default model and no temperature', async () => {
      fetchMock.mockResolvedValue(gatewayReply(FLOW));
      await api().post('/api/ai/generate').set(own('openai', 'sk-own-1234567')).send({ prompt: 'login flow' }).expect(200);

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${env.openai.baseUrl}/chat/completions`);
      expect(init.headers.Authorization).toBe('Bearer sk-own-1234567');
      const body = JSON.parse(init.body);
      expect(body.model).toBe(env.openai.model);
      expect(body.temperature).toBeUndefined();
    });

    it('explains key problems without blaming the server', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"Incorrect API key"}}', { status: 401 }));
      let res = await api().post('/api/ai/generate').set(own('openai')).send({ prompt: 'login flow' }).expect(400);
      expect(res.body.error).toEqual({ code: 'AI_KEY_INVALID', message: 'Your OpenAI API key was rejected. Check it and try again.' });

      fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"Model not found"}}', { status: 404 }));
      res = await api().post('/api/ai/generate').set(own('gemini', 'my-own-key-123', 'gemini-9')).send({ prompt: 'login flow' }).expect(400);
      expect(res.body.error.message).toMatch(/couldn't find the model "gemini-9"/);
    });

    it('validates the key headers', async () => {
      await api().post('/api/ai/generate').set(own('anthropic')).send({ prompt: 'login flow' }).expect(400);
      await api().post('/api/ai/generate').set(own('gemini', 'short')).send({ prompt: 'login flow' }).expect(400);
      await api().post('/api/ai/generate').set(own('gemini', 'my-own-key-123', '../../evil')).send({ prompt: 'login flow' }).expect(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('usage dashboard', () => {
    /** Gemini reply that also reports token usage. */
    const withTokens = (payload: unknown, input: number, output: number) =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
          usageMetadata: { promptTokenCount: input, candidatesTokenCount: output, thoughtsTokenCount: 5 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    it('logs each generation with tokens, per source, provider and model', async () => {
      const { auth } = await signUp();
      fetchMock.mockResolvedValueOnce(withTokens(FLOW, 100, 20));
      const free = await api().post('/api/ai/generate').set(auth).send({ prompt: 'login flow for my app' }).expect(200);
      expect(free.body.usage).toEqual({ provider: 'gemini', model: env.gemini.model, inputTokens: 100, outputTokens: 25 });

      fetchMock.mockResolvedValueOnce(gatewayReply(FLOW));
      await api()
        .post('/api/ai/generate')
        .set({ ...auth, 'X-AI-Provider': 'gateway', 'X-AI-Key': 'my-own-key-123' })
        .send({ prompt: 'checkout flow' })
        .expect(200);

      fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"bad key"}}', { status: 401 }));
      await api()
        .post('/api/ai/generate')
        .set({ ...auth, 'X-AI-Provider': 'openai', 'X-AI-Key': 'sk-wrong-1234567' })
        .send({ prompt: 'signup flow' })
        .expect(400);

      const res = await api().get('/api/ai/usage').set(auth).expect(200);
      expect(res.body.signedIn).toBe(true);
      expect(res.body.free).toMatchObject({ limit: env.freeAi.limit, remaining: env.freeAi.limit - 1 });
      expect(res.body.byModel).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: 'free', provider: 'gemini', generations: 1, failed: 0, inputTokens: 100, outputTokens: 25 }),
          expect.objectContaining({ source: 'own', provider: 'gateway', generations: 1, failed: 0 }),
          expect.objectContaining({ source: 'own', provider: 'openai', generations: 1, failed: 1 }),
        ])
      );
      expect(res.body.daily).toEqual([{ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), generations: 3, tokens: 125 }]);
      expect(res.body.recent).toHaveLength(3);
      expect(res.body.recent[0]).toMatchObject({ provider: 'openai', ok: false, errorCode: 'AI_KEY_INVALID', prompt: 'signup flow' });
    });

    it("keeps usage separate per visitor and doesn't store guests' prompts", async () => {
      fetchMock.mockResolvedValue(geminiReply(FLOW));
      await api().post('/api/ai/generate').send({ prompt: 'a guest prompt' }).expect(200);

      const guest = await api().get('/api/ai/usage').expect(200);
      expect(guest.body.signedIn).toBe(false);
      expect(guest.body.recent).toHaveLength(1);
      expect(guest.body.recent[0].prompt).toBeNull();

      const { auth } = await signUp();
      expect((await api().get('/api/ai/usage').set(auth).expect(200)).body.recent).toEqual([]);
    });
  });

  describe('testing an own key', () => {
    it('checks the key and model with a tiny request', async () => {
      fetchMock.mockResolvedValue(gatewayReply({ ok: true }));
      const res = await api()
        .post('/api/ai/test-key')
        .set({ 'X-AI-Provider': 'openai', 'X-AI-Key': 'sk-own-1234567', 'X-AI-Model': 'gpt-4.1-nano' })
        .expect(200);
      expect(res.body).toMatchObject({ ok: true, provider: 'openai', model: 'gpt-4.1-nano', latencyMs: expect.any(Number) });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format.json_schema.schema.properties.ok.type).toBe('boolean');
      // A test is not a generation, so it isn't logged.
      expect((await api().get('/api/ai/usage').expect(200)).body.recent).toEqual([]);
    });

    it('reports a rejected key and needs a key to test', async () => {
      fetchMock.mockResolvedValue(new Response('{"error":{"message":"API key not valid"}}', { status: 400 }));
      const res = await api().post('/api/ai/test-key').set({ 'X-AI-Provider': 'gemini', 'X-AI-Key': 'AQ.not-a-real-key' }).expect(400);
      expect(res.body.error.code).toBe('AI_KEY_INVALID');
      await api().post('/api/ai/test-key').expect(400);
    });
  });

  describe('via Vercel AI Gateway', () => {
    beforeEach(() => {
      (env.aiGateway as { apiKey: string }).apiKey = 'gw-key';
    });

    it('is preferred over Gemini and enables AI on its own', async () => {
      (env.gemini as { apiKey: string }).apiKey = '';
      expect((await api().get('/api/ai/status').expect(200)).body).toMatchObject({ enabled: true });
    });

    it('calls chat completions with a strict JSON schema and returns the diagram', async () => {
      fetchMock.mockResolvedValue(gatewayReply(FLOW));
      const res = await api().post('/api/ai/generate').send({ prompt: 'login flow for an app' }).expect(200);

      expect(res.body.diagram).toEqual(FLOW);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${env.aiGateway.baseUrl}/chat/completions`);
      expect(init.headers.Authorization).toBe('Bearer gw-key');
      const body = JSON.parse(init.body);
      expect(body.model).toBe(env.aiGateway.model);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1]).toEqual({ role: 'user', content: 'login flow for an app' });
      const { schema } = body.response_format.json_schema;
      expect(schema.type).toBe('object');
      expect(schema.properties.source.type).toBe('string');
      expect(schema.additionalProperties).toBe(false);
      expect(schema.propertyOrdering).toBeUndefined();
    });

    it('sends the retry conversation with assistant turns', async () => {
      fetchMock
        .mockResolvedValueOnce(gatewayReply({ ...FLOW, source: 'just one lonely step' }))
        .mockResolvedValueOnce(gatewayReply(FLOW));
      await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(200);
      const roles = JSON.parse(fetchMock.mock.calls[1][1].body).messages.map((m: { role: string }) => m.role);
      expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    });

    it('maps gateway errors to friendly messages', async () => {
      fetchMock.mockResolvedValueOnce(new Response('limit', { status: 429 }));
      await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(429);
      fetchMock.mockResolvedValueOnce(new Response('bad key', { status: 401 }));
      const res = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(503);
      expect(res.body.error.message).toMatch(/AI_GATEWAY_API_KEY/);
    });
  });
});
