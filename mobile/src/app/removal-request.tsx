import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import AppText from '../components/AppText';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import FormField from '../components/FormField';
import Screen from '../components/Screen';
import StatusBadge from '../components/StatusBadge';
import { failureLabel, toFailure, type FailureType, removalStatusLabels } from '../content/labels';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { firstError, getMyRemovalRequests, sendRemovalRequest, type ProofFile } from '../services/api';
import { spacing } from '../theme/spacing';
import type { RemovalRequest } from '../types/api';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

type Errors = Partial<Record<'phoneNumber' | 'fullName' | 'contact' | 'explanation' | 'proof', string>>;

// The owner of a number that was reported by mistake asks a moderator to take it off the scam list.
export default function RemovalRequestScreen() {
  const { colors } = useTheme();
  const { user, loading, forgetUser } = useAuth();
  const params = useLocalSearchParams<{ number?: string }>();
  const [phoneNumber, setPhoneNumber] = useState(params.number ?? '');
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [explanation, setExplanation] = useState('');
  const [proof, setProof] = useState<ProofFile | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<FailureType | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<RemovalRequest | null>(null);
  const [requests, setRequests] = useState<RemovalRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    getMyRemovalRequests().then((res) => {
      if (res.ok) setRequests(res.data);
    });
  }, [user]);

  async function pickProof() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const file = picked.assets[0];
    if (file.size && file.size > MAX_PROOF_BYTES) {
      setErrors((current) => ({ ...current, proof: 'The file is too large. The limit is 5 MB.' }));
      return;
    }
    setErrors((current) => ({ ...current, proof: undefined }));
    setProof({ uri: file.uri, name: file.name, mimeType: file.mimeType ?? 'application/octet-stream' });
  }

  async function submit() {
    const next: Errors = {};
    if (!phoneNumber.trim()) next.phoneNumber = 'Please enter the number that was reported.';
    if (!fullName.trim()) next.fullName = "Please enter the name of the number's owner.";
    if (!contact.trim()) next.contact = 'Please enter an email or phone number where a moderator can reach you.';
    if (!explanation.trim()) next.explanation = 'Please explain why the number was reported by mistake.';
    if (!proof) next.proof = 'Please attach your proof.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0 || !proof) return;

    setSending(true);
    const res = await sendRemovalRequest({ phoneNumber, fullName, contact, explanation, proof });
    setSending(false);
    if (res.ok) {
      setSent(res.data);
      setRequests((current) => [res.data, ...current]);
    } else if (res.kind === 'validation') {
      setErrors({
        phoneNumber: firstError(res.data?.phone_number),
        fullName: firstError(res.data?.full_name),
        contact: firstError(res.data?.contact),
        explanation: firstError(res.data?.explanation),
        proof: firstError(res.data?.proof),
      });
    } else if (res.kind === 'auth') {
      await forgetUser();
    } else setFailure(toFailure(res.kind));
  }

  let body;
  if (loading) {
    body = <ActivityIndicator color={colors.text} style={styles.gapLarge} />;
  } else if (!user) {
    body = (
      <View>
        <AppText variant="section" accessibilityRole="header">Log in to send a request</AppText>
        <AppText muted style={styles.gapSmall}>
          Requests are linked to your account so a moderator can reach you and you can follow the answer here.
        </AppText>
        <View style={styles.buttons}>
          <PrimaryButton label="Log In" onPress={() => router.push({ pathname: '/login', params: { next: 'back' } })} />
          <SecondaryButton label="Create Account" onPress={() => router.push({ pathname: '/signup', params: { next: 'back' } })} />
        </View>
      </View>
    );
  } else if (sent) {
    body = (
      <View accessibilityLiveRegion="polite">
        <AppText variant="section" accessibilityRole="header">Request sent</AppText>
        <AppText muted style={styles.gapSmall}>
          A moderator will check your proof for {sent.phone_number}. The number stays on the list until then.
        </AppText>
      </View>
    );
  } else {
    const failureText = failureLabel(failure);
    body = (
      <View>
        <FormField
          label="Reported phone number"
          hint="Any format, e.g. 0788 123 456 or +250788123456."
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          error={errors.phoneNumber}
          keyboardType="phone-pad"
        />
        <FormField label="Full name of the number's owner" value={fullName} onChangeText={setFullName} error={errors.fullName} />
        <FormField
          label="How can a moderator reach you?"
          hint="An email address or another phone number."
          value={contact}
          onChangeText={setContact}
          error={errors.contact}
          autoCapitalize="none"
        />
        <FormField
          label="What happened?"
          hint="For example: it is my business number and a customer reported it after a misunderstanding."
          value={explanation}
          onChangeText={setExplanation}
          error={errors.explanation}
          multiline
          style={styles.multiline}
        />
        <AppText variant="bodyStrong">Proof</AppText>
        <AppText variant="small" muted style={styles.gapSmall}>
          A photo or PDF, e.g. a letter from MTN or Airtel with their stamp showing the number is yours. JPG, PNG or
          PDF, at most 5 MB. Only moderators can see it.
        </AppText>
        <SecondaryButton label={proof ? 'Choose Another File' : 'Choose File'} onPress={pickProof} style={styles.gapSmall} />
        {proof ? <AppText variant="small" style={styles.gapSmall}>Selected: {proof.name}</AppText> : null}
        {errors.proof ? (
          <AppText variant="small" color={colors.status.high.text} style={styles.gapSmall} accessibilityLiveRegion="polite">
            {errors.proof}
          </AppText>
        ) : null}
        {failure ? (
          <AppText variant="small" color={colors.status.high.text} style={styles.gapSmall} accessibilityLiveRegion="polite">
            {failureText.title} {failureText.detail}
          </AppText>
        ) : null}
        <PrimaryButton label="Send Request" loading={sending} loadingLabel="Sending" onPress={submit} style={styles.gapLarge} />
      </View>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">Number Reported by Mistake?</AppText>
        <AppText muted style={styles.gapSmall}>
          If your number is on the scam list but you are innocent, send proof. A moderator checks it, and if it is
          accepted, the number is removed for everyone.
        </AppText>
      </View>
      {body}
      {user && requests.length > 0 ? (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <AppText variant="label" muted>My removal requests</AppText>
          {requests.map((request) => (
            <View key={request.id} style={styles.request}>
              <View style={styles.row}>
                <AppText variant="bodyStrong" style={styles.flex}>{request.phone_number}</AppText>
                <StatusBadge
                  label={removalStatusLabels[request.status] ?? request.status}
                  tone={request.status === 'ACCEPTED' ? 'clear' : request.status === 'DECLINED' ? 'high' : 'unavailable'}
                />
              </View>
              {request.moderator_note ? <AppText variant="small" muted>Moderator: {request.moderator_note}</AppText> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  gapSmall: { marginTop: spacing.sm },
  gapLarge: { marginTop: spacing.xxl },
  buttons: { marginTop: spacing.xxl, gap: spacing.md },
  multiline: { minHeight: 110 },
  section: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: 1, gap: spacing.md },
  request: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
