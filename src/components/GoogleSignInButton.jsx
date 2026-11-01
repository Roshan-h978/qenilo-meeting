import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'google-identity-services';

export default function GoogleSignInButton({ clientId, onCredential, disabled }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [status, setStatus] = useState('');
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    let script = document.getElementById(SCRIPT_ID);

    const render = () => {
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: response => {
          if (!cancelled && response.credential) onCredentialRef.current(response.credential);
        },
        auto_select: false,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(buttonRef.current.clientWidth || 360, 400),
      });
      setStatus('');
    };

    if (window.google?.accounts?.id) {
      render();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      const onLoad = () => render();
      const onError = () => !cancelled && setStatus('Google sign-in could not load. Check your connection and try again.');
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      if (script.dataset.loaded === 'true') render();
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; }, { once: true });
      return () => {
        cancelled = true;
        script?.removeEventListener('load', onLoad);
        script?.removeEventListener('error', onError);
      };
    }

    return () => { cancelled = true; };
  }, [clientId]);

  if (!clientId) return <div className="google-signin-wrap">
    <button className="google-signin-unconfigured" type="button" disabled>Continue with Google</button>
    <small>Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</small>
  </div>;

  return <div className={`google-signin-wrap ${disabled ? 'is-disabled' : ''}`} aria-busy={disabled}>
    <div className="google-signin-button" ref={buttonRef}/>
    {disabled && <div className="google-signin-blocker" aria-hidden="true"/>}
    {status && <small role="status">{status}</small>}
  </div>;
}
