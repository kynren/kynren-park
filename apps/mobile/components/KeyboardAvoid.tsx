import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Keeps a form's fields above the keyboard.
 *
 * Android is edge-to-edge now (Expo SDK 54): the window no longer shrinks when the keyboard opens, so without this the
 * keyboard sits on top of whatever is lower down the screen. `offset` is the height of a native header above the form,
 * which only iOS needs to be told about.
 */
export function KeyboardAvoid({ children, offset = 0, style }: { children: ReactNode; offset?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? offset : 0}>
      {children}
    </KeyboardAvoidingView>
  );
}
