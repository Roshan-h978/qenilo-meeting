import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  FileText,
  Maximize,
  Menu,
  Mic,
  MicOff,
  Minimize,
  Phone,
  Plus,
  Settings2,
  ScreenShare,
  Trash2,
  UsersRound,
  Video,
  VideoOff,
  X,
} from 'lucide-react';

const icons = {
  arrow: ArrowRight,
  calendar: CalendarDays,
  check: Check,
  clock: Clock3,
  close: X,
  copy: Copy,
  fullscreen: Maximize,
  menu: Menu,
  mic: Mic,
  micOff: MicOff,
  exitFullscreen: Minimize,
  phone: Phone,
  plus: Plus,
  settings: Settings2,
  share: ScreenShare,
  trash: Trash2,
  users: UsersRound,
  video: Video,
  cameraOff: VideoOff,
  note: FileText,
};

export default function Icon({ name, size = 18, strokeWidth = 1.8, className }) {
  const IconComponent = icons[name];
  if (!IconComponent) return null;
  return <IconComponent
    size={size}
    strokeWidth={strokeWidth}
    className={className}
    aria-hidden="true"
    focusable="false"
  />;
}
