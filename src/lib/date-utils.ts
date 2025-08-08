export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDisplayDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getToday(): string {
  return formatDate(new Date());
}

export function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
}

export function getMonthInfo(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  return {
    year,
    month: month + 1, // API expects 1-based month
    monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    firstDay: new Date(year, month, 1),
    lastDay: new Date(year, month + 1, 0),
  };
}

export function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const days = [];
  const currentDate = new Date(startDate);
  
  // Generate 42 days (6 weeks)
  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(currentDate),
      dateString: formatDate(currentDate),
      isCurrentMonth: currentDate.getMonth() === month,
      isToday: formatDate(currentDate) === getToday(),
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}
