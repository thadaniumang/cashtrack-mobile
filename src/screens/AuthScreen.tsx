import React, { useState, useEffect } from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Card, Text, HelperText, ActivityIndicator } from 'react-native-paper';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email').max(255, 'Email is too long'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long'),
});

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { appTheme } = useTheme();
  
  const { signIn, signUp, resetPassword, updatePassword, user, isLoading, isPasswordRecovery, clearPasswordRecovery } = useAuth();

  useEffect(() => {
    if (user && !isPasswordRecovery) {
      // Navigation is handled by RootNavigator
    }
  }, [user, isPasswordRecovery]);

  const validateForm = () => {
    try {
      if (isPasswordRecovery) {
        if (password.length < 6) {
          setErrors({ password: 'Password must be at least 6 characters' });
          return false;
        }
        if (password !== confirmPassword) {
          setErrors({ confirmPassword: 'Passwords do not match' });
          return false;
        }
      } else {
        authSchema.parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
          err.issues.forEach((e) => {
          if (e.path[0] === 'email') fieldErrors.email = e.message;
          if (e.path[0] === 'password') fieldErrors.password = e.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (isPasswordRecovery) {
      if (!validateForm()) return;
    } else if (isForgotPassword) {
      if (!email) {
        setErrors({ email: 'Please enter your email' });
        return;
      }
      try {
        authSchema.pick({ email: true }).parse({ email });
        setErrors({});
      } catch (err) {
        if (err instanceof z.ZodError) {
           setErrors({ email: err.issues[0]?.message || 'Invalid email' });
        }
        return;
      }
    } else {
      if (!validateForm()) return;
    }
    
    setIsSubmitting(true);

    try {
      if (isPasswordRecovery) {
        const { error } = await updatePassword(password);
        if (error) {
          setErrors({ password: error.message });
        } else {
          setPassword('');
          setConfirmPassword('');
          clearPasswordRecovery();
        }
      } else if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          setErrors({ email: error.message });
        } else {
          setEmail('');
          setIsForgotPassword(false);
        }
      } else if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          setErrors({ email: error.message || 'Sign up failed' });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setErrors({ email: error.message || 'Sign in failed' });
        }
      }
    } catch (err) {
      setErrors({ email: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <ScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, backgroundColor: appTheme.colors.background }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 32, alignItems: 'center' }}>
          <Text variant="displaySmall" style={{ fontWeight: 'bold', marginBottom: 8 }}>
            CashTrack
          </Text>
          <Text variant="bodyMedium" style={{ color: appTheme.colors.onSurfaceVariant }}>
            Credit Card Rewards Tracker
          </Text>
        </View>

        <Card style={{ marginBottom: 32, backgroundColor: appTheme.colors.surface }}>
          <Card.Content style={{ paddingTop: 24, paddingBottom: 24 }}>
            <Text
              variant="headlineSmall"
              style={{ textAlign: 'center', marginBottom: 8, fontWeight: 'bold' }}
            >
              {isPasswordRecovery ? 'Set New Password' : isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text
              variant="bodySmall"
              style={{ textAlign: 'center', color: appTheme.colors.onSurfaceVariant, marginBottom: 24 }}
            >
              {isPasswordRecovery
                ? 'Enter your new password below'
                : isForgotPassword
                ? 'Enter your email to receive a password reset link'
                : isSignUp
                ? 'Start tracking your credit card rewards'
                : 'Sign in to continue tracking your rewards'}
            </Text>

            {!isForgotPassword && !isPasswordRecovery && (
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  mode="outlined"
                />
                {errors.email && <HelperText type="error">{errors.email}</HelperText>}
              </View>
            )}

            {isForgotPassword && (
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  mode="outlined"
                />
                {errors.email && <HelperText type="error">{errors.email}</HelperText>}
              </View>
            )}

            {isPasswordRecovery && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <TextInput
                    label="New Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
                    editable={!isSubmitting}
                    mode="outlined"
                  />
                  {errors.password && <HelperText type="error">{errors.password}</HelperText>}
                </View>
                <View style={{ marginBottom: 16 }}>
                  <TextInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    right={<TextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword(!showConfirmPassword)} />}
                    editable={!isSubmitting}
                    mode="outlined"
                  />
                  {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword}</HelperText>}
                </View>
              </>
            )}

            {!isForgotPassword && !isPasswordRecovery && (
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
                  editable={!isSubmitting}
                  mode="outlined"
                />
                {errors.password && <HelperText type="error">{errors.password}</HelperText>}
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{ marginTop: 16 }}
            >
              {isPasswordRecovery ? 'Update Password' : isForgotPassword ? 'Reset Password' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>

            {!isPasswordRecovery && (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Button
                  mode="text"
                  onPress={() => {
                    if (isForgotPassword) {
                      setIsForgotPassword(false);
                      setEmail('');
                      setErrors({});
                    } else {
                      setIsSignUp(!isSignUp);
                      setEmail('');
                      setPassword('');
                      setErrors({});
                    }
                  }}
                  disabled={isSubmitting}
                >
                  {isForgotPassword
                    ? "Remember your password? Sign In"
                    : isSignUp
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Sign Up"}
                </Button>

                {!isSignUp && !isForgotPassword && (
                  <Button
                    mode="text"
                    onPress={() => {
                      setIsForgotPassword(true);
                      setEmail('');
                      setPassword('');
                      setErrors({});
                    }}
                    disabled={isSubmitting}
                  >
                    Forgot Password?
                  </Button>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        <Text
          variant="bodySmall"
          style={{ textAlign: 'center', color: appTheme.colors.onSurfaceVariant, marginTop: 16 }}
        >
          By continuing, you agree to track your rewards responsibly and securely.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
