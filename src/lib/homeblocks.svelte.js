// Блоки Главной: порядок и видимость, хранятся на устройстве
const KEY = 'aurum.homeBlocks';
export const BLOCKS = {
  balance: { name: 'Общий баланс', icon: 'wallet' },
  budget: { name: 'Бюджет', icon: 'chart' },
  flow: { name: 'Денежный поток', icon: 'swap' },
  recent: { name: 'Последние операции', icon: 'clock' }
};
const DEFAULT = ['balance', 'budget', 'flow', 'recent'].map((id) => ({ id, on: true }));

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(v)) {
      const known = v.filter((x) => BLOCKS[x.id]).map((x) => ({ id: x.id, on: x.on !== false }));
      for (const d of DEFAULT) if (!known.some((x) => x.id === d.id)) known.push({ ...d });
      return known;
    }
  } catch {}
  return DEFAULT.map((x) => ({ ...x }));
}

export const hb = $state({ list: load() });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(hb.list)); } catch {} };

export function moveBlock(from, to) {
  if (from === to || to < 0 || to >= hb.list.length) return;
  const a = hb.list.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x);
  hb.list = a; save();
}
export function toggleBlock(id) {
  hb.list = hb.list.map((x) => (x.id === id ? { ...x, on: !x.on } : x)); save();
}
