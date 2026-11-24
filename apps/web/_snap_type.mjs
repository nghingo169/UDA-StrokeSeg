import fs from "node:fs";

const file = new URL("./src/index.css", import.meta.url);
let css = fs.readFileSync(file, "utf8");

const scale = [10, 12, 14, 16, 18];
function snap(n) {
  if (scale.includes(n)) return n;
  if (n <= 11) return 10;
  if (n <= 13) return 14;
  if (n <= 15) return 16;
  return 18;
}

const counts = new Map();
function note(from, to) {
  const key = `${from}→${to}`;
  counts.set(key, (counts.get(key) || 0) + 1);
}

css = css.replace(
  /\/\* Type scale[^*]*\*\/\s*--text-xs:\s*12px;\s*--text-sm:\s*13px;\s*--text-base:\s*14px;\s*--text-md:\s*16px;\s*--text-lg:\s*20px;\s*--text-xl:\s*28px;/,
  `/* Type scale — 18 / 16 / 14 / 12 / 10 */
  --text-2xs: 10px;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 18px;`,
);

css = css.replace(/font-size:\s*clamp\([^;]+\)/g, () => {
  note("clamp", 18);
  return "font-size: 18px";
});

css = css.replace(/(?<![\w-])font:\s*([^;]*?)clamp\([^)]+\)/g, (_, pre) => {
  note("font-clamp", 18);
  return `font: ${pre}18px`;
});

css = css.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_, raw) => {
  const next = snap(Number(raw));
  if (next !== Number(raw)) note(`${raw}px`, next);
  return `font-size: ${next}px`;
});

css = css.replace(/(?<![\w-])font:\s*([^;]*?)\b(\d+(?:\.\d+)?)px\b/g, (_, pre, raw) => {
  const next = snap(Number(raw));
  if (next !== Number(raw)) note(`font ${raw}px`, next);
  return `font: ${pre}${next}px`;
});

fs.writeFileSync(file, css);
console.log([...counts.entries()].sort().map(([k, v]) => `${k}  ${v}`).join("\n"));
