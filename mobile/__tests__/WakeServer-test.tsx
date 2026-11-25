import { AppState, type AppStateStatus } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { setAuthToken, wakeServer } from '../src/services/api';
import { useWakeServer } from '../src/utils/useWakeServer';
import { mockFetch } from '../test-utils/helpers';

afterEach(() => {
  jest.restoreAllMocks();
  setAuthToken(null);
});

test('wakeServer calls the light health address with a plain GET', async () => {
  const fetchMock = mockFetch({ status: 200, body: { status: 'ok' } });
  await wakeServer();

  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/api\/health\/$/);
  expect(options.method).toBe('GET');
});

test('wakeServer never throws, even with no connection', async () => {
  mockFetch(new TypeError('Network request failed'));
  await expect(wakeServer()).resolves.toBeUndefined();
});

test('the app wakes the server on start and again when the user comes back to it', async () => {
  const fetchMock = mockFetch({ status: 200, body: { status: 'ok' } }, { status: 200, body: { status: 'ok' } });
  // Catch the listener the hook gives to AppState, so the test can play "user left / came back".
  let onChange: (state: AppStateStatus) => void = () => {};
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onChange = listener as (state: AppStateStatus) => void;
    return { remove };
  });

  const { unmount } = await renderHook(() => useWakeServer());
  expect(fetchMock).toHaveBeenCalledTimes(1);

  onChange('background');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  onChange('active');
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await unmount();
  expect(remove).toHaveBeenCalled();
});
