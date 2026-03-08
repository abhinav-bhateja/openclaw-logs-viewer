// Post-build: replace oklch() with hex, strip color-mix @supports, remove @property
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Tailwind v4 oklch → hex mapping (from tailwindcss.com/docs/colors)
const OKLCH_TO_HEX = {
  'oklch(96.2% .059 95.617)': '#fef3c7',   // amber-100
  'oklch(92.4% .12 95.746)': '#fde68a',    // amber-200
  'oklch(87.9% .169 91.605)': '#fcd34d',   // amber-300
  'oklch(82.8% .189 84.429)': '#fbbf24',   // amber-400
  'oklch(76.9% .188 70.08)': '#f59e0b',    // amber-500
  'oklch(93.2% .032 255.585)': '#dbeafe',   // blue-100
  'oklch(88.2% .059 254.128)': '#bfdbfe',   // blue-200
  'oklch(80.9% .105 251.813)': '#93c5fd',   // blue-300
  'oklch(70.7% .165 254.624)': '#60a5fa',   // blue-400
  'oklch(62.3% .214 259.815)': '#3b82f6',   // blue-500
  'oklch(97% .014 254.604)': '#eff6ff',     // blue-50
  'oklch(54.6% .245 262.881)': '#2563eb',   // blue-600
  'oklch(95.6% .045 203.388)': '#cffafe',   // cyan-100
  'oklch(91.7% .08 205.041)': '#a5f3fc',    // cyan-200
  'oklch(78.9% .154 211.53)': '#22d3ee',    // cyan-400
  'oklch(90.5% .093 164.15)': '#a7f3d0',    // emerald-200
  'oklch(84.5% .143 164.978)': '#6ee7b7',   // emerald-300
  'oklch(76.5% .177 163.223)': '#34d399',   // emerald-400
  'oklch(69.6% .17 162.48)': '#10b981',     // emerald-500
  'oklch(82.7% .119 306.383)': '#d8b4fe',   // purple-300
  'oklch(71.4% .203 305.504)': '#c084fc',   // purple-400
  'oklch(62.7% .265 303.9)': '#a855f7',     // purple-500
  'oklch(88.5% .062 18.334)': '#fecaca',    // red-200
  'oklch(80.8% .114 19.571)': '#fca5a5',    // red-300
  'oklch(63.7% .237 25.331)': '#ef4444',    // red-500
  'oklch(50.5% .213 27.518)': '#b91c1c',    // red-700
  'oklch(96.8% .007 247.896)': '#f1f5f9',   // slate-100
  'oklch(92.9% .013 255.508)': '#e2e8f0',   // slate-200
  'oklch(86.9% .022 252.894)': '#cbd5e1',   // slate-300
  'oklch(70.4% .04 256.788)': '#94a3b8',    // slate-400
  'oklch(55.4% .046 257.417)': '#64748b',   // slate-500
  'oklch(44.6% .043 257.281)': '#475569',   // slate-600
  'oklch(37.2% .044 257.287)': '#334155',   // slate-700
  'oklch(27.9% .041 260.031)': '#1e293b',   // slate-800
  'oklch(20.8% .042 265.755)': '#0f172a',   // slate-900
  'oklch(12.9% .042 264.695)': '#020617',   // slate-950
};

const dir = join(process.cwd(), 'dist', 'assets');
const cssFiles = readdirSync(dir).filter(f => f.endsWith('.css'));

for (const file of cssFiles) {
  const filePath = join(dir, file);
  let css = readFileSync(filePath, 'utf8');
  const origLen = css.length;

  // 1. Replace oklch() values with hex
  for (const [oklch, hex] of Object.entries(OKLCH_TO_HEX)) {
    while (css.includes(oklch)) {
      css = css.replace(oklch, hex);
    }
  }

  // 2. Remove @supports color-mix blocks (progressive enhancement — hex fallbacks are sufficient)
  // These look like: @supports (color:color-mix(in lab,red,red)){.selector{prop:value}}
  // Can be nested, so we need to handle brace matching
  let result = '';
  let i = 0;
  while (i < css.length) {
    // Check for @supports (color:color-mix
    if (css.startsWith('@supports', i) && css.indexOf('color-mix', i) < css.indexOf('{', i)) {
      // Skip this entire @supports block
      let braceDepth = 0;
      let j = css.indexOf('{', i);
      if (j === -1) { result += css[i]; i++; continue; }
      braceDepth = 1;
      j++;
      while (j < css.length && braceDepth > 0) {
        if (css[j] === '{') braceDepth++;
        else if (css[j] === '}') braceDepth--;
        j++;
      }
      i = j; // skip past the block
    } else {
      result += css[i];
      i++;
    }
  }
  css = result;

  // 3. Remove @property declarations (not supported in Safari 15)
  result = '';
  i = 0;
  while (i < css.length) {
    if (css.startsWith('@property', i)) {
      let j = css.indexOf('{', i);
      if (j === -1) { result += css[i]; i++; continue; }
      let braceDepth = 1;
      j++;
      while (j < css.length && braceDepth > 0) {
        if (css[j] === '{') braceDepth++;
        else if (css[j] === '}') braceDepth--;
        j++;
      }
      i = j;
    } else {
      result += css[i];
      i++;
    }
  }
  css = result;

  // 4. Also catch any remaining color-mix() in the placeholder @supports block
  // The placeholder fallback uses: color:color-mix(in oklab,currentcolor 50%,transparent)
  // Replace with a simple fallback
  css = css.replace(/color-mix\(in oklab,currentcolor 50%,transparent\)/g, 'currentcolor');

  writeFileSync(filePath, css);
  const remaining_oklch = (css.match(/oklch/g) || []).length;
  const remaining_colormix = (css.match(/color-mix/g) || []).length;
  const remaining_property = (css.match(/@property/g) || []).length;
  console.log(`${file}: ${origLen} → ${css.length} bytes`);
  console.log(`  oklch: ${remaining_oklch}, color-mix: ${remaining_colormix}, @property: ${remaining_property}`);
}
