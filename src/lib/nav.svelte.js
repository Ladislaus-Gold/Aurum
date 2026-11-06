export const tabs = [
  { id: 'home', label: 'Главная' },
  { id: 'accounts', label: 'Счета' },
  { id: 'ops', label: 'Операции' },
  { id: 'budget', label: 'Бюджет' },
  { id: 'more', label: 'Ещё' }
];
export const moreItems = [
  { id: 'analytics', label: 'Аналитика', icon: 'chart', group: 'Умные функции' },
  { id: 'rules', label: 'Правила', icon: 'rule', group: 'Умные функции' },
  { id: 'import', label: 'Импорт', icon: 'imp', group: 'Деньги' },
  { id: 'mono', label: 'Monobank', icon: 'bank', group: 'Деньги' },
  { id: 'status', label: 'Статус', icon: 'stat', group: 'Система' },
  { id: 'backup', label: 'Резервная копия', icon: 'save', group: 'Деньги' }
];
export const nav = $state({ tab: 'home', sub: null, newOp: false, edit: null, preAcc: 0, rev: 0 });
export const titleOf = (id) =>
  [...tabs, ...moreItems].find((x) => x.id === id)?.label ?? '';
