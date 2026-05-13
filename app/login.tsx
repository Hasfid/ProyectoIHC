/**
 * login.tsx — Pantalla de inicio de sesión.
 *
 * Validaciones client-side: formato de email, longitud mínima de contraseña.
 * Autenticación via Supabase Auth con mensajes de error en español.
 *
 * @module app/login
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

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
        
        // Personalizamos el error
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('Error', 'Correo o contraseña incorrectos.');
        } else {
          Alert.alert('Error', error.message);
        }
        return;
      }

      if (Platform.OS === 'web') console.log('[Login] Éxito');
      // Éxito - El AppIndex nos redirigirá automáticamente
      router.replace('/(tabs)');
      
    } catch (err) {
      if (Platform.OS === 'web') console.error('[Login] Error inesperado:', err);
      Alert.alert('Error', 'Ocurrió un problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Gradient background simulated with layered views */}
        <View style={styles.gradientBackground}>
          <View style={styles.gradientLayer1} />
          <View style={styles.gradientLayer2} />
        </View>

        {/* Logo / Top Section */}
        <View style={styles.topSection}>
          <View style={styles.logoPlaceholder}>
            <Ionicons name="leaf" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.logoText}>Ecos</Text>
          <Text style={styles.subtitleText}>Guayana Biodiversa</Text>
        </View>

        {/* White card */}
        <View style={styles.card}>
        <Text style={styles.title}>Iniciar Sesión</Text>

        {errors.general ? <Text style={styles.errorTextGeneral}>{errors.general}</Text> : null}

        {/* Email input with icon */}
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
            onChangeText={(text) => { setEmail(text); setErrors({...errors, email: '', general: ''}); }}
            onSubmitEditing={handleLogin}
          />
        </View>
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        {/* Password input with icon */}
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
            onChangeText={(text) => { setPassword(text); setErrors({...errors, password: '', general: ''}); }}
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
          </TouchableOpacity>
        </View>
        <Text style={styles.hintText}>Mínimo 8 caracteres</Text>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        {/* Login button */}
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Cargando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>o continuar con</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Social buttons placeholder */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D5A27',
  },

  /* ── Gradient background (simulated) ── */
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2D5A27',
  },
  gradientLayer2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: '#4A7C3F',
    opacity: 0.5,
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
  },

  /* ── Top logo section ── */
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    minHeight: 280,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  subtitleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    letterSpacing: 1.5,
    fontWeight: '500',
  },

  /* ── White card ── */
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
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
    color: '#333333',
    textAlign: 'center',
  },

  /* ── Labels ── */
  label: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
    color: '#555555',
    marginLeft: 4,
  },

  /* ── Input fields ── */
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
    color: '#d32f2f',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 8,
  },
  errorTextGeneral: {
    color: '#d32f2f',
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

  /* ── Password field ── */
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

  /* ── Button ── */
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

  /* ── Separator ── */
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

  /* ── Social buttons ── */
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

  /* ── Footer ── */
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
    color: '#2D5A27',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
