/**
 * login.tsx — Pantalla de inicio de sesión.
 *
 * Validaciones client-side: formato de email, longitud mínima de contraseña.
 * Autenticación via Supabase Auth con mensajes de error en español.
 *
 * @module app/login
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });

  /** Valida campos y autentica con Supabase Auth */
  const handleLogin = async () => {
    let newErrors = { email: '', password: '', general: '' };
    let hasError = false;

    if (!email.trim() || !password) {
      newErrors.general = 'Por favor llena todos los campos.';
      hasError = true;
    }

    if (email.trim().length > 60) {
      newErrors.email = 'El correo es demasiado largo (máx 60 caracteres).';
      hasError = true;
    } else if (email.trim().length > 0) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Por favor ingresa un correo electrónico válido.';
        hasError = true;
      }
    }

    if (password.length > 0 && password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
      hasError = true;
    } else if (password.length > 30) {
      newErrors.password = 'La contraseña es demasiado larga (máx 30 caracteres).';
      hasError = true;
    }

    setErrors(newErrors);

    if (hasError) return;

    setLoading(true);

    try {
      if (Platform.OS === 'web') console.log('[Login] Intentando entrar con:', email.trim());

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (error) {
        setLoading(false);
        if (Platform.OS === 'web') console.error('[Login] Error de Supabase:', error);

        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('Error', 'Correo o contraseña incorrectos.');
        } else {
          Alert.alert('Error', error.message);
        }
        return;
      }

      if (Platform.OS === 'web') console.log('[Login] Éxito');
      router.replace('/(tabs)');

    } catch (err) {
      if (Platform.OS === 'web') console.error('[Login] Error inesperado:', err);
      Alert.alert('Error', 'Ocurrió un problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── FONDO: Imagen FIJA (NUNCA SE MUEVE) ── */}
      <ImageBackground
        source={require('../assets/foto-cascada.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
      </ImageBackground>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Top Section */}
          <View style={styles.topSection}>
            <Image
              source={require('../assets/logo-ecos.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.subtitleText}>Guayana Biodiversa</Text>
          </View>

          {/* Card BLANCA */}
          <View style={styles.card}>
            <Text style={styles.title}>Iniciar Sesión</Text>

            {errors.general ? <Text style={styles.errorTextGeneral}>{errors.general}</Text> : null}

            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="tu@correo.com"
                placeholderTextColor="#AAAAAA"
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={60}
                value={email}
                onChangeText={(text) => { setEmail(text); setErrors({ ...errors, email: '', general: '' }); }}
                onSubmitEditing={handleLogin}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <Text style={styles.label}>Contraseña</Text>
            <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#AAAAAA"
                secureTextEntry={!showPassword}
                maxLength={30}
                value={password}
                onChangeText={(text) => { setPassword(text); setErrors({ ...errors, password: '', general: '' }); }}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>Mínimo 8 caracteres</Text>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Cargando...' : 'Entrar'}</Text>
            </TouchableOpacity>

            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>o continuar con</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                <Ionicons name="logo-google" size={22} color="#333333" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                <Ionicons name="logo-apple" size={22} color="#333333" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>¿No tienes cuenta? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.linkText}>Crear cuenta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a3a1a',
  },
  flex: {
    flex: 1,
  },

  /* ── Fondo FIJO (NUNCA SE MUEVE) ── */
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  scrollContent: {
    flexGrow: 1,
  },

  /* ── Top logo section ── */
  topSection: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 20 : 40,
    minHeight: Platform.OS === 'web' ? 300 : 320,
  },
  logoImage: {
    width: Platform.OS === 'web' ? 350 : 280,
    height: Platform.OS === 'web' ? 350 : 280,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: 2,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  /* ── Card BLANCA ── */
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    ...(Platform.OS === 'web' && {
      width: '100%',
      maxWidth: 450,
      alignSelf: 'center',
      borderRadius: 28,
      marginBottom: 40,
    })
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
    color: '#555555',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  inputIcon: {
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333333',
  },
  inputError: {
    borderColor: '#d32f2f',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  errorTextGeneral: {
    color: '#c62828',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: '#FFF5F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333333',
  },
  eyeIcon: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  hintText: {
    fontSize: 11,
    color: '#AAAAAA',
    marginBottom: 16,
    marginLeft: 8,
  },
  button: {
    backgroundColor: '#1B5E20',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#A5D6A7',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    marginHorizontal: 14,
    fontSize: 13,
    color: '#AAAAAA',
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  footerText: {
    color: '#888888',
    fontSize: 14,
  },
  linkText: {
    color: '#1B5E20',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});