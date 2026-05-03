import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const menuItems = [
  { key: 'discover', label: 'Descubrir' },
  { key: 'observatory', label: 'Observatorio' },
  { key: 'scanner', label: 'Escaner' },
  { key: 'profile', label: 'Perfil' },
];

export default function HomeScreen() {
  const router = useRouter();

  const handlePress = (key: string) => {
    if (key === 'discover') {
      router.push('/discover');
    } else if (key === 'observatory') {
      router.push('/observatory');
    } else if (key === 'scanner') {
      router.push('/scanner');
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Biodiversidad Guayana</Text>
      <Text style={styles.subtitle}>Navega con facilidad en un diseño limpio.</Text>

      <View style={styles.menu} accessible accessibilityRole="menu">
        {menuItems.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.menuItemPressed,
            ]}
            accessible
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
            onPress={() => handlePress(item.key)}
          >
            <Text style={styles.menuItemText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    backgroundColor: '#f7f7f7',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
  },
  menu: {
    gap: 16,
  },
  menuItem: {
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItemPressed: {
    borderColor: '#bdbdbd',
    backgroundColor: '#f2f2f2',
  },
  menuItemText: {
    fontSize: 18,
    color: '#111',
    fontWeight: '600',
  },
});
