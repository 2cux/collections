import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calendar, useToday } from './components/calendar/calendar';

function HomeCalendar() {
  const today = useToday();
  const [selection, setSelection] = useState();
  return <Calendar value={selection ?? today} onChange={setSelection} locale="zh-CN" showToday />;
}

export function mountCalendar() {
  const root = createRoot(document.querySelector('#calendar-root'));
  root.render(<HomeCalendar />);
  return () => root.unmount();
}
