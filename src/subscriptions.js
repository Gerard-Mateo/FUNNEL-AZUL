// Subscription date helpers (pure functions, no I/O).
// Dates are plain 'YYYY-MM-DD' strings in Ecuador time.

export const todayEC = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });

// Same day N months later; clamps to the month's last day (Jan 31 + 1 month = Feb 28/29).
export function addMonths(isoDate, months) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const daysUntil = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// Active subscriptions whose next delivery is close and that weren't reminded for it yet.
export const dueForReminder = (subs, today, daysBefore) =>
  subs.filter(
    (s) => s.status === 'active' && s.remindedFor !== s.nextShipDate && daysUntil(today, s.nextShipDate) <= daysBefore
  );

export const freqLabel = (months) => (months === 1 ? 'cada mes' : `cada ${months} meses`);
export const planName = (plan) => (plan === 'annual' ? 'Plan Anual' : 'Club Azul');

export const formatDate = (isoDate) =>
  new Date(isoDate + 'T12:00:00Z').toLocaleDateString('es-EC', { day: 'numeric', month: 'long', timeZone: 'UTC' });
