import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';

type Props = {
  children: ReactNode;
  // Tab screens have the tab bar below, so they don't need the bottom safe area.
  edges?: Edge[];
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

// Every screen uses this, so safe areas, keyboard handling and background are always the same.
export default function Screen({ children, edges = ['top', 'left', 'right'], scroll = true, contentStyle }: Props) {
  const { colors } = useTheme();
  const content = [styles.content, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, content]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
});
