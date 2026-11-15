import { router, useLocalSearchParams } from 'expo-router';
import AuthForm from '../components/AuthForm';
import Screen from '../components/Screen';
import { finishAuth } from '../utils/navigation';

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <AuthForm
        mode="login"
        onSuccess={() => finishAuth(next)}
        onSwitchMode={() => router.replace({ pathname: '/signup', params: next ? { next } : {} })}
      />
    </Screen>
  );
}
