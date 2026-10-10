import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSource } from '../src/ai/checkSource.js';
import { generateDiagram, normalise } from '../src/ai/diagramGenerator.js';
import { env } from '../src/config/env.js';
import { api } from './helpers.js';

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
  let fetchMock: ReturnType<typeof vi.fn>;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    (env.gemini as { apiKey: string }).apiKey = 'test-key';
    (env.aiGateway as { apiKey: string }).apiKey = '';
    fetchMock = vi.fn();
    // Only intercept calls to the AI providers; supertest talks to the app directly.
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
      String(input).startsWith(env.gemini.baseUrl) || String(input).startsWith(env.aiGateway.baseUrl)
        ? fetchMock(input, init)
        : realFetch(input, init)) as typeof fetch;
  });

  afterEach(() => {
    (env.gemini as { apiKey: string }).apiKey = originalKey;
    (env.aiGateway as { apiKey: string }).apiKey = originalGatewayKey;
    globalThis.fetch = realFetch;
  });

  it('reports whether AI is configured', async () => {
    expect((await api().get('/api/ai/status').expect(200)).body).toEqual({ enabled: true });
    (env.gemini as { apiKey: string }).apiKey = '';
    expect((await api().get('/api/ai/status').expect(200)).body).toEqual({ enabled: false });
  });

  it('returns 503 with setup instructions when no key is set', async () => {
    (env.gemini as { apiKey: string }).apiKey = '';
    const res = await api().post('/api/ai/generate').send({ prompt: 'how tea is made' }).expect(503);
    expect(res.body.error.message).toMatch(/GEMINI_API_KEY/);
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

  it('maps Gemini rate limits to a friendly 429', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429 }));
    const res = await api().post('/api/ai/generate').send({ prompt: 'login flow' }).expect(429);
    expect(res.body.error.message).toMatch(/too many requests/);
  });

  it('reports blocked prompts', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    await api().post('/api/ai/generate').send({ prompt: 'something blocked' }).expect(400);
  });

  describe('via Vercel AI Gateway', () => {
    beforeEach(() => {
      (env.aiGateway as { apiKey: string }).apiKey = 'gw-key';
    });

    it('is preferred over Gemini and enables AI on its own', async () => {
      (env.gemini as { apiKey: string }).apiKey = '';
      expect((await api().get('/api/ai/status').expect(200)).body).toEqual({ enabled: true });
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
