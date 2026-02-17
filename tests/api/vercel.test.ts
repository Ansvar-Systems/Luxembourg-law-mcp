import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import healthHandler from '../../api/health.js';
import mcpHandler from '../../api/mcp.js';

interface MockReq {
  method?: string;
  url?: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  headersSent: boolean;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockRes;
  json: (value: unknown) => MockRes;
  end: (value?: unknown) => MockRes;
}

function createRequest(input: Partial<MockReq>): MockReq {
  return {
    method: input.method ?? 'GET',
    url: input.url ?? '/',
    headers: { host: 'localhost', ...(input.headers ?? {}) },
    body: input.body,
  };
}

function createResponse(): MockRes {
  const response: MockRes = {
    statusCode: 200,
    headers: {},
    body: undefined,
    headersSent: false,
    setHeader(name, value) {
      response.headers[name] = value;
    },
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(value) {
      response.body = value;
      response.headersSent = true;
      return response;
    },
    end(value) {
      response.body = value;
      response.headersSent = true;
      return response;
    },
  };

  return response;
}

describe('Vercel deployment handlers', () => {
  it('serves health payload from /health', () => {
    const req = createRequest({ url: '/health' });
    const res = createResponse();

    healthHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      server: 'luxembourg-legal-citations',
      tier: 'free',
    });
  });

  it('serves version payload from /version', () => {
    const req = createRequest({ url: '/version' });
    const res = createResponse();

    healthHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: 'luxembourg-legal-citations',
      version: '1.0.0',
      source_schema_version: '2',
    });
  });

  it('serves version payload from rewrite query', () => {
    const req = createRequest({ url: '/api/health?version' });
    const res = createResponse();

    healthHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: 'luxembourg-legal-citations',
      transport: ['stdio', 'streamable-http'],
    });
  });

  it('serves MCP transport metadata on GET /mcp', async () => {
    const req = createRequest({ method: 'GET', url: '/mcp' });
    const res = createResponse();

    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: 'luxembourg-legal-citations',
      version: '1.0.0',
      protocol: 'mcp-streamable-http',
    });
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('handles MCP preflight OPTIONS', async () => {
    const req = createRequest({ method: 'OPTIONS', url: '/mcp' });
    const res = createResponse();

    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

describe('vercel.json deployment config', () => {
  it('includes required rewrites and bundled database', () => {
    const configPath = join(process.cwd(), 'vercel.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      rewrites: Array<{ source: string; destination: string }>;
      functions: Record<string, { includeFiles?: string }>;
    };

    expect(config.rewrites).toEqual(
      expect.arrayContaining([
        { source: '/mcp', destination: '/api/mcp' },
        { source: '/health', destination: '/api/health' },
        { source: '/version', destination: '/api/health?version' },
      ]),
    );

    const includeFiles = config.functions['api/mcp.ts']?.includeFiles ?? '';
    expect(includeFiles).toContain('data/database.db');
  });
});
