import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import AppText from '../components/AppText';
import { PrimaryButton, SecondaryButton, TextButton } from '../components/Buttons';
import ReportForm from '../components/ReportForm';
import Screen from '../components/Screen';
import StatusBadge from '../components/StatusBadge';
import { reportStatusLabels } from '../content/labels';
import { useAuth } from '../context/AuthContext';
import { useCheckSession } from '../context/CheckSessionContext';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import type { CommunityReport } from '../types/api';

function Confirmation({ report }: { report: CommunityReport }) {
  // Moderation hasn't happened yet, so nothing here may sound like the content was confirmed.
  return (
    <View accessibilityLiveRegion="polite">
      <AppText variant="title" accessibilityRole="header">Report Submitted</AppText>
      <AppText muted style={styles.gapSmall}>Your report has been sent for review.</AppText>
      <View style={styles.statusRow}>
        <AppText variant="bodyStrong">Status:</AppText>
        <StatusBadge label={reportStatusLabels[report.status] ?? report.status} tone="unavailable" />
      </View>
      <View style={styles.buttons}>
        <PrimaryButton label="View My Reports" onPress={() => router.navigate('/reports')} />
        <TextButton label="Check Something Else" onPress={() => router.navigate('/check')} />
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const { reportDraft, setReportDraft } = useCheckSession();
  const [submitted, setSubmitted] = useState<CommunityReport | null>(null);

  let body;
  if (loading) {
    body = <ActivityIndicator color={colors.text} style={styles.gapLarge} />;
  } else if (submitted) {
    body = <Confirmation report={submitted} />;
  } else if (!user) {
    // The draft stays in memory while the user logs in; after login they come back here.
    body = (
      <View>
        <AppText variant="section" accessibilityRole="header">Log in to submit a report</AppText>
        <AppText muted style={styles.gapSmall}>
          Reports are linked to your account so moderators can review them. Checking doesn't need an account.
        </AppText>
        <View style={styles.buttons}>
          <PrimaryButton label="Log In" onPress={() => router.push({ pathname: '/login', params: { next: 'back' } })} />
          <SecondaryButton label="Create Account" onPress={() => router.push({ pathname: '/signup', params: { next: 'back' } })} />
        </View>
      </View>
    );
  } else {
    body = (
      <ReportForm
        draft={reportDraft}
        onSubmitted={(report) => {
          setReportDraft(null);
          setSubmitted(report);
        }}
      />
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      {!submitted ? (
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">Report Suspicious Content</AppText>
          <AppText muted style={styles.gapSmall}>A moderator reviews every report before it can affect anyone's results.</AppText>
        </View>
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  gapSmall: { marginTop: spacing.sm },
  gapLarge: { marginTop: spacing.xxl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  buttons: { marginTop: spacing.xxl, gap: spacing.md },
});
