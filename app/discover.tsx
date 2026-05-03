import React from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Map from '../components/Map';

export default function DiscoverScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <BlurView intensity={80} tint="light" style={styles.backButtonBlur}>
                <Ionicons name="chevron-back" size={24} color="#004d40" />
              </BlurView>
            </TouchableOpacity>
          )
        }} 
      />
      
      <Map />

      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={styles.floatingButton} onPress={() => router.push('/chat')}>
          <BlurView intensity={90} tint="light" style={styles.blurContainer}>
            <Ionicons name="chatbubbles" size={28} color="#004d40" style={styles.icon} />
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    marginLeft: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonBlur: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  icon: {
    transform: [{ rotate: '-15deg' }, { translateX: -2 }, { translateY: 2 }],
  }
});
