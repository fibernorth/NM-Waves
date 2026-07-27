import { format } from 'date-fns';

/**
 * Calendar helpers: per-event "Add to Google Calendar" links and a multi-event
 * .ics download that works with Google Calendar, Apple Calendar, and Outlook.
 * Times are emitted as floating local times so an event at 9:00 AM in Traverse
 * City shows as 9:00 AM regardless of the subscriber's device timezone config.
 */

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
}

/** The club's local timezone — events are entered as Traverse City wall time. */
const TIMEZONE = 'America/Detroit';

const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");

/** UTC timestamp for RFC-5545 DTSTAMP (e.g. 20260726T123456Z). */
const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Best-effort "9:00 AM" → Date on the given day; falls back to a default hour. */
export const timeOnDate = (day: Date, time: string, fallbackHour: number): Date => {
  const d = new Date(day);
  const m = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if ((m[3] || '').toLowerCase() === 'pm') h += 12;
    d.setHours(h, m[2] ? parseInt(m[2], 10) : 0, 0, 0);
  } else {
    d.setHours(fallbackHour, 0, 0, 0);
  }
  return d;
};

/** URL that opens Google Calendar's "add event" screen pre-filled. */
export const googleCalendarUrl = (e: CalendarEvent): string => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(e.end)}`,
    // Without ctz, Google interprets the timezone-less times as UTC, shifting
    // a 9:00 AM ET event to ~5:00 AM. Pin it to the club's timezone.
    ctz: TIMEZONE,
  });
  if (e.location) params.set('location', e.location);
  if (e.description) params.set('details', e.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Build a .ics file body for one or more events. */
export const buildIcs = (events: CalendarEvent[]): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northern Michigan Waves//Club Management//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const stamp = fmtUtc(new Date());
  events.forEach((e, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:nmwaves-${stamp}-${i}@nmwaves`,
      `DTSTAMP:${stamp}`,
      // DTSTART/DTEND are intentionally floating local times (see file header).
      `DTSTART:${fmt(e.start)}`,
      `DTEND:${fmt(e.end)}`,
      `SUMMARY:${icsEscape(e.title)}`,
      ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

/** Trigger a browser download of the events as an .ics file. */
export const downloadIcs = (events: CalendarEvent[], filename = 'nm-waves-events.ics'): void => {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
