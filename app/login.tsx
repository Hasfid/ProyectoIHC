/**
 * login.tsx — Pantalla de inicio de sesión.
 *
 * Validaciones client-side: formato de email, longitud mínima de contraseña.
 * Autenticación via Supabase Auth con mensajes de error en español.
 *
 * @module app/login
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
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
      <View style={styles.topSection}>
        <Text style={styles.logoText}>Ecos</Text>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.title}>Iniciar Sesión</Text>

        {errors.general ? <Text style={styles.errorTextGeneral}>{errors.general}</Text> : null}

        <Text style={styles.label}>Correo Electrónico</Text>
        <TextInput
          style={[styles.input, errors.email ? styles.inputError : null]}
          placeholder="tu@correo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          maxLength={60}
          value={email}
          onChangeText={(text) => { setEmail(text); setErrors({...errors, email: '', general: ''}); }}
          onSubmitEditing={handleLogin}
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <Text style={styles.label}>Contraseña</Text>
        <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry={!showPassword}
            maxLength={30}
            value={password}
            onChangeText={(text) => { setPassword(text); setErrors({...errors, password: '', general: ''}); }}
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#888" />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Cargando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  logoText: {
    fontSize: 54,
    fontWeight: '900',
    color: '#2e7d32',
    letterSpacing: 2,
  },
  bottomSection: {
    flex: 2,
    padding: 24,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#d32f2f',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    marginTop: -15,
    marginBottom: 15,
    marginLeft: 4,
  },
  errorTextGeneral: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 14,
  },
  button: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#555',
    fontSize: 15,
  },
  linkText: {
    color: '#2e7d32',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
