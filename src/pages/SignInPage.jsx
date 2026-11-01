import React, { useState } from 'react';
import AuthLayout from '../components/AuthLayout.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';

export default function SignInPage({ onSignIn, onGoogleSignIn, googleClientId, onRegister, error, connectionError, busy, onRetry, onClose }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event) => {
    event.preventDefault();
    onSignIn({ identifier: identifier.trim(), password });
  };

  return <AuthLayout title="Welcome back" description="Sign in to open your QENILO workspace." onClose={onClose} closeDisabled={busy} footer={<span>New to QENILO? <button className="auth-link" onClick={onRegister}>Create an account</button></span>}>
    {connectionError && <div className="auth-alert" role="alert"><span>{connectionError}</span><button onClick={onRetry}>Retry</button></div>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    <form className="auth-form" onSubmit={submit}>
      <label>Username or email<input autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} required autoFocus/></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>
      <button className="auth-submit" type="submit" disabled={busy || Boolean(connectionError)}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <div className="auth-divider"><span>or continue with</span></div>
    <GoogleSignInButton clientId={googleClientId} onCredential={onGoogleSignIn} disabled={busy || Boolean(connectionError)}/>
  </AuthLayout>;
}
