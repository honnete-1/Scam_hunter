import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { failureLabel, toFailure, type FailureType } from '../content/labels';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { firstError, submitReport } from '../services/api';
import { syncScamNumbers } from '../services/protection';
import { radius, spacing } from '../theme/spacing';
import type { CheckType, CommunityReport, ReviewMode } from '../types/api';
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

const REVIEW_OPTIONS: { value: ReviewMode; title: string; detail: string }[] = [
  {
    value: 'MODERATED',
    title: 'Send for verification',
    detail: 'A moderator checks the number first. Best when you are not completely sure.',
  },
  {
    value: 'DIRECT',
    title: 'Direct report',
    detail: 'The number is added to the scam list at once and flagged for everyone. Only use this if you are sure it is a scammer.',
  },
];

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
  const [reviewMode, setReviewMode] = useState<ReviewMode>('MODERATED');
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<{ content?: string; details?: string; understood?: string }>({});
  const [failure, setFailure] = useState<FailureType | null>(null);
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
    // Direct reports only exist for phone numbers.
    const mode = reportType === 'PHONE' ? reviewMode : 'MODERATED';
    const res = await submitReport({ reportType, content, details, reviewMode: mode });
    setSubmitting(false);

    if (res.ok) {
      // A direct report is already on the scam list, so refresh this phone's copy for call and SMS warnings.
      if (res.data.status === 'APPROVED') await syncScamNumbers().catch(() => false);
      onSubmitted(res.data);
    } else if (res.kind === 'validation') {
      setErrors({
        content: firstError(res.data?.content) || firstError(res.data?.review_mode),
        details: firstError(res.data?.details),
      });
    } else if (res.kind === 'auth') {
      // The saved login is no longer valid, so the screen will ask the user to log in again.
      await forgetUser();
    } else setFailure(toFailure(res.kind));
  }

  const failureText = failureLabel(failure);
  const direct = reportType === 'PHONE' && reviewMode === 'DIRECT';
  const consentText = direct
    ? 'I understand that this report will be stored and the number will be flagged for everyone straight away.'
    : 'I understand that this report will be stored and reviewed by a moderator.';

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

      {reportType === 'PHONE' ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="How should this number be reported?" style={styles.modes}>
          <AppText variant="bodyStrong" style={styles.label}>How should this number be reported?</AppText>
          {REVIEW_OPTIONS.map((option) => {
            const selected = option.value === reviewMode;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityLabel={option.title}
                onPress={() => setReviewMode(option.value)}
                style={[styles.mode, { borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surface }]}
              >
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textMuted} />
                <View style={styles.modeText}>
                  <AppText variant="cardTitle">{option.title}</AppText>
                  <AppText variant="small" muted>{option.detail}</AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        aria-checked={understood}
        accessibilityLabel={consentText}
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
        <AppText style={styles.checkText}>{consentText}</AppText>
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
  modes: { marginTop: spacing.lg, gap: spacing.sm },
  mode: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', padding: spacing.md, borderWidth: 1.5, borderRadius: radius.md },
  modeText: { flex: 1, gap: 2 },
  checkRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { flex: 1 },
  checkError: { marginTop: spacing.xs },
  submit: { marginTop: spacing.xl, borderRadius: radius.md },
});
