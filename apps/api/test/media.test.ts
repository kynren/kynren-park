import { test } from 'node:test';
import assert from 'node:assert/strict';
// The compiled code: run `nest build` first (the npm script does).
import { hostEmbedded, mediaId, mediaUrl, parseDataUrl, parseRange, MEDIA_ID } from '../dist/media/media.logic.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;

test('a picture sent as a data URL is read back as the same bytes, and other kinds of data are left alone', () => {
  const parsed = parseDataUrl(dataUrl('image/png', PNG))!;
  assert.equal(parsed.mime, 'image/png');
  assert.deepEqual(parsed.bytes, PNG);
  assert.equal(parseDataUrl(dataUrl('text/html', Buffer.from('<script>alert(1)</script>'))), null, 'not a picture or clip');
  assert.equal(parseDataUrl(dataUrl('application/pdf', PNG)), null);
  assert.equal(parseDataUrl('data:image/png;base64,'), null, 'empty');
  assert.equal(parseDataUrl('https://example.com/a.png'), null);
  assert.equal(parseDataUrl('data:image/png,not-base64'), null);
});

test('the id of a file is its hash: the same bytes always, different bytes never, and it is safe to put in a path', () => {
  assert.equal(mediaId(PNG), mediaId(Buffer.from(PNG)));
  assert.notEqual(mediaId(PNG), mediaId(Buffer.concat([PNG, Buffer.from([0])])));
  assert.match(mediaId(PNG), MEDIA_ID);
  assert.doesNotMatch('../../etc/passwd', MEDIA_ID);
  assert.equal(mediaUrl('https://app-park.kynren.com/', 'abc'), 'https://app-park.kynren.com/api/media/abc');
});

test('every embedded picture anywhere in a value is swapped for its URL, and nothing else is touched', async () => {
  const hosted: string[] = [];
  const host = async (f: { mime: string; bytes: Buffer }) => {
    hosted.push(f.mime);
    return `https://x/api/media/${mediaId(f.bytes)}`;
  };
  const pic = dataUrl('image/png', PNG);
  const body = {
    name: 'Park map',
    imageUrl: pic,
    home: { sections: [{ id: 'a', heroMediaUrl: pic, keep: 'data:text/plain;base64,aGk=' }, { n: 3, ok: true, none: null }] },
    images: [pic, 'https://already/hosted.png', 7],
    when: new Date(0),
  };
  const [out, changed] = (await hostEmbedded(body, host)) as [typeof body, boolean];
  const url = `https://x/api/media/${mediaId(PNG)}`;
  assert.equal(changed, true);
  assert.equal(out.imageUrl, url);
  assert.equal((out.home.sections[0] as any).heroMediaUrl, url);
  assert.equal((out.home.sections[0] as any).keep, 'data:text/plain;base64,aGk=', 'not a picture: left as it was');
  assert.deepEqual(out.images, [url, 'https://already/hosted.png', 7]);
  assert.equal(out.name, 'Park map');
  assert.ok(out.when instanceof Date, 'dates and other objects pass through');
  assert.equal(hosted.length, 3);
  assert.equal(body.imageUrl, pic, 'the original is not changed');
});

test('a value with nothing to host comes back as the very same object', async () => {
  const body = { a: 1, b: ['x', { c: 'y' }] };
  const [out, changed] = await hostEmbedded(body, async () => 'never');
  assert.equal(changed, false);
  assert.equal(out, body);
});

test('a byte range is read as a player asks for it', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=500-5000', 1000), { start: 500, end: 999 }, 'cut to the end of the file');
  assert.equal(parseRange('bytes=2000-3000', 1000), null, 'past the end');
  assert.equal(parseRange('bytes=5-1', 1000), null);
  assert.equal(parseRange('bytes=0-1,5-9', 1000), null, 'several ranges: serve the whole file instead');
  assert.equal(parseRange(undefined, 1000), null);
});
