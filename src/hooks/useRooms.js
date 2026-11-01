import { useState } from 'react';

async function readResponse(response) {
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail || Object.values(data).flat().find(value => typeof value === 'string');
    throw new Error(detail || 'The meeting room request could not be completed.');
  }
  return data;
}

export default function useRooms(onToast) {
  const [busy, setBusy] = useState(false);

  const getCsrfToken = async () => {
    const response = await fetch('/api/auth/csrf/', { credentials: 'same-origin' });
    return (await readResponse(response)).csrfToken;
  };

  const createRoom = async title => {
    setBusy(true);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/rooms/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({ title }),
      });
      return await readResponse(response);
    } catch (error) {
      onToast(error instanceof TypeError
        ? 'Could not reach the meeting service. Check that the backend is running.'
        : error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async code => {
    setBusy(true);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(code.trim())}/join/`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken },
      });
      return await readResponse(response);
    } catch (error) {
      onToast(error instanceof TypeError
        ? 'Could not reach the meeting service. Check that the backend is running.'
        : error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const leaveRoom = async code => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/leave/`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken },
      });
      await readResponse(response);
    } catch {
      onToast('Your local workspace ended, but the server could not update room presence.');
    }
  };

  return { busy, createRoom, joinRoom, leaveRoom };
}
