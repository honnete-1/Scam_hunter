import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NETWORK_ERROR, SERVER_ERROR } from '../content/labels';
import { checkContent } from '../services/api';
import { spacing } from '../theme/spacing';
import type { AnalysisResult, CheckType } from '../types/api';
import AppText from './AppText';
import { PrimaryButton, TextButton } from './Buttons';
import CheckTypeSelector from './CheckTypeSelector';
import ErrorBanner from './ErrorBanner';
import FormField from './FormField';

// Change the form based on what the user wants to check.
const FORM_TEXT: Record<CheckType, { title: string; hint: string; label: string; placeholder: string; button: string }> = {
  MESSAGE: {
    title: 'Check a Message',
    hint: 'Paste or type the suspicious message.',
    label: 'Message to check',
    placeholder: 'Paste the message here',
    button: 'Check Message',
  },
  URL: {
    title: 'Check a URL',
    hint: 'Enter the suspicious link.',
    label: 'Link to check',
    placeholder: 'https://example.com',
    button: 'Check URL',
  },
  PHONE: {
    title: 'Check a Phone Number',
    hint: 'Include the country code if you know it.',
    label: 'Phone number to check',
    placeholder: '+250 7XX XXX XXX',
    button: 'Check Number',
  },
};

// Quick checks so obvious mistakes don't need a round trip. The backend still validates everything.
export function quickValidate(type: CheckType, value: string): string {
  const text = value.trim();
  if (type === 'MESSAGE') return text ? '' : 'Please enter a message.';
  if (type === 'URL') {
    if (!text) return 'Please enter a URL.';
    return /\s/.test(text) || !text.includes('.') ? 'Enter a valid URL, for example https://example.com.' : '';
  }
  if (!text) return 'Please enter a phone number.';
  const digits = text.replace(/[\s\-().+]/g, '');
  return /^\d{7,15}$/.test(digits) ? '' : 'Enter a valid phone number, for example +250 788 123 456.';
}

type Props = {
  initialType?: CheckType;
  onResult: (type: CheckType, content: string, result: AnalysisResult) => void;
};

export default function CheckForm({ initialType = 'MESSAGE', onResult }: Props) {
  const [type, setType] = useState<CheckType>(initialType);
  // Each type keeps its own text so switching back and forth doesn't lose it.
  const [values, setValues] = useState<Record<CheckType, string>>({ MESSAGE: '', URL: '', PHONE: '' });
  const [fieldError, setFieldError] = useState('');
  const [failure, setFailure] = useState<'network' | 'server' | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const text = FORM_TEXT[type];
  const value = values[type];

  // The clipboard is only read when the user taps Paste, never in the background.
  async function pasteFromClipboard() {
    const pasted = (await Clipboard.getStringAsync().catch(() => '')).trim();
    if (!pasted) {
      setFieldError('There is nothing to paste. Copy the message, link or number first.');
      return;
    }
    setFieldError('');
    setValues((current) => ({ ...current, [type]: pasted }));
  }

  function changeType(next: CheckType) {
    setType(next);
    setFieldError('');
    setFailure(null);
  }

  async function submit() {
    setFailure(null);
    const problem = quickValidate(type, value);
    setFieldError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    const outcome = await checkContent(type, value);
    setLoading(false);

    if (outcome.kind === 'result') {
      // Clear the box so the checked content doesn't stay on screen after the result opens.
      setValues((current) => ({ ...current, [type]: '' }));
      onResult(type, value.trim(), outcome.result);
    } else if (outcome.kind === 'fieldError') setFieldError(outcome.message);
    else setFailure(outcome.kind);
  }

  const failureText = failure === 'network' ? NETWORK_ERROR : SERVER_ERROR;

  return (
    <View>
      <CheckTypeSelector value={type} onChange={changeType} disabled={loading} />

      <View style={styles.heading}>
        <AppText variant="section">{text.title}</AppText>
        <AppText muted>{text.hint}</AppText>
      </View>

      <FormField
        ref={inputRef}
        label={text.label}
        hideLabel
        value={value}
        onChangeText={(next) => setValues((current) => ({ ...current, [type]: next }))}
        placeholder={text.placeholder}
        error={fieldError}
        multiline={type === 'MESSAGE'}
        keyboardType={type === 'PHONE' ? 'phone-pad' : type === 'URL' ? 'url' : 'default'}
        autoCapitalize={type === 'MESSAGE' ? 'sentences' : 'none'}
        autoCorrect={type === 'MESSAGE'}
        returnKeyType={type === 'MESSAGE' ? 'default' : 'go'}
        onSubmitEditing={type === 'MESSAGE' ? undefined : submit}
        editable={!loading}
      />

      <TextButton label="Paste from clipboard" onPress={pasteFromClipboard} style={styles.paste} />
      <PrimaryButton label={text.button} loading={loading} loadingLabel="Checking..." onPress={submit} />
      {loading ? (
        <AppText variant="small" muted style={styles.status} accessibilityLiveRegion="polite">
          Reviewing the submitted content.
        </AppText>
      ) : null}

      {failure ? (
        <ErrorBanner
          title={failureText.title}
          detail={failureText.detail}
          note="This does not mean the content is safe."
          onRetry={submit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  status: { textAlign: 'center', marginTop: spacing.md },
  paste: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: -spacing.sm, marginBottom: spacing.sm },
});
