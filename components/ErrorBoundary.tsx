import React, { Component, PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { send } from '@/lib/bridge';
import Colors from '@/constants/colors';

type State = { failed: boolean };

/**
 * Catches render errors, reports them to the app and shows an empty screen.
 * Error text is never rendered to the participant (BR-10).
 */
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    send.error('render_error', error.message);
  }

  render() {
    return this.state.failed ? <View style={styles.blank} /> : this.props.children;
  }
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: Colors.background },
});
