/**
 * @module ScannerScreen
 * Vista de pestaña que envuelve el componente de cámara/escáner.
 */

import { StyleSheet, View } from 'react-native';
import Scanner from '../../components/Scanner';
import { useTheme } from '../../lib/theme';

export default function ScannerScreen() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.mode === 'dark' ? theme.background : '#000' }]}>
      <Scanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
