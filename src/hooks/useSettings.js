import { useEffect, useState } from 'react';

function readSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('qenilo-settings') || '{}');
    return {
      displayName: typeof saved.displayName === 'string' ? saved.displayName : '',
      microphoneOn: typeof saved.microphoneOn === 'boolean' ? saved.microphoneOn : true,
      cameraOn: typeof saved.cameraOn === 'boolean' ? saved.cameraOn : true,
      noiseSuppression: typeof saved.noiseSuppression === 'boolean' ? saved.noiseSuppression : true,
      echoCancellation: typeof saved.echoCancellation === 'boolean' ? saved.echoCancellation : true,
      autoGainControl: typeof saved.autoGainControl === 'boolean' ? saved.autoGainControl : true,
    };
  } catch {
    return { displayName: '', microphoneOn: true, cameraOn: true, noiseSuppression: true, echoCancellation: true, autoGainControl: true };
  }
}

export default function useSettings() {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    try { window.localStorage.setItem('qenilo-settings', JSON.stringify(settings)); } catch { /* Browser storage can be disabled. */ }
  }, [settings]);

  return [settings, setSettings];
}
