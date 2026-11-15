const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "13 Nov 2026". Written by hand so it looks the same on every phone, whatever Intl support it has.
export function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
