/**
 * help.tsx — Pantalla de Apoyo / Soporte.
 *
 * Muestra información completa sobre ECOS: qué es, las pantallas,
 * el objetivo de la plataforma, FAQs y contacto.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { i18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Propiedades del componente AccordionItem.
 */
interface AccordionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  theme: any;
}

/**
 * Muestra un elemento desplegable con un título y un cuerpo de texto.
 */
function AccordionItem({ icon, title, body, theme }: AccordionItemProps) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={toggle}
      style={[styles.accordionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.accordionHeader}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name={icon} size={20} color={theme.primary} />
        </View>
        <Text style={[styles.accordionTitle, { color: theme.text }]}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.subtext}
        />
      </View>
      {open && (
        <Text style={[styles.accordionBody, { color: theme.subtext }]}>{body}</Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * Pantalla principal de ayuda y soporte.
 * Contiene información descriptiva de la aplicación.
 */
export default function HelpScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const screens: { icon: keyof typeof Ionicons.glyphMap; titleKey: string; descKey: string }[] = [
    { icon: 'compass-outline', titleKey: 'help.discoverTitle', descKey: 'help.discoverDesc' },
    { icon: 'scan-outline', titleKey: 'help.scannerTitle', descKey: 'help.scannerDesc' },
    { icon: 'videocam-outline', titleKey: 'help.observatoryTitle', descKey: 'help.observatoryDesc' },
    { icon: 'albums-outline', titleKey: 'help.recordsTitle', descKey: 'help.recordsDesc' },
    { icon: 'person-outline', titleKey: 'help.profileTitle', descKey: 'help.profileDesc' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{i18n.t('help.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
          <Ionicons name="leaf" size={28} color={theme.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.heroTitle, { color: theme.text }]}>{i18n.t('help.whatIsEcos')}</Text>
          <Text style={[styles.heroBody, { color: theme.subtext }]}>{i18n.t('help.whatIsEcosDesc')}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>{i18n.t('help.screens')}</Text>

        {screens.map((s) => (
          <AccordionItem
            key={s.titleKey}
            icon={s.icon}
            title={i18n.t(s.titleKey)}
            body={i18n.t(s.descKey)}
            theme={theme}
          />
        ))}

        <View style={[styles.missionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="heart-outline" size={24} color={theme.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.missionTitle, { color: theme.text }]}>{i18n.t('help.mission')}</Text>
          <Text style={[styles.missionBody, { color: theme.subtext }]}>{i18n.t('help.missionDesc')}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20 },

  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  heroBody: { fontSize: 14, lineHeight: 22, textAlign: 'justify' },

  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },

  accordionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accordionTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  accordionBody: { fontSize: 14, lineHeight: 22, marginTop: 12, paddingLeft: 48, textAlign: 'justify' },

  missionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  missionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  missionBody: { fontSize: 14, lineHeight: 22, textAlign: 'justify' },
});