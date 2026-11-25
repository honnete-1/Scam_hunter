import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import CheckForm from '../src/components/CheckForm';
import { SLOW_SERVER_NOTICE, useSlowNotice } from '../src/utils/useSlowNotice';
import { AppProviders, CAUTION_RESULT } from '../test-utils/helpers';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));

afterEach(() => jest.useRealTimers());

test('the notice turns on only after loading has lasted 5 seconds, and off when loading stops', async () => {
  jest.useFakeTimers();
  const { result, rerender } = await renderHook(({ loading }: { loading: boolean }) => useSlowNotice(loading), {
    initialProps: { loading: true },
  });
  await act(async () => jest.advanceTimersByTime(4900));
  expect(result.current).toBe(false);
  await act(async () => jest.advanceTimersByTime(200));
  expect(result.current).toBe(true);

  await rerender({ loading: false });
  expect(result.current).toBe(false);
});

test('a slow check says the server is waking up, then shows the result', async () => {
  // A check that only answers when the test says so, like a sleeping server.
  let answer: (value: unknown) => void = () => {};
  globalThis.fetch = jest.fn(() => new Promise((resolve) => (answer = resolve))) as unknown as typeof fetch;
  const onResult = jest.fn();
  await render(<CheckForm onResult={onResult} />, { wrapper: AppProviders });

  await act(async () => fireEvent.changeText(screen.getByLabelText('Message to check'), 'Send money now'));
  fireEvent.press(screen.getByRole('button', { name: 'Check Message' }));
  expect(await screen.findByText('Reviewing the submitted content.')).toBeOnTheScreen();

  // Real clock: the notice appears after 5 seconds of waiting.
  expect(await screen.findByText(SLOW_SERVER_NOTICE, {}, { timeout: 8000 })).toBeOnTheScreen();

  await act(async () => answer({ ok: true, status: 200, json: async () => CAUTION_RESULT }));
  expect(onResult).toHaveBeenCalledWith('MESSAGE', 'Send money now', CAUTION_RESULT);
  expect(screen.queryByText(SLOW_SERVER_NOTICE)).toBeNull();
});
