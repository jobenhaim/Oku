import { loadSudokuTools } from './load-sudoku-tools.mjs';

const args = new Map(
    process.argv
        .slice(2)
        .filter(argument => argument.startsWith('--'))
        .map(argument => {
            const [key, value = 'true'] = argument.slice(2).split('=');
            return [key, value];
        })
);

const levelCount = Math.max(1, Number.parseInt(args.get('levels') ?? '300', 10));
const requestedDifficulty = args.get('difficulty');

{
    const {
        generateLevel,
        auditSudokuPuzzle,
        auditSudokuHumanFlow,
        auditSudokuWithAdvancedLogic,
        assessSudokuDifficulty,
        DIFFICULTY_TARGETS,
        Difficulty
    } = await loadSudokuTools();

    const difficulties = Object.values(Difficulty).filter(
        difficulty =>
            !requestedDifficulty ||
            difficulty.toLowerCase() === requestedDifficulty.toLowerCase()
    );

    if (difficulties.length === 0) {
        throw new Error(`Unknown difficulty "${requestedDifficulty}".`);
    }

    const catalogueHashes = new Map();
    const results = [];
    const startedAt = Date.now();

    for (const difficulty of difficulties) {
        process.stdout.write(`Auditing ${difficulty} (${levelCount} levels)...\n`);
        for (let levelId = 1; levelId <= levelCount; levelId++) {
            const { initial } = generateLevel(difficulty, levelId);
            const audit = auditSudokuPuzzle(initial);
            const humanFlowAudit = difficulty === Difficulty.Normal
                ? auditSudokuHumanFlow(initial)
                : undefined;
            const advancedAudit = difficulty === Difficulty.Impossible
                ? auditSudokuWithAdvancedLogic(initial)
                : undefined;
            const assessment = assessSudokuDifficulty(
                difficulty,
                audit,
                advancedAudit
            );
            const hash = initial
                .flat()
                .map(cell => cell.value ?? 0)
                .join('');
            const existing = catalogueHashes.get(hash) ?? [];
            existing.push(`${difficulty} ${levelId}`);
            catalogueHashes.set(hash, existing);
            results.push({
                difficulty,
                levelId,
                ...audit,
                advancedAudit,
                humanFlowAudit,
                assessment
            });

            if (levelId % 50 === 0 || levelId === levelCount) {
                process.stdout.write(`  ${levelId}/${levelCount}\n`);
            }
        }
    }

    const duplicates = [...catalogueHashes.values()].filter(entries => entries.length > 1);
    const round = value => Math.round(value * 10) / 10;
    const percentile = (values, ratio) => {
        const sorted = [...values].sort((a, b) => a - b);
        if (sorted.length === 0) return 0;
        return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
    };
    const summarizeMetric = values =>
        `avg ${round(values.reduce((sum, value) => sum + value, 0) / values.length)}, p50 ${percentile(values, 0.5)}, p90 ${percentile(values, 0.9)}`;

    process.stdout.write('\nSudoku catalogue audit\n');
    process.stdout.write('=======================\n');
    for (const difficulty of difficulties) {
        const rows = results.filter(result => result.difficulty === difficulty);
        const clues = rows.map(result => result.clues);
        const countAtTier = tier => rows.filter(result => result.minimumTier === tier).length;
        const beyond = rows.filter(result => result.minimumTier === null);
        const matches = rows.filter(result => result.assessment.status === 'match');
        const tooEasy = rows.filter(result => result.assessment.status === 'tooEasy');
        const tooHard = rows.filter(result => result.assessment.status === 'tooHard');
        const unrated = rows.filter(result => result.assessment.status === 'unrated');
        const suspiciouslyEasy = rows.filter(result => {
            if (difficulty === Difficulty.Hard) return result.minimumTier === 1;
            if (difficulty === Difficulty.Intense) {
                return result.minimumTier === 1 || result.minimumTier === 2;
            }
            return false;
        });
        const easiestExamples = suspiciouslyEasy
            .sort((a, b) =>
                (a.minimumTier ?? 4) - (b.minimumTier ?? 4) ||
                a.tier3.logicalSteps - b.tier3.logicalSteps
            )
            .slice(0, 12)
            .map(result => result.levelId);

        process.stdout.write(`\n${difficulty}\n`);
        process.stdout.write(`  Target: ${DIFFICULTY_TARGETS[difficulty].description}\n`);
        process.stdout.write(`  Levels: ${rows.length}\n`);
        process.stdout.write(
            `  Clues: ${Math.min(...clues)}-${Math.max(...clues)} (avg ${round(clues.reduce((sum, value) => sum + value, 0) / clues.length)})\n`
        );
        process.stdout.write(
            `  Minimum logic: Tier 1 ${countAtTier(1)}, Tier 2 ${countAtTier(2)}, Tier 3 ${countAtTier(3)}, beyond current solver ${beyond.length}\n`
        );
        process.stdout.write(
            `  Hidden singles: ${summarizeMetric(rows.map(result => result.tier3.techniques.hiddenSingle))}\n`
        );
        process.stdout.write(
            `  Locked candidates: ${summarizeMetric(rows.map(result => result.tier3.techniques.lockedCandidate))}\n`
        );
        process.stdout.write(
            `  Naked pairs: ${summarizeMetric(rows.map(result => result.tier3.techniques.nakedPair))}\n`
        );
        process.stdout.write(
            `  Longest singles run: ${summarizeMetric(rows.map(result => result.tier3.longestSinglesRun))}\n`
        );
        process.stdout.write(
            `  Target assessment: match ${matches.length}, too easy ${tooEasy.length}, too hard ${tooHard.length}, unrated ${unrated.length}\n`
        );
        if (difficulty === Difficulty.Normal) {
            const comfortable = rows.filter(result => result.humanFlowAudit?.comfortable);
            const flowFailures = rows.filter(result => !result.humanFlowAudit?.comfortable);
            process.stdout.write(
                `  Human flow: comfortable ${comfortable.length}/${rows.length}, bottlenecks ${flowFailures.length}\n`
            );
            if (flowFailures.length > 0) {
                process.stdout.write(
                    `  Flow failure levels: ${flowFailures.slice(0, 30).map(result => result.levelId).join(', ')}\n`
                );
            }
        }
        if (difficulty === Difficulty.Impossible) {
            process.stdout.write(
                `  No-guess proofs: ${rows.filter(result => result.advancedAudit?.solved).length}/${rows.length}\n`
            );
            process.stdout.write(
                `  Advanced steps: ${summarizeMetric(rows.map(result => result.advancedAudit?.advancedSteps ?? 0))}\n`
            );
            process.stdout.write(
                `  High-end steps: ${summarizeMetric(rows.map(result => result.advancedAudit?.highEndSteps ?? 0))}\n`
            );
        }
        if (difficulty === Difficulty.Hard || difficulty === Difficulty.Intense) {
            process.stdout.write(`  Suspected undergraded: ${suspiciouslyEasy.length}\n`);
            if (easiestExamples.length > 0) {
                process.stdout.write(`  Example levels: ${easiestExamples.join(', ')}\n`);
            }
        }
    }

    process.stdout.write(`\nExact duplicate boards: ${duplicates.length}\n`);
    if (duplicates.length > 0) {
        for (const entries of duplicates.slice(0, 10)) {
            process.stdout.write(`  ${entries.join(' = ')}\n`);
        }
    }
    process.stdout.write(`Audit time: ${round((Date.now() - startedAt) / 1000)}s\n`);
}
