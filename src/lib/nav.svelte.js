export const tabs = [
  { id: 'home', label: 'Главная', icon: '🏠' },
  { id: 'ops', label: 'Операции', icon: '🧾' },
  { id: 'budget', label: 'Бюджет', icon: '🎯' },
  { id: 'accounts', label: 'Счета', icon: '💳' },
  { id: 'more', label: 'Ещё', icon: '⋯' }
];
export const moreItems = [
  { id: 'analytics', label: 'Аналитика', icon: '📊' },
  { id: 'rules', label: 'Правила', icon: '🧠' },
  { id: 'import', label: 'Импорт', icon: '📥' },
  { id: 'mono', label: 'Monobank', icon: '🏦' },
  { id: 'status', label: 'Статус', icon: '🩺' },
  { id: 'backup', label: 'Резервная копия', icon: '💾' }
];
export const nav = $state({ tab: 'home', sub: null });
export const titleOf = (id) =>
  [...tabs, ...moreItems].find((x) => x.id === id)?.label ?? '';
