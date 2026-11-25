import { checkContent, setAuthToken, submitReport } from '../src/services/api';
import { failureLabel } from '../src/content/labels';
import { CAUTION_RESULT, UNAVAILABLE_RESULT, mockFetch } from '../test-utils/helpers';

afterEach(() => setAuthToken(null));

describe('checkContent', () => {
  test('posts to the real endpoint with the backend field name', async () => {
    const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
    const outcome = await checkContent('PHONE', '+250 788 123 456');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/check\/phone\/$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ phone_number: '+250 788 123 456' });
    expect(outcome).toEqual({ kind: 'result', result: CAUTION_RESULT });
  });

  test('treats CHECK_UNAVAILABLE (HTTP 503) as a result to show', async () => {
    mockFetch({ status: 503, body: UNAVAILABLE_RESULT });
    expect(await checkContent('URL', 'https://example.com')).toEqual({ kind: 'result', result: UNAVAILABLE_RESULT });
  });

  test('returns the backend validation message for the field', async () => {
    mockFetch({ status: 400, body: { status: 'INVALID_INPUT', concern_level: null, errors: { url: ['Enter a valid URL, for example https://example.com.'] } } });
    expect(await checkContent('URL', 'nope')).toEqual({ kind: 'fieldError', message: 'Enter a valid URL, for example https://example.com.' });
  });

  test('keeps a network failure separate from CHECK_UNAVAILABLE', async () => {
    mockFetch(new TypeError('Network request failed'));
    expect(await checkContent('MESSAGE', 'hello')).toEqual({ kind: 'network' });
  });

  test('says to wait when too many checks were sent (HTTP 429)', async () => {
    mockFetch({ status: 429, body: { detail: 'Too many requests. Please wait 42 seconds and try again.' } });
    const outcome = await checkContent('MESSAGE', 'hello');
    expect(outcome).toEqual({ kind: 'rateLimited' });
    expect(failureLabel('rateLimited').title).toBe('Too many requests.');
  });

  test('never passes server error pages through', async () => {
    mockFetch({ status: 500 });
    expect(await checkContent('MESSAGE', 'hello')).toEqual({ kind: 'server' });
  });

  test('sends the login token when there is one', async () => {
    setAuthToken('abc123');
    const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
    await checkContent('MESSAGE', 'hello');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Token abc123');
  });
});

test('submitReport uses the backend report fields', async () => {
  const fetchMock = mockFetch({ status: 201, body: { id: 1, status: 'PENDING' } });
  await submitReport({ reportType: 'URL', content: 'http://bad.example', details: 'From SMS' });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    report_type: 'URL',
    content: 'http://bad.example',
    details: 'From SMS',
    review_mode: 'MODERATED',
  });
});
