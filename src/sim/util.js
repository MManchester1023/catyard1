// Shared constants and small helpers. No DOM, no state.
export const W = 960, H = 600, GY0 = 236, GY1 = 572;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
export const uid = () => Math.random().toString(36).slice(2, 9);
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const NAMES = ['Miso', 'Pickles', 'Juniper', 'Biscuit', 'Mochi', 'Gizmo', 'Waffles', 'Nori', 'Pepper', 'Clementine', 'Tofu', 'Sprout', 'Maple', 'Ziggy', 'Olive', 'Pudding', 'Basil', 'Fig'];
export const COATS = ['orange', 'grey', 'black', 'calico'];
export const COAT_LABEL = { orange: 'orange tabby', grey: 'grey tabby', black: 'black', calico: 'calico' };

// things a collector cat can fall for
export const ITEM_TYPES = ['bottlecap', 'feather', 'button', 'marble'];
export const ITEM_LABEL = { bottlecap: 'bottle cap', feather: 'feather', button: 'button', marble: 'marble', twine: 'bit of string', bark: 'piece of bark', twig: 'twig', coin: 'coin' };
export const ITEM_PLURAL = { bottlecap: 'bottle caps', feather: 'feathers', button: 'buttons', marble: 'marbles', twine: 'bits of string', bark: 'pieces of bark', twig: 'twigs', coin: 'coins' };
export const COLORS = {
  red: '#d9453b', orange: '#ee8a2e', yellow: '#f0cd3d', green: '#58a95b', teal: '#2fa5a0',
  blue: '#3f76d6', purple: '#8a5bc8', pink: '#e780ab', white: '#f1eee6', black: '#2b2830',
};
export const COLOR_NAMES = Object.keys(COLORS);
export const FEATHER_COLORS = ['white', 'blue', 'black', 'orange', 'teal'];

export const PLACE_LABEL = {
  house: 'the cabin', bowl: 'the food bowl', water: 'the water bowl', cushion: 'the cushion', post: 'the scratching post',
  pond: 'the pond', flowers: 'the flower bed', tree: 'the old oak', fence: 'the fence', yarn: 'the ball of yarn',
  easel: 'the easel', stash: 'the stash', glass: 'the glass', mat: 'the mat', tablet: 'the tablet', table: 'the bark table', craft: 'the workbench',
};

// things the cat gathers and makes with. bark and twigs come from the oak, and birds sometimes drop any of the three;
// twine is otherwise only given by the human (or pulled from the cushion once it has worked out how)
export const MATERIALS = ['bark', 'twig', 'twine'];
export const MAT_CAP = 12; // how many of each it can carry
export const MAT_LABEL = { bark: 'piece of bark', twig: 'twig', twine: 'length of twine', frame: 'oak frame' };
export const MAT_PLURAL = { bark: 'pieces of bark', twig: 'twigs', twine: 'lengths of twine', frame: 'oak frames' };
export const MAT_GIFT = { bark: 2, twig: 2, twine: 1 }; // how many one offering of it is worth
export const matText = (type, n = 1) => `${n} ${n === 1 ? MAT_LABEL[type] : MAT_PLURAL[type]}`;
