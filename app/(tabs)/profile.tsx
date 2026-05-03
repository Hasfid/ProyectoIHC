import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');

// Mock data
const mockUser = {
  username: 'carlos_botanico',
  fullName: 'Carlos Mendoza',
  description: 'Apasionado por la flora de la Guayana. Botánico y fotógrafo aficionado. 🌱📸',
  followers: 1240,
  following: 356,
  recordsCount: 42,
  profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200',
};

const mockRecords = [
  { id: '1', image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=400&h=400' },
  { id: '2', image: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=400&h=400' },
  { id: '3', image: 'https://images.unsplash.com/photo-1456926631375-92c8ce872def?auto=format&fit=crop&q=80&w=400&h=400' },
  { id: '4', image: 'https://images.unsplash.com/photo-1550853024-fae8cd4be47f?auto=format&fit=crop&q=80&w=400&h=400' },
  { id: '5', image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=400&h=400' },
  { id: '6', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400&h=400' },
];

const mockCommunityPosts = [
  {
    id: '1',
    title: 'Avistamiento de Jaguar',
    description: 'Se avistó un jaguar cruzando el sendero principal cerca del río en la zona norte del parque esta mañana.',
    time: 'Hace 2 horas',
  },
  {
    id: '2',
    title: 'Nueva especie de orquídea',
    description: 'El equipo de botánica acaba de catalogar una nueva orquídea en las zonas húmedas del sur.',
    time: 'Hace 1 día',
  }
];

type Tab = 'records' | 'community';

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('records');

  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <Text style={styles.customHeaderTitle}>{mockUser.username}</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu-outline" size={28} color="#111" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Profile Header (Instagram style) */}
        <View style={styles.headerContainer}>
          <Image source={{ uri: mockUser.profileImage }} style={styles.profileImage} />
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mockUser.recordsCount}</Text>
              <Text style={styles.statLabel}>Registros</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mockUser.followers}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mockUser.following}</Text>
              <Text style={styles.statLabel}>Seguidos</Text>
            </View>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.fullName}>{mockUser.fullName}</Text>
          <Text style={styles.description}>{mockUser.description}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Compartir perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && styles.activeTab]} 
            onPress={() => setActiveTab('records')}
          >
            <Ionicons name="grid-outline" size={24} color={activeTab === 'records' ? '#111' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'community' && styles.activeTab]} 
            onPress={() => setActiveTab('community')}
          >
            <Ionicons name="list-outline" size={26} color={activeTab === 'community' ? '#111' : '#888'} />
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'records' ? (
          <View style={styles.gridContainer}>
            {mockRecords.map((record) => (
              <TouchableOpacity key={record.id} style={styles.gridItem}>
                <Image source={{ uri: record.image }} style={styles.gridImage} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.communityContainer}>
            {mockCommunityPosts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postDescription}>{post.description}</Text>
                <Text style={styles.postTime}>{post.time}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} /> {/* Bottom padding */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  customHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  scrollContent: {
    paddingTop: 100, // Space for transparent header
  },
  backButton: {
    marginLeft: 16,
    padding: 8,
  },
  menuButton: {
    marginRight: 16,
    padding: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  profileImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  statLabel: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
  },
  infoContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#111',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: width / 3,
    height: width / 3,
    borderWidth: 0.5,
    borderColor: '#ffffff',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  communityContainer: {
    padding: 16,
    gap: 16,
    backgroundColor: '#f9fafb',
  },
  postCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  postDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  postTime: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  }
});
