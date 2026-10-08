import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationDirectory } from '../infrastructure/convai/conversation-directory.service';

test('finds identity beyond the first thread and message pages, including an empty terminal page', async () => {
  const originalFetch = global.fetch;
  const urls: string[] = [];
  global.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    urls.push(url.pathname + url.search);
    let body: unknown;
    if (url.pathname.endsWith('/threads')) {
      const after = url.searchParams.get('after');
      body = !after
        ? { results: [{ id: 'old', latestMessageTimestamp: '2020-01-01T00:00:00Z' }], paging: { next: { after: 'page2%3D' } } }
        : after === 'page2='
          ? { results: [{ id: 'current', latestMessageTimestamp: new Date().toISOString() }], paging: { next: { after: 'end%3D' } } }
          : { results: [], paging: { next: { after: 'end%3D' } } };
    } else if (url.pathname.endsWith('/current/messages')) {
      body = !url.searchParams.has('after')
        ? { results: [{ type: 'MESSAGE', text: 'Hola', senders: [{ deliveryIdentifier: { type: 'HS_PHONE_NUMBER', value: '+593999999999' } }] }], paging: { next: { after: 'messages2' } } }
        : { results: [{ type: 'MESSAGE', text: 'Mi cédula es 0912345678 y mi correo es test@example.com' }] };
    } else if (url.pathname.endsWith('/current')) {
      body = { associatedContactId: 'contact-test', latestMessageTimestamp: new Date().toISOString() };
    } else throw new Error('Unexpected request: ' + url.pathname);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const identity = await new ConversationDirectory().findContactByText('0912345678', 'test@example.com');
    assert.equal(identity?.threadId, 'current');
    assert.equal(identity?.phoneE164, '+593999999999');
    assert.equal(identity?.contactId, 'contact-test');
    assert.equal(urls.length, 6);
    assert.ok(!urls.some(url => url.includes('/old/')));
    assert.ok(urls.some(url => url.includes('after=page2%3D')));
    assert.ok(!urls.some(url => url.includes('%253D')));
  } finally { global.fetch = originalFetch; }
});
