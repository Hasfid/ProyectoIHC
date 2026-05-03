import { StyleSheet, View } from 'react-native';
import Scanner from '../../components/Scanner';

export default function ScannerScreen() {
  return (
    <View style={styles.container}>
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
