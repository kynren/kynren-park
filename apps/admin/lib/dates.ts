/** Today's date in the park's own timezone, as YYYY-MM-DD (what the date pickers and the API both use). */
export const todayUk = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
