import { render, screen, userEvent } from '@testing-library/react-native';
import AuthForm from '../src/components/AuthForm';
import ReportForm from '../src/components/ReportForm';
import * as storage from '../src/services/storage';
import { AppProviders, mockFetch } from '../test-utils/helpers';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));

const USER = { id: 1, username: 'tester', email: '', is_staff: false };

describe('ReportForm', () => {
  test('needs the acknowledgement, then submits and hands back the pending report', async () => {
    const user = userEvent.setup();
    const report = { id: 7, report_type: 'URL', content: 'http://bad.example', details: 'From SMS', status: 'PENDING' };
    const fetchMock = mockFetch({ status: 201, body: report });
    const onSubmitted = jest.fn();
    await render(<ReportForm draft={{ type: 'URL', content: 'http://bad.example' }} onSubmitted={onSubmitted} />, {
      wrapper: AppProviders,
    });

    // The checked content is filled in from the in-memory draft.
    expect(screen.getByLabelText('Content')).toHaveDisplayValue('http://bad.example');
    expect(screen.getByRole('tab', { name: 'URL' })).toBeSelected();

    await user.type(screen.getByLabelText('Additional details'), 'From SMS');
    await user.press(screen.getByRole('button', { name: 'Submit Report' }));
    expect(screen.getByText('Please confirm that you understand the report will be stored.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();

    const checkbox = screen.getByRole('checkbox');
    await user.press(checkbox);
    expect(checkbox).toBeChecked();
    await user.press(screen.getByRole('button', { name: 'Submit Report' }));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ report_type: 'URL', content: 'http://bad.example', details: 'From SMS' });
    expect(onSubmitted).toHaveBeenCalledWith(report);
  });
});

describe('AuthForm', () => {
  test('logging in stores the token in secure storage', async () => {
    const user = userEvent.setup();
    mockFetch({ status: 200, body: { token: 'new-token', user: USER } });
    const onSuccess = jest.fn();
    await render(<AuthForm mode="login" onSuccess={onSuccess} onSwitchMode={jest.fn()} />, { wrapper: AppProviders });

    await user.type(screen.getByLabelText('Username'), 'tester');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.press(screen.getByRole('button', { name: 'Log In' }));

    expect(onSuccess).toHaveBeenCalled();
    expect(storage.setItem).toHaveBeenCalledWith('scamHunterToken', 'new-token');
  });

  test('a wrong password shows a clear message', async () => {
    const user = userEvent.setup();
    mockFetch({ status: 401, body: { detail: 'Invalid username or password.' } });
    const onSuccess = jest.fn();
    await render(<AuthForm mode="login" onSuccess={onSuccess} onSwitchMode={jest.fn()} />, { wrapper: AppProviders });

    await user.type(screen.getByLabelText('Username'), 'tester');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.press(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText("That username and password don't match. Please try again.")).toBeOnTheScreen();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('sign up checks the two passwords match before sending', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    await render(<AuthForm mode="signup" onSuccess={jest.fn()} onSwitchMode={jest.fn()} />, { wrapper: AppProviders });

    await user.type(screen.getByLabelText('Username'), 'newuser');
    await user.type(screen.getByLabelText('Password'), 'Str0ng-pass!');
    await user.type(screen.getByLabelText('Confirm password'), 'Str0ng-pass?');
    await user.press(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText("The passwords don't match.")).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('backend field errors are shown next to the field', async () => {
    const user = userEvent.setup();
    mockFetch({ status: 400, body: { password: ['This password is too short. It must contain at least 8 characters.'] } });
    await render(<AuthForm mode="signup" onSuccess={jest.fn()} onSwitchMode={jest.fn()} />, { wrapper: AppProviders });

    await user.type(screen.getByLabelText('Username'), 'newuser');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'short');
    await user.press(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('This password is too short. It must contain at least 8 characters.')).toBeOnTheScreen();
  });
});
