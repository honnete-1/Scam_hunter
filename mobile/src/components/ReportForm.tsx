import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NETWORK_ERROR, SERVER_ERROR } from '../content/labels';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { firstError, submitReport } from '../services/api';
import { radius, spacing } from '../theme/spacing';
import type { CheckType, CommunityReport } from '../types/api';
import AppText from './AppText';
import { PrimaryButton } from './Buttons';
import CheckTypeSelector from './CheckTypeSelector';
import ErrorBanner from './ErrorBanner';
import FormField from './FormField';

const CONTENT_HINTS: Record<CheckType, string> = {
  MESSAGE: 'Paste the message exactly as you received it.',
  URL: 'The full link, for example https://example.com/login.',
  PHONE: 'The number that contacted you, with country code if you know it.',
};

type Props = {
  draft: { type: CheckType; content: string } | null;
  onSubmitted: (report: CommunityReport) => void;
};

export default function ReportForm({ draft, onSubmitted }: Props) {
  const { colors } = useTheme();
  const { forgetUser } = useAuth();
  const [reportType, setReportType] = useState<CheckType>(draft?.type ?? 'MESSAGE');
  const [content, setContent] = useState(draft?.content ?? '');
  const [details, setDetails] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<{ content?: string; details?: string; understood?: string }>({});
  const [failure, setFailure] = useState<'network' | 'server' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const nextErrors: typeof errors = {};
    if (!content.trim()) nextErrors.content = 'Please enter the content you want to report.';
    // Ticking the box makes storing the content a deliberate choice.
    if (!understood) nextErrors.understood = 'Please confirm that you understand the report will be stored.';
    setErrors(nextErrors);
    setFailure(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const res = await submitReport({ reportType, content, details });
    setSubmitting(false);

    if (res.ok) onSubmitted(res.data);
    else if (res.kind === 'validation') {
      setErrors({ content: firstError(res.data?.content), details: firstError(res.data?.details) });
    } else if (res.kind === 'auth') {
      // The saved login is no longer valid, so the screen will ask the user to log in again.
      await forgetUser();
    } else setFailure(res.kind === 'network' ? 'network' : 'server');
  }

  const failureText = failure === 'network' ? NETWORK_ERROR : SERVER_ERROR;

  return (
    <View>
      <AppText variant="bodyStrong" style={styles.label}>Type</AppText>
      <CheckTypeSelector value={reportType} onChange={setReportType} disabled={submitting} />

      <View style={styles.gap} />
      <FormField
        label="Content"
        hint={CONTENT_HINTS[reportType]}
        value={content}
        onChangeText={setContent}
        error={errors.content}
        multiline={reportType === 'MESSAGE'}
        autoCapitalize={reportType === 'MESSAGE' ? 'sentences' : 'none'}
        keyboardType={reportType === 'PHONE' ? 'phone-pad' : reportType === 'URL' ? 'url' : 'default'}
      />
      <FormField
        label="Additional details"
        optional
        hint="For example, where you received it and what it asked you to do."
        value={details}
        onChangeText={setDetails}
        error={errors.details}
        multiline
        style={styles.details}
      />

      <Pressable
        accessibilityRole="checkbox"
        aria-checked={understood}
        accessibilityLabel="I understand that this report will be stored and reviewed by a moderator."
        onPress={() => setUnderstood(!understood)}
        style={styles.checkRow}
      >
        <View
          style={[
            styles.box,
            { borderColor: errors.understood ? colors.status.high.text : colors.borderStrong },
            understood && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {understood ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
        </View>
        <AppText style={styles.checkText}>I understand that this report will be stored and reviewed by a moderator.</AppText>
      </Pressable>
      {errors.understood ? (
        <AppText variant="small" color={colors.status.high.text} accessibilityRole="alert" style={styles.checkError}>
          {errors.understood}
        </AppText>
      ) : null}

      <PrimaryButton label="Submit Report" loading={submitting} loadingLabel="Submitting..." onPress={submit} style={styles.submit} />
      {failure ? <ErrorBanner title={failureText.title} detail={failureText.detail} onRetry={submit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm, fontSize: 15 },
  gap: { height: spacing.xl },
  details: { minHeight: 100 },
  checkRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { flex: 1 },
  checkError: { marginTop: spacing.xs },
  submit: { marginTop: spacing.xl, borderRadius: radius.md },
});
