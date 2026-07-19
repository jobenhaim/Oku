import fs from 'node:fs';
import path from 'node:path';

const output = process.argv[2] || 'data/puzzles-v2.json';
const inputs = process.argv.slice(3);
if (!inputs.length) throw new Error('Provide the partial catalog files to merge.');

const merged = { version: 2, levels: {}, metadata: {} };
for (const file of inputs) {
  const partial = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(merged.levels, partial.levels);
  Object.assign(merged.metadata, partial.metadata);
}

// Parallel catalog generation can reuse a solved grid across difficulties.
// Relabeling digits preserves the puzzle's exact logical structure while making
// every final solution visually distinct throughout the complete catalog.
const solutions = new Set();
let permutationSeed = 0x0A0C2026;
const next = () => {
  let t = permutationSeed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const shuffledDigits = () => {
  const digits = [1,2,3,4,5,6,7,8,9];
  for (let i=digits.length-1;i>0;i--) {
    const j=Math.floor(next()*(i+1));
    [digits[i],digits[j]]=[digits[j],digits[i]];
  }
  return digits;
};
const relabel = (text, digits) => text.replace(/[1-9]/g, value => String(digits[Number(value)-1]));

for (const entries of Object.values(merged.levels)) for (let i=0;i<entries.length;i++) {
  const puzzle=entries[i].slice(0,81), solution=entries[i].slice(81);
  if (!solutions.has(solution)) { solutions.add(solution); continue; }
  let nextPuzzle=puzzle, nextSolution=solution;
  do {
    const digits=shuffledDigits();
    nextPuzzle=relabel(puzzle,digits);
    nextSolution=relabel(solution,digits);
  } while (solutions.has(nextSolution));
  entries[i]=nextPuzzle+nextSolution;
  solutions.add(nextSolution);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(merged));
console.log(`Merged ${solutions.size} puzzles into ${output}`);
