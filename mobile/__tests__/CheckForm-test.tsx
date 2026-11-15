import { render, screen, userEvent } from '@testing-library/react-native';
import CheckForm from '../src/components/CheckForm';
import * as storage from '../src/services/storage';
import { AppProviders, CAUTION_RESULT, mockFetch } from '../test-utils/helpers';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));

async function renderForm(onResult = jest.fn(), initialType?: 'MESSAGE' | 'URL' | 'PHONE') {
  await render(<CheckForm onResult={onResult} initialType={initialType} />, { wrapper: AppProviders });
  return onResult;
}

test('switching the check type changes the form', async () => {
  const user = userEvent.setup();
  await renderForm();
  expect(screen.getByText('Check a Message')).toBeOnTheScreen();

  await user.press(screen.getByRole('tab', { name: 'URL' }));
  expect(screen.getByRole('tab', { name: 'URL' })).toBeSelected();
  expect(screen.getByText('Check a URL')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Check URL' })).toBeOnTheScreen();

  await user.press(screen.getByRole('tab', { name: 'Phone Number' }));
  expect(screen.getByRole('button', { name: 'Check Number' })).toBeOnTheScreen();
});

test('validation runs before anything is sent', async () => {
  const user = userEvent.setup();
  const fetchMock = mockFetch();
  await renderForm(jest.fn(), 'URL');

  await user.press(screen.getByRole('button', { name: 'Check URL' }));
  expect(screen.getByText('Please enter a URL.')).toBeOnTheScreen();

  await user.type(screen.getByLabelText('Link to check'), 'not a url');
  await user.press(screen.getByRole('button', { name: 'Check URL' }));
  expect(screen.getByText('Enter a valid URL, for example https://example.com.')).toBeOnTheScreen();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('sends the message to the backend and passes the result on', async () => {
  const user = userEvent.setup();
  const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
  const onResult = await renderForm();

  await user.type(screen.getByLabelText('Message to check'), 'Send your OTP within 30 minutes');
  await user.press(screen.getByRole('button', { name: 'Check Message' }));

  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: 'Send your OTP within 30 minutes' });
  expect(onResult).toHaveBeenCalledWith('MESSAGE', 'Send your OTP within 30 minutes', CAUTION_RESULT);
});

test('shows a loading state while the check runs', async () => {
  const user = userEvent.setup();
  let finish: (value: unknown) => void = () => {};
  globalThis.fetch = jest.fn(() => new Promise((resolve) => (finish = resolve))) as unknown as typeof fetch;
  await renderForm();

  await user.type(screen.getByLabelText('Message to check'), 'hello');
  await user.press(screen.getByRole('button', { name: 'Check Message' }));

  expect(await screen.findByText('Checking...')).toBeOnTheScreen();
  expect(screen.getByText('Reviewing the submitted content.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Checking...' })).toBeBusy();
  finish({ ok: true, status: 200, json: async () => CAUTION_RESULT });
  expect(await screen.findByRole('button', { name: 'Check Message' })).toBeOnTheScreen();
});

test('a network failure gets its own message, not a result', async () => {
  const user = userEvent.setup();
  mockFetch(new TypeError('Network request failed'));
  const onResult = await renderForm();

  await user.type(screen.getByLabelText('Message to check'), 'hello');
  await user.press(screen.getByRole('button', { name: 'Check Message' }));

  expect(await screen.findByText('Unable to connect to Scam Hunter.')).toBeOnTheScreen();
  expect(screen.getByText('This does not mean the content is safe.')).toBeOnTheScreen();
  expect(onResult).not.toHaveBeenCalled();
});

test('backend validation errors appear next to the input', async () => {
  const user = userEvent.setup();
  mockFetch({ status: 400, body: { errors: { phone_number: ['Enter a valid phone number, for example +250 788 123 456.'] } } });
  await renderForm(jest.fn(), 'PHONE');

  await user.type(screen.getByLabelText('Phone number to check'), '+250 788 12');
  await user.press(screen.getByRole('button', { name: 'Check Number' }));
  expect(await screen.findByText('Enter a valid phone number, for example +250 788 123 456.')).toBeOnTheScreen();
});

test('checked content is never written to storage', async () => {
  const user = userEvent.setup();
  mockFetch({ status: 200, body: CAUTION_RESULT });
  await renderForm();

  await user.type(screen.getByLabelText('Message to check'), 'PRIVATE MESSAGE send your OTP');
  await user.press(screen.getByRole('button', { name: 'Check Message' }));

  const written = (storage.setItem as jest.Mock).mock.calls.map((call) => call.join(' ')).join(' ');
  expect(written).not.toContain('PRIVATE MESSAGE');
});
