import { readFile, writeFile } from 'node:fs/promises';
import { loadSudokuTools } from './load-sudoku-tools.mjs';

const sourcePath = new URL('../data/sudoku-seed-catalog.json', import.meta.url);
const impossibleSourcePath = new URL(
  '../data/sudoku-impossible-seed-catalog.json',
  import.meta.url,
);
const outputPath = new URL('../data/sudoku-level-catalog.json', import.meta.url);
const difficulties = ['Normal', 'Hard', 'Intense', 'Impossible'];

const serializeGrid = (grid) => grid.map((row) => row.join('')).join('/');

const seedCatalog = JSON.parse(await readFile(sourcePath, 'utf8'));
const impossibleSeedCatalog = JSON.parse(
  await readFile(impossibleSourcePath, 'utf8'),
);
seedCatalog.seeds.Impossible = impossibleSeedCatalog.seeds;
const { generateCandidateFromSeed } = await loadSudokuTools();
const levels = {};

for (const difficulty of difficulties) {
  const seeds = seedCatalog.seeds?.[difficulty];
  if (!Array.isArray(seeds) || seeds.length !== 300) {
    throw new Error(`${difficulty} must contain exactly 300 approved seeds.`);
  }

  levels[difficulty] = seeds.map((seed) => {
    const { initial, solved } = generateCandidateFromSeed(difficulty, seed);
    return {
      seed,
      puzzle: serializeGrid(
        initial.map((row) => row.map((cell) => cell.value ?? 0)),
      ),
      solution: serializeGrid(solved),
    };
  });
}

await writeFile(
  outputPath,
  `${JSON.stringify({
    version: 1,
    source: 'sudoku-seed-catalog.json',
    purpose: 'Pre-approved runtime boards for Normal, Hard, Intense, and Impossible.',
    levels,
  })}\n`,
);

console.log(`Wrote ${difficulties.length * 300} prebuilt levels to ${outputPath.pathname}`);
