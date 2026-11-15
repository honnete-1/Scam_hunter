import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NETWORK_ERROR, SERVER_ERROR } from '../content/labels';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { firstError } from '../services/api';
import { radius, spacing } from '../theme/spacing';
import AppText from './AppText';
import { PrimaryButton, TextButton } from './Buttons';
import FormField from './FormField';

type Mode = 'login' | 'signup';
type Errors = { username?: string; email?: string; password?: string; confirm?: string };

const TEXT = {
  login: { title: 'Welcome back', intro: 'Log in to submit reports and follow their review.', button: 'Log In', busy: 'Logging in...' },
  signup: { title: 'Create an account', intro: "You need an account to submit reports. Checking doesn't need one.", button: 'Create Account', busy: 'Creating account...' },
};

type Props = { mode: Mode; onSuccess: () => void; onSwitchMode: () => void };

export default function AuthForm({ mode, onSuccess, onSwitchMode }: Props) {
  const { colors } = useTheme();
  const { login, signUp } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === 'signup';
  const text = TEXT[mode];

  const update = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit() {
    const nextErrors: Errors = {};
    if (!form.username.trim()) nextErrors.username = 'Please enter your username.';
    if (!form.password) nextErrors.password = 'Please enter your password.';
    // Confirming the password is only a typing check here; the backend gets the password once.
    if (isSignup && form.password && form.password !== form.confirm) nextErrors.confirm = "The passwords don't match.";
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const username = form.username.trim();
    const res = isSignup
      ? await signUp({ username, email: form.email.trim(), password: form.password })
      : await login(username, form.password);
    setSubmitting(false);

    if (res.ok) return onSuccess();
    if (res.kind === 'validation') {
      const fieldErrors = {
        username: firstError(res.data?.username),
        email: firstError(res.data?.email),
        password: firstError(res.data?.password),
      };
      setErrors(fieldErrors);
      if (!Object.values(fieldErrors).some(Boolean)) setFormError('Please check the details and try again.');
    } else if (res.kind === 'auth') {
      setFormError("That username and password don't match. Please try again.");
    } else {
      const failure = res.kind === 'network' ? NETWORK_ERROR : SERVER_ERROR;
      setFormError(`${failure.title} ${failure.detail}`);
    }
  }

  return (
    <View>
      <AppText variant="title" accessibilityRole="header">{text.title}</AppText>
      <AppText muted style={styles.intro}>{text.intro}</AppText>

      {formError ? (
        <View
          accessibilityRole="alert"
          style={[styles.formError, { backgroundColor: colors.status.high.background, borderColor: colors.status.high.border }]}
        >
          <AppText variant="bodyStrong" color={colors.status.high.text}>{formError}</AppText>
        </View>
      ) : null}

      <FormField
        label="Username"
        value={form.username}
        onChangeText={update('username')}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
      />
      {isSignup ? (
        <FormField
          label="Email"
          optional
          value={form.email}
          onChangeText={update('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
      ) : null}
      <FormField
        label="Password"
        hint={isSignup ? 'At least 8 characters. Avoid common or all-number passwords.' : undefined}
        value={form.password}
        onChangeText={update('password')}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        textContentType={isSignup ? 'newPassword' : 'password'}
        onSubmitEditing={isSignup ? undefined : submit}
      />
      {isSignup ? (
        <FormField
          label="Confirm password"
          value={form.confirm}
          onChangeText={update('confirm')}
          error={errors.confirm}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
      ) : null}

      <PrimaryButton label={text.button} loading={submitting} loadingLabel={text.busy} onPress={submit} style={styles.submit} />
      <View style={styles.switchRow}>
        <AppText muted>{isSignup ? 'Already have an account?' : 'New to Scam Hunter?'}</AppText>
        <TextButton label={isSignup ? 'Log in' : 'Create an account'} onPress={onSwitchMode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.sm, marginBottom: spacing.xl },
  formError: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  submit: { marginTop: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: spacing.md },
});
