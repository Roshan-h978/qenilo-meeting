import React, { useState } from 'react';
import AuthLayout from '../components/AuthLayout.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';

export default function RegisterPage({ onRegister, onGoogleSignIn, googleClientId, onSignIn, error, connectionError, busy, onRetry, onClose }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setFormError('The passwords do not match.');
      return;
    }
    setFormError('');
    onRegister({ username: username.trim(), email: email.trim(), password });
  };

  return <AuthLayout title="Create your account" description="Set up an account to keep your QENILO workspace private." onClose={onClose} closeDisabled={busy} footer={<span>Already have an account? <button className="auth-link" onClick={onSignIn}>Sign in</button></span>}>
    {connectionError && <div className="auth-alert" role="alert"><span>{connectionError}</span><button onClick={onRetry}>Retry</button></div>}
    {(formError || error) && <div className="auth-error" role="alert">{formError || error}</div>}
    <form className="auth-form" onSubmit={submit}>
      <label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} maxLength={150} required/></label>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required/></label>
      <label>Password<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required/></label>
      <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} required/></label>
      <button className="auth-submit" type="submit" disabled={busy || Boolean(connectionError)}>{busy ? 'Creating account…' : 'Create account'}</button>
    </form>
    <div className="auth-divider"><span>or continue with</span></div>
    <GoogleSignInButton clientId={googleClientId} onCredential={onGoogleSignIn} disabled={busy || Boolean(connectionError)}/>
  </AuthLayout>;
}
