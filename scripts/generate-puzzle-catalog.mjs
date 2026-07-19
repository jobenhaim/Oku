import fs from 'node:fs';
import path from 'node:path';

const ALL = 0x1ff;
const bit = n => 1 << (n - 1);
const pop = n => {
  let count = 0;
  while (n) { n &= n - 1; count++; }
  return count;
};
const oneValue = mask => Math.log2(mask) + 1;

class RNG {
  constructor(seed) { this.seed = seed >>> 0; }
  next() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  int(max) { return Math.floor(this.next() * max); }
  shuffle(values) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }
}

const valid = (board, row, col, value) => {
  for (let i = 0; i < 9; i++) if (board[row][i] === value || board[i][col] === value) return false;
  const sr = Math.floor(row / 3) * 3;
  const sc = Math.floor(col / 3) * 3;
  for (let r = sr; r < sr + 3; r++) for (let c = sc; c < sc + 3; c++) if (board[r][c] === value) return false;
  return true;
};

const generateSolution = rng => {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  const fill = index => {
    if (index === 81) return true;
    const r = Math.floor(index / 9), c = index % 9;
    for (const n of rng.shuffle([1,2,3,4,5,6,7,8,9])) {
      if (!valid(board, r, c, n)) continue;
      board[r][c] = n;
      if (fill(index + 1)) return true;
      board[r][c] = 0;
    }
    return false;
  };
  fill(0);
  return board;
};

const countSolutions = (board, limit = 2) => {
  let target = null, targetMask = 0, best = 10;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!board[r][c]) {
    let mask = 0;
    for (let n = 1; n <= 9; n++) if (valid(board, r, c, n)) mask |= bit(n);
    const size = pop(mask);
    if (!size) return 0;
    if (size < best) { best = size; target = [r, c]; targetMask = mask; }
  }
  if (!target) return 1;
  let count = 0;
  const [r, c] = target;
  for (let n = 1; n <= 9 && count < limit; n++) if (targetMask & bit(n)) {
    board[r][c] = n;
    count += countSolutions(board, limit - count);
    board[r][c] = 0;
  }
  return count;
};

const units = [];
for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => [r, c]));
for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => [r, c]));
for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
  const cells = [];
  for (let r = br * 3; r < br * 3 + 3; r++) for (let c = bc * 3; c < bc * 3 + 3; c++) cells.push([r, c]);
  units.push(cells);
}

class HumanSolver {
  constructor(puzzle) {
    this.grid = puzzle.map(row => [...row]);
    this.masks = Array.from({ length: 9 }, () => Array(9).fill(ALL));
    this.invalid = false;
    this.stats = { naked: 0, hidden: 0, locked: 0, pairs: 0, triples: 0, xwing: 0 };
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (this.grid[r][c]) this.masks[r][c] = bit(this.grid[r][c]);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (this.grid[r][c]) this.removeFromPeers(r, c, this.grid[r][c]);
  }
  remove(r, c, value) {
    if (this.grid[r][c]) return false;
    const b = bit(value);
    if (!(this.masks[r][c] & b)) return false;
    this.masks[r][c] &= ~b;
    if (!this.masks[r][c]) this.invalid = true;
    return true;
  }
  removeFromPeers(r, c, value) {
    for (let i = 0; i < 9; i++) { if (i !== c) this.remove(r, i, value); if (i !== r) this.remove(i, c, value); }
    const sr = Math.floor(r / 3) * 3, sc = Math.floor(c / 3) * 3;
    for (let rr = sr; rr < sr + 3; rr++) for (let cc = sc; cc < sc + 3; cc++) if (rr !== r || cc !== c) this.remove(rr, cc, value);
  }
  assign(r, c, value, kind) {
    if (this.grid[r][c]) return false;
    if (!(this.masks[r][c] & bit(value))) { this.invalid = true; return false; }
    this.grid[r][c] = value;
    this.masks[r][c] = bit(value);
    this.stats[kind]++;
    this.removeFromPeers(r, c, value);
    return true;
  }
  nakedSingles() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!this.grid[r][c] && pop(this.masks[r][c]) === 1) {
      return this.assign(r, c, oneValue(this.masks[r][c]), 'naked');
    }
    return false;
  }
  hiddenSingle() {
    for (const unit of units) for (let n = 1; n <= 9; n++) {
      if (unit.some(([r,c]) => this.grid[r][c] === n)) continue;
      const spots = unit.filter(([r,c]) => !this.grid[r][c] && (this.masks[r][c] & bit(n)));
      if (spots.length === 1) return this.assign(spots[0][0], spots[0][1], n, 'hidden');
    }
    return false;
  }
  lockedCandidates() {
    let changed = false;
    for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) for (let n = 1; n <= 9; n++) {
      const spots = [];
      for (let r = br*3; r < br*3+3; r++) for (let c = bc*3; c < bc*3+3; c++) if (!this.grid[r][c] && (this.masks[r][c] & bit(n))) spots.push([r,c]);
      if (spots.length > 1 && spots.every(([r]) => r === spots[0][0])) for (let c = 0; c < 9; c++) if (Math.floor(c/3) !== bc) changed = this.remove(spots[0][0], c, n) || changed;
      if (spots.length > 1 && spots.every(([,c]) => c === spots[0][1])) for (let r = 0; r < 9; r++) if (Math.floor(r/3) !== br) changed = this.remove(r, spots[0][1], n) || changed;
    }
    for (let r = 0; r < 9; r++) for (let n = 1; n <= 9; n++) {
      const spots = Array.from({length:9},(_,c)=>[r,c]).filter(([,c]) => !this.grid[r][c] && (this.masks[r][c] & bit(n)));
      if (spots.length > 1 && spots.every(([,c]) => Math.floor(c/3) === Math.floor(spots[0][1]/3))) {
        const br=Math.floor(r/3)*3, bc=Math.floor(spots[0][1]/3)*3;
        for(let rr=br;rr<br+3;rr++)for(let c=bc;c<bc+3;c++)if(rr!==r)changed=this.remove(rr,c,n)||changed;
      }
    }
    for (let c = 0; c < 9; c++) for (let n = 1; n <= 9; n++) {
      const spots = Array.from({length:9},(_,r)=>[r,c]).filter(([r]) => !this.grid[r][c] && (this.masks[r][c] & bit(n)));
      if (spots.length > 1 && spots.every(([r]) => Math.floor(r/3) === Math.floor(spots[0][0]/3))) {
        const br=Math.floor(spots[0][0]/3)*3, bc=Math.floor(c/3)*3;
        for(let r=br;r<br+3;r++)for(let cc=bc;cc<bc+3;cc++)if(cc!==c)changed=this.remove(r,cc,n)||changed;
      }
    }
    if (changed) this.stats.locked++;
    return changed;
  }
  nakedSubset(size, kind) {
    for (const unit of units) {
      const eligible = unit.filter(([r,c]) => !this.grid[r][c] && pop(this.masks[r][c]) >= 2 && pop(this.masks[r][c]) <= size);
      const choose = (start, selected) => {
        if (selected.length === size) {
          const union = selected.reduce((m,[r,c]) => m | this.masks[r][c], 0);
          if (pop(union) !== size) return false;
          let changed = false;
          for (const [r,c] of unit) if (!selected.some(([rr,cc]) => rr===r && cc===c) && !this.grid[r][c]) {
            for (let n=1;n<=9;n++) if (union & bit(n)) changed = this.remove(r,c,n) || changed;
          }
          return changed;
        }
        for(let i=start;i<eligible.length;i++) if(choose(i+1,[...selected,eligible[i]])) return true;
        return false;
      };
      if (choose(0, [])) { this.stats[kind]++; return true; }
    }
    return false;
  }
  xWing() {
    for (let n=1;n<=9;n++) {
      const rowPairs=[];
      for(let r=0;r<9;r++){const cols=[];for(let c=0;c<9;c++)if(!this.grid[r][c]&&(this.masks[r][c]&bit(n)))cols.push(c);if(cols.length===2)rowPairs.push([r,cols]);}
      for(let i=0;i<rowPairs.length;i++)for(let j=i+1;j<rowPairs.length;j++)if(rowPairs[i][1][0]===rowPairs[j][1][0]&&rowPairs[i][1][1]===rowPairs[j][1][1]){
        let changed=false;const [r1,cols]=rowPairs[i],[r2]=rowPairs[j];for(let r=0;r<9;r++)if(r!==r1&&r!==r2)for(const c of cols)changed=this.remove(r,c,n)||changed;
        if(changed){this.stats.xwing++;return true;}
      }
      const colPairs=[];
      for(let c=0;c<9;c++){const rows=[];for(let r=0;r<9;r++)if(!this.grid[r][c]&&(this.masks[r][c]&bit(n)))rows.push(r);if(rows.length===2)colPairs.push([c,rows]);}
      for(let i=0;i<colPairs.length;i++)for(let j=i+1;j<colPairs.length;j++)if(colPairs[i][1][0]===colPairs[j][1][0]&&colPairs[i][1][1]===colPairs[j][1][1]){
        let changed=false;const [c1,rows]=colPairs[i],[c2]=colPairs[j];for(let c=0;c<9;c++)if(c!==c1&&c!==c2)for(const r of rows)changed=this.remove(r,c,n)||changed;
        if(changed){this.stats.xwing++;return true;}
      }
    }
    return false;
  }
  solve(maxTier) {
    let guard = 0;
    while (!this.invalid && guard++ < 1000) {
      if (this.grid.every(row => row.every(Boolean))) return { solved: true, stats: this.stats };
      if (this.nakedSingles()) continue;
      if (maxTier >= 1 && this.hiddenSingle()) continue;
      if (maxTier >= 2 && this.lockedCandidates()) continue;
      if (maxTier >= 3 && this.nakedSubset(2, 'pairs')) continue;
      if (maxTier >= 4 && this.nakedSubset(3, 'triples')) continue;
      if (maxTier >= 5 && this.xWing()) continue;
      break;
    }
    return { solved: this.grid.every(row => row.every(Boolean)), stats: this.stats };
  }
}

const analyze = puzzle => {
  let requiredTier = 6, report = null;
  for (let tier=0;tier<=5;tier++) {
    const result = new HumanSolver(puzzle).solve(tier);
    if (result.solved) { requiredTier=tier; report=result.stats; break; }
  }
  const initial = new HumanSolver(puzzle);
  let initialSingles=0;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!puzzle[r][c]&&pop(initial.masks[r][c])===1)initialSingles++;
  const fullDigits = Array.from({length:9},(_,i)=>digitCascade(puzzle,i+1)).filter(Boolean).length;
  const givens=Array.from({length:9},(_,i)=>puzzle.flat().filter(n=>n===i+1).length);
  return { requiredTier, report, initialSingles, fullDigits, digitSpread: Math.max(...givens)-Math.min(...givens) };
};

const digitCascade = (puzzle, value) => {
  const board=puzzle.map(r=>[...r]);let changed=true;
  while(changed){changed=false;const spots=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!board[r][c]&&valid(board,r,c,value))spots.push([r,c]);const forced=new Map();
    for(const unit of units){if(unit.some(([r,c])=>board[r][c]===value))continue;const options=unit.filter(([r,c])=>spots.some(([rr,cc])=>rr===r&&cc===c));if(options.length===1)forced.set(options[0].join(','),options[0]);}
    for(const [r,c] of forced.values())if(!board[r][c]&&valid(board,r,c,value)){board[r][c]=value;changed=true;}
  }
  return board.flat().filter(n=>n===value).length===9;
};

const digPuzzle = (solution, target, rng, symmetric, maxTier) => {
  const puzzle=solution.map(r=>[...r]);
  const positions=rng.shuffle(Array.from({length:81},(_,i)=>i));
  const seen=new Set();let clues=81;
  for(const pos of positions){if(seen.has(pos))continue;const group=symmetric&&pos!==40?[pos,80-pos]:[pos];group.forEach(p=>seen.add(p));if(clues-group.length<target)continue;
    const backups=group.map(p=>puzzle[Math.floor(p/9)][p%9]);group.forEach(p=>puzzle[Math.floor(p/9)][p%9]=0);
    const unique = countSolutions(puzzle.map(r=>[...r])) === 1;
    const logicallySolvable = unique && new HumanSolver(puzzle).solve(maxTier).solved;
    if(!logicallySolvable)group.forEach((p,i)=>puzzle[Math.floor(p/9)][p%9]=backups[i]);else clues-=group.length;
    if(clues===target)break;
  }
  return clues===target?puzzle:null;
};

const PROFILES = {
  'Super Easy': { clues:[48,54], tiers:[0,0], singles:[9,30], full:[1,9] },
  'Easy': { clues:[42,48], tiers:[0,1], singles:[4,20], full:[0,5] },
  'Normal': { clues:[35,41], tiers:[1,2], singles:[1,9], full:[0,1] },
  'Hard': { clues:[30,37], tiers:[2,3], singles:[0,5], full:[0,1] },
  'Intense': { clues:[26,33], tiers:[3,4], singles:[0,3], full:[0,0] },
  'Impossible': { clues:[28,34], tiers:[4,5], singles:[0,4], full:[0,1] }
};

const serialize = board => board.flat().join('');
const countArg = process.argv.find(a=>a.startsWith('--count='));
const outArg = process.argv.find(a=>a.startsWith('--out='));
const onlyArg = process.argv.find(a=>a.startsWith('--only='));
const wanted = countArg ? Number(countArg.split('=')[1]) : 300;
const output = outArg ? outArg.split('=')[1] : path.resolve('data/puzzles-v2.json');
const selectedProfiles = onlyArg
  ? Object.fromEntries(Object.entries(PROFILES).filter(([difficulty]) => difficulty === onlyArg.split('=')[1]))
  : PROFILES;
const catalog={version:2,levels:{},metadata:{}};
let globalSeed=0x0A0C2026;

for(const [difficulty,profile] of Object.entries(selectedProfiles)){
  const accepted=[];const masks=new Set();const tierCounts={};let attempts=0;let lowerTierAccepted=0;
  while(accepted.length<wanted && attempts<500000){attempts++;const seed=globalSeed++;const rng=new RNG(seed);const solution=generateSolution(rng);const target=profile.clues[0]+rng.int(profile.clues[1]-profile.clues[0]+1);const puzzle=digPuzzle(solution,target,rng,attempts%3!==0,profile.tiers[1]);if(!puzzle)continue;
    const mask=puzzle.flat().map(n=>n?'1':'0').join('');if(masks.has(mask))continue;const a=analyze(puzzle);
    if(a.requiredTier<profile.tiers[0]||a.requiredTier>profile.tiers[1]||a.initialSingles<profile.singles[0]||a.initialSingles>profile.singles[1]||a.fullDigits<profile.full[0]||a.fullDigits>profile.full[1]||a.digitSpread>4)continue;
    const lowerTierShare = difficulty === 'Normal' ? 0.8 : difficulty === 'Impossible' ? 0.5 : 0.4;
    if(a.requiredTier<profile.tiers[1]&&lowerTierAccepted>=Math.floor(wanted*lowerTierShare))continue;
    masks.add(mask);accepted.push(serialize(puzzle)+serialize(solution));
    tierCounts[a.requiredTier]=(tierCounts[a.requiredTier]||0)+1;
    if(a.requiredTier<profile.tiers[1])lowerTierAccepted++;
    if(accepted.length%25===0||accepted.length===wanted)console.log(`${difficulty}: ${accepted.length}/${wanted} (${attempts} attempts)`);
  }
  if(accepted.length<wanted)throw new Error(`Only generated ${accepted.length}/${wanted} ${difficulty} puzzles after ${attempts} attempts`);
  catalog.levels[difficulty]=accepted;catalog.metadata[difficulty]={attempts,profile,tierCounts};
}

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(catalog));
console.log(`Wrote ${wanted*Object.keys(selectedProfiles).length} puzzles to ${output}`);
