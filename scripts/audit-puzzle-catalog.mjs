import fs from 'node:fs';

const file = process.argv[2] || 'data/puzzles-v2.json';
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const valid = (board, row, col, value) => {
  for (let i=0;i<9;i++) if (board[row][i]===value || board[i][col]===value) return false;
  const sr=Math.floor(row/3)*3, sc=Math.floor(col/3)*3;
  for(let r=sr;r<sr+3;r++)for(let c=sc;c<sc+3;c++)if(board[r][c]===value)return false;
  return true;
};
const countSolutions = (board, limit=2) => {
  let target=null, options=[];
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!board[r][c]){
    const next=[];for(let n=1;n<=9;n++)if(valid(board,r,c,n))next.push(n);
    if(!next.length)return 0;
    if(!target||next.length<options.length){target=[r,c];options=next;}
  }
  if(!target)return 1;
  let count=0;const [r,c]=target;
  for(const n of options){board[r][c]=n;count+=countSolutions(board,limit-count);board[r][c]=0;if(count>=limit)break;}
  return count;
};
const parse = text => Array.from({length:9},(_,r)=>text.slice(r*9,r*9+9).split('').map(Number));
const solutionValid = board => {
  const expected='123456789';
  const key=values=>[...values].sort().join('');
  if(board.some(row=>key(row)!==expected))return false;
  for(let c=0;c<9;c++)if(key(board.map(row=>row[c]))!==expected)return false;
  for(let br=0;br<3;br++)for(let bc=0;bc<3;bc++){const box=[];for(let r=br*3;r<br*3+3;r++)for(let c=bc*3;c<bc*3+3;c++)box.push(board[r][c]);if(key(box)!==expected)return false;}
  return true;
};

if(catalog.version!==2)throw new Error(`Expected catalog version 2, received ${catalog.version}`);
const allPuzzles=new Set(), allSolutions=new Set(), report={};
for(const [difficulty,entries] of Object.entries(catalog.levels)){
  if(entries.length!==300)throw new Error(`${difficulty} has ${entries.length} levels`);
  const clues=[];
  for(let index=0;index<entries.length;index++){
    const entry=entries[index];
    if(entry.length!==162||!/^[0-9]+$/.test(entry))throw new Error(`${difficulty} ${index+1} has malformed data`);
    const puzzleText=entry.slice(0,81), solutionText=entry.slice(81), puzzle=parse(puzzleText), solution=parse(solutionText);
    if(allPuzzles.has(puzzleText))throw new Error(`Duplicate puzzle at ${difficulty} ${index+1}`);
    allPuzzles.add(puzzleText);allSolutions.add(solutionText);
    if(!solutionValid(solution))throw new Error(`Invalid solution at ${difficulty} ${index+1}`);
    for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(puzzle[r][c]&&puzzle[r][c]!==solution[r][c])throw new Error(`Clue mismatch at ${difficulty} ${index+1}`);
    if(countSolutions(puzzle.map(row=>[...row]))!==1)throw new Error(`Non-unique puzzle at ${difficulty} ${index+1}`);
    clues.push(puzzleText.replace(/0/g,'').length);
  }
  report[difficulty]={levels:entries.length,clues:`${Math.min(...clues)}-${Math.max(...clues)}`,tiers:catalog.metadata[difficulty]?.tierCounts};
}
console.log(JSON.stringify({version:catalog.version,totalPuzzles:allPuzzles.size,uniqueSolutions:allSolutions.size,difficulties:report},null,2));
