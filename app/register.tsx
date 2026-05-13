/**
 * register.tsx — Pantalla de registro de usuario.
 *
 * Validaciones: formato email, username alfanumérico, contraseña ≥8 chars.
 * Verifica unicidad de username contra tabla `perfiles` antes de registrar.
 * Soporta flujo con y sin confirmación de email (según config de Supabase).
 *
 * @module app/register
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', username: '', password: '', confirmPassword: '', general: '' });

  /** Valida campos, verifica username único y registra en Supabase Auth */
  const handleRegister = async () => {
    let newErrors = { email: '', username: '', password: '', confirmPassword: '', general: '' };
    let hasError = false;

    // 1. Validaciones básicas de campos vacíos
    if (!email.trim() || !password || !confirmPassword || !username.trim()) {
      newErrors.general = 'Por favor llena todos los campos requeridos.';
      hasError = true;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
      hasError = true;
    }

    // 2. Validación robusta de formato y longitud de correo
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

    // 3. Validación de username
    if (username.trim().length > 15) {
      newErrors.username = 'El nombre de usuario no puede tener más de 15 caracteres.';
      hasError = true;
    } else if (username.trim().length > 0) {
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username.trim())) {
        newErrors.username = 'Solo puede contener letras, números y guiones bajos (_).';
        hasError = true;
      }
    }

    // 4. Validación de longitud de contraseña
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
      if (Platform.OS === 'web') console.log('[Register] Iniciando proceso para:', email.trim());

      // 5. Verificar si el nombre de usuario ya existe
      const { data: existingUser, error: checkError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 es "no rows found", lo cual es bueno
        if (Platform.OS === 'web') console.error('[Register] Error al verificar username:', checkError);
      }

      if (existingUser) {
        setLoading(false);
        Alert.alert('Registro fallido', 'Este nombre de usuario ya está ocupado.');
        return;
      }

      // 6. Registrar usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          // Importante para la web: URL de retorno después de confirmar mail
          emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
          data: {
            username: username.toLowerCase().trim(),
            nombre: username.trim(),
          }
        }
      });

      if (error) {
        if (Platform.OS === 'web') console.error('[Register] Error de Supabase:', error);
        Alert.alert('Error al registrar', error.message);
      } else if (data.session) {
        if (Platform.OS === 'web') console.log('[Register] Registro exitoso, sesión iniciada.');
      } else {
        if (Platform.OS === 'web') console.log('[Register] Registro exitoso, esperando confirmación de email.');
        Alert.alert(
          'Revisa tu correo', 
          'Hemos enviado un enlace de confirmación. Debes confirmar tu correo antes de poder iniciar sesión.'
        );
      }
    } catch (err) {
      if (Platform.OS === 'web') console.error('[Register] Error inesperado:', err);
      Alert.alert('Error', 'Ocurrió un error inesperado al conectar con el servidor.');
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
          <Text style={styles.subtitleText}>Únete a la red</Text>
        </View>

        {/* White card */}
        <View style={styles.card}>
          <Text style={styles.title}>Crear Cuenta</Text>

          {errors.general ? <Text style={styles.errorTextGeneral}>{errors.general}</Text> : null}

          {/* Email */}
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
              onSubmitEditing={handleRegister}
            />
          </View>
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          {/* Username */}
          <Text style={styles.label}>Nombre de Usuario</Text>
          <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
            <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ej: carlos_botanico"
              placeholderTextColor="#AAAAAA"
              autoCapitalize="none"
              maxLength={15}
              value={username}
              onChangeText={(text) => { setUsername(text); setErrors({...errors, username: '', general: ''}); }}
              onSubmitEditing={handleRegister}
            />
          </View>
          {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

          {/* Password */}
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
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <Text style={styles.label}>Confirmar Contraseña</Text>
          <View style={[styles.passwordContainer, errors.confirmPassword ? styles.inputError : null]}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.passwordInput}
              placeholder="Repite tu contraseña"
              placeholderTextColor="#AAAAAA"
              secureTextEntry={!showConfirmPassword}
              maxLength={30}
              value={confirmPassword}
              onChangeText={(text) => { setConfirmPassword(text); setErrors({...errors, confirmPassword: '', general: ''}); }}
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Registrando...' : 'Registrarse'}</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.linkText}>Iniciar sesión</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    color: '#333333',
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
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
