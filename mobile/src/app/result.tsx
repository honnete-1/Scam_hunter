import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import ErrorBanner from '../components/ErrorBanner';
import ResultView from '../components/ResultView';
import Screen from '../components/Screen';
import { NETWORK_ERROR, SERVER_ERROR } from '../content/labels';
import { useCheckSession } from '../context/CheckSessionContext';
import { checkContent } from '../services/api';
import { resultFeedback } from '../services/feedback';

export default function ResultScreen() {
  const { lastCheck, setLastCheck, setReportDraft } = useCheckSession();
  const [retrying, setRetrying] = useState(false);
  const [failure, setFailure] = useState<'network' | 'server' | null>(null);

  useEffect(() => {
    if (lastCheck) resultFeedback(lastCheck.result);
  }, [lastCheck?.result]);

  // Nothing to show (e.g. the app was reopened on this screen): go back to checking.
  if (!lastCheck) return <Redirect href="/check" />;

  async function tryAgain() {
    if (!lastCheck) return;
    setRetrying(true);
    setFailure(null);
    const outcome = await checkContent(lastCheck.type, lastCheck.content);
    setRetrying(false);
    if (outcome.kind === 'result') setLastCheck({ ...lastCheck, result: outcome.result });
    else setFailure(outcome.kind === 'network' ? 'network' : 'server');
  }

  function checkAnother() {
    setLastCheck(null);
    if (router.canGoBack()) router.back();
    else router.replace('/check');
  }

  function reportThis() {
    if (!lastCheck) return;
    // Reporting is a separate, deliberate step. Nothing is stored until the report form is submitted.
    setReportDraft({ type: lastCheck.type, content: lastCheck.content });
    router.push('/report');
  }

  const failureText = failure === 'network' ? NETWORK_ERROR : SERVER_ERROR;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ResultView
        result={lastCheck.result}
        checkType={lastCheck.type}
        retrying={retrying}
        onReport={reportThis}
        onCheckAnother={checkAnother}
        onTryAgain={tryAgain}
        onRequestRemoval={() => router.push({ pathname: '/removal-request', params: { number: lastCheck.content } })}
      />
      {failure ? (
        <ErrorBanner title={failureText.title} detail={failureText.detail} note="This does not mean the content is safe." />
      ) : null}
    </Screen>
  );
}
