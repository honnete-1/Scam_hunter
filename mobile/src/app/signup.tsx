import { router, useLocalSearchParams } from 'expo-router';
import AuthForm from '../components/AuthForm';
import Screen from '../components/Screen';
import { finishAuth } from '../utils/navigation';

export default function SignupScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <AuthForm
        mode="signup"
        onSuccess={() => finishAuth(next)}
        onSwitchMode={() => router.replace({ pathname: '/login', params: next ? { next } : {} })}
      />
    </Screen>
  );
}
