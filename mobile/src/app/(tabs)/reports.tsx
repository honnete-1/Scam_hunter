import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import ErrorBanner from '../../components/ErrorBanner';
import OfflineBanner from '../../components/OfflineBanner';
import StatusBadge from '../../components/StatusBadge';
import { NETWORK_ERROR, SERVER_ERROR, checkTypeLabels, reportStatusLabels } from '../../content/labels';
import { useAuth } from '../../context/AuthContext';
import { useCheckSession } from '../../context/CheckSessionContext';
import { useTheme } from '../../context/ThemeContext';
import { getMyReports } from '../../services/api';
import { spacing } from '../../theme/spacing';
import type { CommunityReport } from '../../types/api';
import { formatDate } from '../../utils/format';

export default function ReportsScreen() {
  const { colors } = useTheme();
  const { user, loading, forgetUser } = useAuth();
  const { setReportDraft } = useCheckSession();
  const [reports, setReports] = useState<CommunityReport[] | null>(null);
  const [failure, setFailure] = useState<'network' | 'server' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await getMyReports();
    if (res.ok) {
      setReports(res.data);
      setFailure(null);
    } else if (res.kind === 'auth') await forgetUser();
    else setFailure(res.kind === 'network' ? 'network' : 'server');
  }, [user]);

  // Reload whenever the tab is opened, so a report submitted a moment ago shows up.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function newReport() {
    setReportDraft(null);
    router.push('/report');
  }

  let body;
  if (loading) {
    body = <ActivityIndicator color={colors.text} style={styles.spaced} />;
  } else if (!user) {
    body = (
      <View style={styles.spaced}>
        <AppText variant="section">Log in to see your reports</AppText>
        <AppText muted style={styles.small}>Reports you submit are listed here with their review status.</AppText>
        <PrimaryButton label="Log In" onPress={() => router.push('/login')} style={styles.button} />
      </View>
    );
  } else if (failure && !reports) {
    const text = failure === 'network' ? NETWORK_ERROR : SERVER_ERROR;
    body = <ErrorBanner title={text.title} detail={text.detail} onRetry={load} />;
  } else if (!reports) {
    body = <ActivityIndicator color={colors.text} style={styles.spaced} />;
  } else if (reports.length === 0) {
    body = (
      <View style={styles.spaced}>
        <AppText variant="section">No reports yet</AppText>
        <AppText muted style={styles.small}>When you report something suspicious, it appears here.</AppText>
      </View>
    );
  } else {
    body = reports.map((report) => (
      <View key={report.id} style={[styles.item, { borderColor: colors.border }]}>
        <View style={styles.itemTop}>
          <AppText variant="small" muted>
            {checkTypeLabels[report.report_type]} · {formatDate(report.created_at)}
          </AppText>
          <StatusBadge label={reportStatusLabels[report.status] ?? report.status} tone="unavailable" />
        </View>
        <AppText variant="bodyStrong" numberOfLines={2}>{report.content}</AppText>
      </View>
    ));
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={user ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} /> : undefined}
      >
        <OfflineBanner />
        <AppText variant="title" accessibilityRole="header">My Reports</AppText>
        <AppText muted style={styles.small}>Pending reports don't affect anyone's results until a moderator approves them.</AppText>
        {user ? <SecondaryButton label="Report Something" onPress={newReport} style={styles.button} /> : null}
        <View style={styles.list}>{body}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  small: { marginTop: spacing.sm },
  button: { marginTop: spacing.lg },
  list: { marginTop: spacing.xl },
  spaced: { marginTop: spacing.lg },
  item: { paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
});
