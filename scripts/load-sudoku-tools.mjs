import { build } from 'esbuild';

let toolsPromise;

export const loadSudokuTools = () => {
    if (!toolsPromise) {
        toolsPromise = build({
            stdin: {
                contents: `
                    export { generateLevel, generateCandidateFromSeed } from './utils/sudoku.ts';
                    export { auditSudokuPuzzle } from './utils/sudokuAudit.ts';
                    export { auditSudokuWithAdvancedLogic } from './utils/sudokuAdvancedAudit.ts';
                    export {
                        auditSudokuHumanFlow,
                        NORMAL_HUMAN_FLOW_MAXIMUM_SCAN_COST
                    } from './utils/sudokuHumanFlow.ts';
                    export {
                        assessSudokuDifficulty,
                        DIFFICULTY_TARGETS,
                        scoreSudokuAudit
                    } from './utils/sudokuDifficultyPolicy.ts';
                    export { Difficulty } from './types.ts';
                `,
                resolveDir: process.cwd(),
                loader: 'ts'
            },
            bundle: true,
            format: 'esm',
            platform: 'node',
            target: 'node18',
            write: false,
            logLevel: 'silent'
        }).then(async bundle => {
            const bundledSource = bundle.outputFiles[0].text;
            const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledSource).toString('base64')}`;
            return import(moduleUrl);
        });
    }

    return toolsPromise;
};
