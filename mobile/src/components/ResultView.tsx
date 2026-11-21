import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import { UNAVAILABLE_LABEL, checkStatusText, concernLabels, labelForIndicator, subjectNames } from '../content/labels';
import { useTheme } from '../context/ThemeContext';
import type { StatusTone } from '../theme/colors';
import { minTouch, radius, spacing } from '../theme/spacing';
import type { AnalysisResult, CheckRow, CheckType, Indicator, PhoneReputation } from '../types/api';
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

// Every check behind the result, including ones that could not run, hidden until asked for.
export function ChecksPerformed({ checks }: { checks?: CheckRow[] }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (!checks || checks.length === 0) return null;
  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" aria-expanded={open} onPress={() => setOpen(!open)} style={styles.toggle}>
        <AppText variant="bodyStrong" color={colors.link}>
          {open ? 'Hide how we checked' : `How we checked (${checks.length} checks)`}
        </AppText>
      </Pressable>
      {open
        ? checks.map((check) => (
            <View key={check.id} style={[styles.checkRow, { borderColor: colors.border }]}>
              <View style={styles.checkTop}>
                <AppText variant="bodyStrong" style={styles.flex}>{check.label}</AppText>
                <AppText
                  variant="small"
                  color={check.finding ? colors.status.high.text : check.status === 'COMPLETED' ? colors.status.clear.text : colors.textMuted}
                >
                  {check.finding ? 'Found a warning' : checkStatusText[check.status] ?? check.status}
                </AppText>
              </View>
              {check.detail ? <AppText variant="small" muted>{check.detail}</AppText> : null}
            </View>
          ))
        : null}
    </View>
  );
}

// The AI model's own scam-likelihood score. A second opinion: the concern level comes from all checks.
export function AIScore({ score }: { score?: number | null }) {
  const { colors } = useTheme();
  if (score === null || score === undefined) return null;
  const tone = colors.status[score >= 70 ? 'high' : score >= 40 ? 'caution' : 'clear'];
  return (
    <View style={[styles.score, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <View style={styles.scoreTop}>
        <AppText variant="label" muted style={styles.flex}>AI scam-likelihood score</AppText>
        <AppText variant="title" color={tone.text} style={styles.scoreValue}>{score}%</AppText>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="AI scam-likelihood score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        style={[styles.scoreBar, { backgroundColor: colors.surface }]}
      >
        <View style={[styles.scoreFill, { width: `${score}%`, backgroundColor: tone.text }]} />
      </View>
      <AppText variant="small" muted>An AI second opinion. The result above is based on all the checks together.</AppText>
    </View>
  );
}

function Reputation({ reputation }: { reputation?: PhoneReputation | null }) {
  const { colors } = useTheme();
  if (!reputation || !reputation.approved_reports) return null;
  const count = reputation.approved_reports;
  return (
    <View style={[styles.reputation, { backgroundColor: colors.status.high.background }]}>
      <AppText variant="bodyStrong" color={colors.status.high.text}>
        Reported by {count} community member{count === 1 ? '' : 's'}
        {reputation.first_reported ? `, first on ${reputation.first_reported}` : ''}. Each report was checked by a moderator.
      </AppText>
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

// Shares the verdict and safer action so family and friends are warned too.
// The checked content itself is not included, so nothing private is shared by accident.
export function shareWarning(levelLabel: string, summary: string, saferAction: string, subject: string) {
  const message = `Scam Hunter checked a ${subject}: ${levelLabel}. ${summary}

Safer action: ${saferAction}

Check before you act.`;
  return Share.share({ message }).catch(() => {});
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
        <AIScore score={result.ai_score} />

        {indicators.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="label" muted style={styles.sectionLabel}>Noticed before the check stopped</AppText>
            <Findings indicators={indicators} referenceMatch={false} subject={subject} tone="unavailable" showDetails={false} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SaferActionCard text={result.safer_action || 'Verify the sender, number or website independently.'} />
        </View>
        <ChecksPerformed checks={result.checks} />
        <View style={styles.actions}>
          <PrimaryButton label="Try Again" loading={retrying} loadingLabel="Checking..." onPress={onTryAgain} />
          <TextButton
            label="Share Warning"
            onPress={() => shareWarning(UNAVAILABLE_LABEL, 'The check could not be completed, so do not rely on it yet.', result.safer_action, subject)}
          />
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
      <Reputation reputation={result.reputation} />
      <AIScore score={result.ai_score} />

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

      <ChecksPerformed checks={result.checks} />

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
            <SecondaryButton label="Share Warning" onPress={() => shareWarning(level.label, summary, result.safer_action, subject)} />
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
  flex: { flex: 1 },
  score: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  scoreTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreValue: { fontSize: 26, lineHeight: 30 },
  scoreBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4 },
  checkRow: { paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  checkTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reputation: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.sm },
});
