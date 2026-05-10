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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
          <Text style={styles.logoText}>Ecos</Text>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.title}>Crear Cuenta</Text>

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
            onSubmitEditing={handleRegister}
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          <Text style={styles.label}>Nombre de Usuario</Text>
          <TextInput
            style={[styles.input, errors.username ? styles.inputError : null]}
            placeholder="ej: carlos_botanico"
            autoCapitalize="none"
            maxLength={15}
            value={username}
            onChangeText={(text) => { setUsername(text); setErrors({...errors, username: '', general: ''}); }}
            onSubmitEditing={handleRegister}
          />
          {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry={!showPassword}
              maxLength={30}
              value={password}
              onChangeText={(text) => { setPassword(text); setErrors({...errors, password: '', general: ''}); }}
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#888" />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <Text style={styles.label}>Confirmar Contraseña</Text>
          <View style={[styles.passwordContainer, errors.confirmPassword ? styles.inputError : null]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Repite tu contraseña"
              secureTextEntry={!showPassword}
              maxLength={30}
              value={confirmPassword}
              onChangeText={(text) => { setConfirmPassword(text); setErrors({...errors, confirmPassword: '', general: ''}); }}
              onSubmitEditing={handleRegister}
            />
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
    backgroundColor: '#fff',
  },
  topSection: {
    height: 200,
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
    flex: 1,
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
