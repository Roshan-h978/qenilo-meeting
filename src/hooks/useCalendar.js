import { useEffect, useState } from 'react';

function readMeetings() {
  try {
    const value = JSON.parse(window.localStorage.getItem('qenilo-scheduled-meetings') || '[]');
    return Array.isArray(value) ? value
      .filter(item => item?.title && item?.startsAt)
      .map(item => ({ id: item.id || crypto.randomUUID(), title: item.title, startsAt: item.startsAt })) : [];
  } catch {
    return [];
  }
}

export const toLocalDateTime = (date) => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const defaultScheduleDate = () => {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  nextHour.setMinutes(0, 0, 0);
  return toLocalDateTime(nextHour);
};

export default function useCalendar(onToast) {
  const [meetings, setMeetings] = useState(readMeetings);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultScheduleDate);

  useEffect(() => {
    try { window.localStorage.setItem('qenilo-scheduled-meetings', JSON.stringify(meetings)); } catch { /* Browser storage can be disabled. */ }
  }, [meetings]);

  const upcomingMeetings = meetings.filter(item => new Date(item.startsAt) > new Date());

  const scheduleMeeting = (event) => {
    event.preventDefault();
    const meetingTitle = title.trim();
    const startsAt = new Date(date);
    if (!meetingTitle || Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
      onToast('Choose a title and a future date and time');
      return;
    }
    setMeetings(items => [...items, { id: crypto.randomUUID(), title: meetingTitle, startsAt: startsAt.toISOString() }].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    setTitle('');
    setDate(defaultScheduleDate());
    onToast('Meeting added to your calendar');
  };

  return { meetings: upcomingMeetings, title, setTitle, date, setDate, scheduleMeeting };
}
