import { useCallback, useEffect, useState } from 'react';

async function readResponse(response) {
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail || Object.values(data).flat().find(value => typeof value === 'string');
    throw new Error(detail || 'The request could not be completed.');
  }
  return data;
}

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setConnectionError('');
    try {
      const response = await fetch('/api/auth/me/', { credentials: 'same-origin' });
      if (response.status === 403 || response.status === 401) {
        setUser(null);
        return null;
      }
      const data = await readResponse(response);
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      setConnectionError('Can’t reach the account service. Start the backend, then try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const getCsrfToken = async () => {
    const response = await fetch('/api/auth/csrf/', { credentials: 'same-origin' });
    const data = await readResponse(response);
    return data.csrfToken;
  };

  const submitCredentials = async (path, values) => {
    setBusy(true);
    setError('');
    setConnectionError('');
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify(values),
      });
      const data = await readResponse(response);
      setUser(data.user);
      return true;
    } catch (requestError) {
      if (requestError instanceof TypeError) {
        setConnectionError('Can’t reach the account service. Start the backend, then try again.');
      } else {
        setError(requestError.message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const signIn = (values) => submitCredentials('/api/auth/login/', values);
  const register = (values) => submitCredentials('/api/auth/register/', values);
  const googleSignIn = (credential) => submitCredentials('/api/auth/google/', { credential });

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/auth/logout/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken },
      });
      await readResponse(response);
      setUser(null);
      return true;
    } catch {
      setError('Could not sign out. Check the account service and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { user, loading, busy, error, connectionError, clearError: () => setError(''), signIn, register, googleSignIn, signOut, refreshSession };
}
