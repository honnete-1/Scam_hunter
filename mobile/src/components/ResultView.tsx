import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { UNAVAILABLE_LABEL, concernLabels, labelForIndicator, subjectNames } from '../content/labels';
import { useTheme } from '../context/ThemeContext';
import type { StatusTone } from '../theme/colors';
import { minTouch, radius, spacing } from '../theme/spacing';
import type { AnalysisResult, CheckType, Indicator } from '../types/api';
import AppText from './AppText';
import { PrimaryButton, SecondaryButton, TextButton } from './Buttons';
import StatusBadge from './StatusBadge';

type Props = {
  result: AnalysisResult;
  checkType: CheckType;
  retrying?: boolean;
  onReport: () => void;
  onCheckAnother: () => void;
  onTryAgain: () => void;
};

function countText(count: number) {
  return `${count} warning sign${count === 1 ? '' : 's'} found`;
}

// The backend sends one indicator per type already; this keeps the screen matching that rule.
function distinctIndicators(indicators: Indicator[] = []) {
  const seen = new Set<string>();
  return indicators.filter((indicator) => (seen.has(indicator.type) ? false : (seen.add(indicator.type), true)));
}

export function SaferActionCard({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.safer, { backgroundColor: colors.blueTint, borderLeftColor: colors.primary }]}>
      <AppText variant="label" muted>Safer action</AppText>
      <AppText variant="bodyStrong">{text}</AppText>
    </View>
  );
}

function Findings({ indicators, referenceMatch, subject, tone, showDetails }: {
  indicators: Indicator[];
  referenceMatch: boolean;
  subject: string;
  tone: StatusTone;
  showDetails: boolean;
}) {
  const { colors } = useTheme();
  const dot = <View style={[styles.findingDot, { backgroundColor: colors.status[tone].text }]} />;
  return (
    <View>
      {referenceMatch ? (
        <View style={[styles.finding, { borderColor: colors.border }]}>
          {dot}
          <View style={styles.findingText}>
            <AppText variant="cardTitle">Matches an approved suspicious record</AppText>
            {showDetails ? (
              <AppText muted>This {subject} matches a record that moderators reviewed and approved as suspicious.</AppText>
            ) : null}
          </View>
        </View>
      ) : null}
      {indicators.map((indicator) => (
        <View key={indicator.type} style={[styles.finding, { borderColor: colors.border }]}>
          {dot}
          <View style={styles.findingText}>
            <AppText variant="cardTitle">{labelForIndicator(indicator.type)}</AppText>
            {indicator.evidence ? <AppText muted>“{indicator.evidence}”</AppText> : null}
            {showDetails ? <AppText variant="small" muted>{indicator.explanation}</AppText> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// A gentle fade-in, skipped for people who turned on "reduce motion".
function useReveal() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) progress.setValue(1);
        else Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
  }, [progress]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
}

export default function ResultView({ result, checkType, retrying, onReport, onCheckAnother, onTryAgain }: Props) {
  const { colors } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const reveal = useReveal();
  const subject = subjectNames[checkType];
  const indicators = distinctIndicators(result.indicators);

  // I keep unavailable separate because a failed check must never look like a normal or safe result.
  if (result.status === 'CHECK_UNAVAILABLE' || !result.concern_level) {
    return (
      <Animated.View style={reveal}>
        <StatusBadge label={UNAVAILABLE_LABEL} tone="unavailable" />
        <AppText variant="title" style={styles.summary} accessibilityRole="header">
          The required reference check is currently unavailable.
        </AppText>
        <AppText muted>This does not mean the content is safe.</AppText>

        {indicators.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="label" muted style={styles.sectionLabel}>Noticed before the check stopped</AppText>
            <Findings indicators={indicators} referenceMatch={false} subject={subject} tone="unavailable" showDetails={false} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SaferActionCard text={result.safer_action || 'Verify the sender, number or website independently.'} />
        </View>
        <View style={styles.actions}>
          <PrimaryButton label="Try Again" loading={retrying} loadingLabel="Checking..." onPress={onTryAgain} />
          <TextButton label="Check Another" onPress={onCheckAnother} />
        </View>
      </Animated.View>
    );
  }

  const level = concernLabels[result.concern_level];
  const isClear = result.concern_level === 'NO_KNOWN_WARNING_SIGNS';

  let summary = 'No configured warning indicators or approved suspicious records were found.';
  let detail = 'Continue to use caution with unexpected requests.';
  if (result.concern_level === 'HIGH_CONCERN') {
    summary = result.reference_match && indicators.length === 0
      ? `This ${subject} matches a record moderators approved as suspicious.`
      : 'This content contains several concerning signs.';
    detail = indicators.length > 0 ? countText(indicators.length) : '';
  } else if (result.concern_level === 'CAUTION') {
    summary = countText(indicators.length);
    detail = '';
  }

  const hasFindings = indicators.length > 0 || result.reference_match;

  return (
    <Animated.View style={reveal}>
      <StatusBadge label={level.label} tone={level.tone} />
      <AppText variant="title" style={styles.summary} accessibilityRole="header">{summary}</AppText>
      {detail ? <AppText muted>{detail}</AppText> : null}

      {hasFindings ? (
        <View style={styles.section}>
          <AppText variant="label" muted style={styles.sectionLabel}>Why this result?</AppText>
          <Findings
            indicators={indicators}
            referenceMatch={result.reference_match}
            subject={subject}
            tone={level.tone}
            showDetails={showDetails}
          />
          <Pressable
            accessibilityRole="button"
            aria-expanded={showDetails}
            onPress={() => setShowDetails(!showDetails)}
            style={styles.toggle}
          >
            <AppText variant="bodyStrong" color={colors.link}>{showDetails ? 'Hide details' : 'See more details'}</AppText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <SaferActionCard text={result.safer_action} />
      </View>

      {showDetails && result.explanation ? (
        <AppText variant="small" muted style={styles.explanation}>{result.explanation}</AppText>
      ) : null}

      <View style={styles.actions}>
        {isClear ? (
          <>
            <PrimaryButton label="Check Another" onPress={onCheckAnother} />
            <TextButton label="Report This Anyway" onPress={onReport} />
          </>
        ) : (
          <>
            <SecondaryButton label="Report This" onPress={onReport} />
            <TextButton label="Check Another" onPress={onCheckAnother} />
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A bit smaller than a screen title so the findings and safer action stay near the top.
  summary: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 24, lineHeight: 30 },
  section: { marginTop: spacing.xl },
  sectionLabel: { marginBottom: spacing.sm },
  finding: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  findingDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  findingText: { flex: 1, gap: 2 },
  toggle: { minHeight: minTouch, justifyContent: 'center' },
  safer: { borderRadius: radius.md, borderLeftWidth: 4, padding: spacing.lg, gap: spacing.xs },
  explanation: { marginTop: spacing.md },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
});
