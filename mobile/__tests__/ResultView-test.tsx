import { render, screen, userEvent } from '@testing-library/react-native';
import ResultView from '../src/components/ResultView';
import { lightPalette } from '../src/theme/colors';
import type { AnalysisResult } from '../src/types/api';
import { AppProviders, CAUTION_RESULT, UNAVAILABLE_RESULT } from '../test-utils/helpers';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));

async function renderResult(result: AnalysisResult, checkType: 'MESSAGE' | 'URL' | 'PHONE' = 'MESSAGE') {
  const handlers = { onReport: jest.fn(), onCheckAnother: jest.fn(), onTryAgain: jest.fn() };
  await render(<ResultView result={result} checkType={checkType} {...handlers} />, { wrapper: AppProviders });
  return handlers;
}

const indicator = (type: string) => ({ type, evidence: `${type} evidence`, explanation: `${type} explanation` });

test('caution shows findings with friendly labels and the safer action', async () => {
  await renderResult(CAUTION_RESULT);
  expect(screen.getByText('Caution')).toBeOnTheScreen();
  expect(screen.getByText('2 warning signs found')).toBeOnTheScreen();
  expect(screen.getByText('Urgent pressure')).toBeOnTheScreen();
  expect(screen.getByText('Sensitive information request')).toBeOnTheScreen();
  expect(screen.getByText('“within 30 minutes”')).toBeOnTheScreen();
  expect(screen.getByText(CAUTION_RESULT.safer_action)).toBeOnTheScreen();
  // Raw backend values never reach the screen.
  expect(screen.queryByText(/sensitive_information_request|CAUTION$/)).not.toBeOnTheScreen();
});

test('high concern uses cautious wording', async () => {
  await renderResult({
    ...CAUTION_RESULT,
    concern_level: 'HIGH_CONCERN',
    indicators: ['urgency', 'payment_request', 'reward_claim'].map(indicator),
  });
  expect(screen.getByText('High Concern')).toBeOnTheScreen();
  expect(screen.getByText('This content contains several concerning signs.')).toBeOnTheScreen();
  expect(screen.queryByText(/definitely|is a scam/i)).not.toBeOnTheScreen();
});

test('an approved phone record is explained', async () => {
  await renderResult({ ...CAUTION_RESULT, concern_level: 'HIGH_CONCERN', indicators: [], reference_match: true }, 'PHONE');
  expect(screen.getByText('This phone number matches a record moderators approved as suspicious.')).toBeOnTheScreen();
  expect(screen.getByText('Matches an approved suspicious record')).toBeOnTheScreen();
});

test('no known warning signs is never called safe', async () => {
  await renderResult({ ...CAUTION_RESULT, concern_level: 'NO_KNOWN_WARNING_SIGNS', indicators: [], safer_action: 'Continue to use caution.' });
  expect(screen.getByText('No Known Warning Signs')).toBeOnTheScreen();
  expect(screen.getByText('No configured warning indicators or approved suspicious records were found.')).toBeOnTheScreen();
  expect(screen.getByText('Continue to use caution with unexpected requests.')).toBeOnTheScreen();
  expect(screen.queryByText(/^safe$|verified safe/i)).not.toBeOnTheScreen();
});

test('check unavailable is its own neutral state', async () => {
  const handlers = await renderResult(UNAVAILABLE_RESULT);
  expect(screen.getByText('Check Could Not Be Completed')).toBeOnTheScreen();
  expect(screen.getByText('This does not mean the content is safe.')).toBeOnTheScreen();
  expect(screen.queryByText('No Known Warning Signs')).not.toBeOnTheScreen();
  // The badge uses the neutral colour, never the green "clear" one.
  expect(screen.getByText('Check Could Not Be Completed')).toHaveStyle({ color: lightPalette.status.unavailable.text });

  await userEvent.setup().press(screen.getByRole('button', { name: 'Try Again' }));
  expect(handlers.onTryAgain).toHaveBeenCalled();
});

test('details are hidden until the user asks for them', async () => {
  const user = userEvent.setup();
  await renderResult(CAUTION_RESULT);
  expect(screen.queryByText('The message pressures you to act quickly.')).not.toBeOnTheScreen();

  const toggle = screen.getByRole('button', { name: 'See more details' });
  expect(toggle).toBeCollapsed();
  await user.press(toggle);
  expect(screen.getByText('The message pressures you to act quickly.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Hide details' })).toBeExpanded();
});

test('reporting is a separate action the user chooses', async () => {
  const handlers = await renderResult(CAUTION_RESULT);
  expect(handlers.onReport).not.toHaveBeenCalled();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Report This' }));
  expect(handlers.onReport).toHaveBeenCalledTimes(1);
});

test('lists the checks behind the result, including ones that could not run', async () => {
  const user = userEvent.setup();
  await renderResult({
    ...CAUTION_RESULT,
    checks: [
      { id: 'rules', label: 'Scam-pattern rules', status: 'COMPLETED', finding: true, detail: '' },
      { id: 'ai', label: 'AI analysis', status: 'UNAVAILABLE', finding: false, detail: '' },
    ],
  });
  await user.press(screen.getByRole('button', { name: 'How we checked (2 checks)' }));
  expect(screen.getByText('Found a warning')).toBeOnTheScreen();
  expect(screen.getByText("Couldn't run")).toBeOnTheScreen();
});

test('shows the community reputation of a phone number', async () => {
  await renderResult(
    { ...CAUTION_RESULT, concern_level: 'HIGH_CONCERN', indicators: [], reference_match: true, reputation: { approved_reports: 2, first_reported: '2026-11-13' } },
    'PHONE'
  );
  expect(screen.getByText(/Reported by 2 community members, first on 2026-11-13/)).toBeOnTheScreen();
});

test('shows the AI scam-likelihood score when the AI ran', async () => {
  await renderResult({ ...CAUTION_RESULT, ai_score: 90 });
  expect(screen.getByText('90%')).toBeOnTheScreen();
  expect(screen.getByRole('progressbar', { name: 'AI scam-likelihood score' })).toBeOnTheScreen();
});

test('shows no score when the AI did not run', async () => {
  await renderResult({ ...CAUTION_RESULT, ai_score: null });
  expect(screen.queryByText('AI scam-likelihood score')).not.toBeOnTheScreen();
});

test('a message in Kinyarwanda is explained in Kinyarwanda, with English one tap away', async () => {
  const user = userEvent.setup();
  await renderResult({
    ...CAUTION_RESULT,
    headline: 'Witondere: hari ibimenyetso by\'uburiganya',
    explanation: 'Ubu butumwa burasaba amafaranga.',
    safer_action: 'Ntiwohereze amafaranga.',
    language: 'rw',
    english: { headline: 'Be careful: warning signs found', explanation: 'This message asks for money.', safer_action: 'Do not send money.' },
  });

  expect(screen.getByText('In Kinyarwanda, the language of the message')).toBeOnTheScreen();
  expect(screen.getByText('Ubu butumwa burasaba amafaranga.')).toBeOnTheScreen();
  expect(screen.getByText('Ntiwohereze amafaranga.')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Show in English' }));
  expect(screen.getByText('This message asks for money.')).toBeOnTheScreen();
  expect(screen.getByText('Do not send money.')).toBeOnTheScreen();
});
