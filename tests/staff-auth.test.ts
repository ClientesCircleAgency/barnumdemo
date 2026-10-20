import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the actual Deno handler with only the network/runtime boundaries mocked.
function loadHandler(name: string, verified: boolean) {
  let handler!: (request: Request) => Promise<Response>;
  const getUser = vi.fn().mockResolvedValue(verified
    ? { data: { user: { id: 'verified-user' } }, error: null }
    : { data: { user: null }, error: new Error('Invalid signature') });
  const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
  const admin = { getUserById: vi.fn().mockResolvedValue({ data: { user: { id: 'claimed-admin' } }, error: null }) };
  const client = { auth: { getUser, admin }, rpc, from: vi.fn() };
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireMock = (url: string) => url.includes('supabase-js')
    ? { createClient: () => client }
    : { serve: (fn: typeof handler) => { handler = fn; } };
  new Function('require', 'exports', 'Deno', compiled)(requireMock, {}, { env: { get: () => 'test-only' } });
  return { handler, getUser, rpc, client };
}

describe.each(['invite-collaborator', 'list-collaborators', 'update-collaborator', 'delete-collaborator'])('%s authentication', name => {
  const forged = `e30.${Buffer.from(JSON.stringify({ sub: 'claimed-admin', exp: 9999999999 })).toString('base64url')}.forged`;
  it('rejects a forged identity before checking roles or accessing tables', async () => {
    const { handler, rpc, client } = loadHandler(name, false);
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { 'x-user-token': forged }, body: '{}' }));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });
  it('authorizes the verified identity, not the untrusted token payload', async () => {
    const { handler, getUser, rpc } = loadHandler(name, true);
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { 'x-user-token': forged }, body: '{}' }));
    expect(response.status).toBe(403);
    expect(getUser).toHaveBeenCalledWith(forged);
    expect(rpc).toHaveBeenCalledWith('has_role', expect.objectContaining({ _user_id: 'verified-user' }));
  });
  it('rejects a missing user token', async () => {
    const { handler, getUser } = loadHandler(name, false);
    expect((await handler(new Request('https://example.test', { method: 'POST' }))).status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });
});
