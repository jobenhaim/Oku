import { Difficulty } from '../types';
import type { SudokuAuditResult } from './sudokuAudit';
import type { AdvancedSudokuAuditResult } from './sudokuAdvancedAudit';

export type DifficultyAssessmentStatus = 'match' | 'tooEasy' | 'tooHard' | 'unrated';

export interface DifficultyTarget {
    clueRange: readonly [number, number];
    minimumTier: 1 | 2 | 3;
    maximumTier: 1 | 2 | 3;
    minimumComplexityScore: number;
    maximumComplexityScore?: number;
    minimumAdvancedScore: number;
    description: string;
}

export interface DifficultyAssessment {
    status: DifficultyAssessmentStatus;
    complexityScore: number;
    advancedScore: number;
    reasons: string[];
}

// These are experience targets, not generation instructions. Clue count controls
// visual density, while the technique floors prevent sparse-but-trivial puzzles
// from being labelled Hard or Intense.
export const DIFFICULTY_TARGETS: Record<Difficulty, DifficultyTarget> = {
    [Difficulty.SuperEasy]: {
        clueRange: [46, 52],
        minimumTier: 1,
        maximumTier: 1,
        minimumComplexityScore: 0,
        maximumComplexityScore: 2,
        minimumAdvancedScore: 0,
        description: 'Naked singles with a short, comfortable solve path.'
    },
    [Difficulty.Easy]: {
        clueRange: [38, 44],
        minimumTier: 1,
        maximumTier: 1,
        minimumComplexityScore: 0,
        minimumAdvancedScore: 0,
        description: 'Singles only, with more scanning and occasional hidden singles.'
    },
    [Difficulty.Normal]: {
        clueRange: [34, 38],
        minimumTier: 1,
        maximumTier: 1,
        minimumComplexityScore: 4,
        minimumAdvancedScore: 0,
        description: 'Singles only, with a longer solve path than Easy; notes remain optional.'
    },
    [Difficulty.Hard]: {
        clueRange: [29, 34],
        minimumTier: 2,
        maximumTier: 3,
        minimumComplexityScore: 12,
        minimumAdvancedScore: 6,
        description: 'Must require candidate interaction, not merely a long chain of singles.'
    },
    [Difficulty.Intense]: {
        clueRange: [24, 30],
        minimumTier: 3,
        maximumTier: 3,
        minimumComplexityScore: 28,
        minimumAdvancedScore: 24,
        description: 'Must require pairs plus multiple connected candidate eliminations.'
    },
    [Difficulty.Impossible]: {
        clueRange: [20, 27],
        minimumTier: 3,
        maximumTier: 3,
        minimumComplexityScore: 0,
        minimumAdvancedScore: 0,
        description: 'Requires several advanced deductions and at least one high-end technique, with no branching.'
    }
};

export const scoreSudokuAudit = (audit: SudokuAuditResult) => {
    const techniques = audit.tier3.techniques;
    const advancedScore =
        techniques.lockedCandidate * 6 +
        techniques.nakedPair * 12;
    const complexityScore =
        techniques.hiddenSingle * 2 +
        advancedScore;

    return { complexityScore, advancedScore };
};

export const assessSudokuDifficulty = (
    difficulty: Difficulty,
    audit: SudokuAuditResult,
    advancedAudit?: AdvancedSudokuAuditResult
): DifficultyAssessment => {
    const target = DIFFICULTY_TARGETS[difficulty];
    const { complexityScore, advancedScore } = scoreSudokuAudit(audit);
    const reasons: string[] = [];

    if (difficulty === Difficulty.Impossible) {
        if (!advancedAudit) {
            return {
                status: 'unrated',
                complexityScore,
                advancedScore,
                reasons: ['An advanced logical proof was not supplied.']
            };
        }
        if (!advancedAudit.solved || advancedAudit.contradiction) {
            return {
                status: 'tooHard',
                complexityScore,
                advancedScore,
                reasons: ['The advanced no-guess solver could not complete the puzzle.']
            };
        }
        if (audit.minimumTier !== null) {
            return {
                status: 'tooEasy',
                complexityScore,
                advancedScore,
                reasons: ['The puzzle can be solved without advanced logic.']
            };
        }
        if (advancedAudit.advancedSteps < 3 || advancedAudit.highEndSteps < 1) {
            return {
                status: 'tooEasy',
                complexityScore,
                advancedScore,
                reasons: ['The puzzle does not require enough advanced or high-end deductions.']
            };
        }
        return {
            status: 'match',
            complexityScore,
            advancedScore,
            reasons: []
        };
    }

    if (audit.tier3.contradiction) {
        return {
            status: 'tooHard',
            complexityScore,
            advancedScore,
            reasons: ['The logical audit reached a contradiction.']
        };
    }

    const [minimumClues, maximumClues] = target.clueRange;
    if (audit.clues < minimumClues) {
        reasons.push(`Clue count ${audit.clues} is below the target range ${minimumClues}-${maximumClues}.`);
    } else if (audit.clues > maximumClues) {
        reasons.push(`Clue count ${audit.clues} is above the target range ${minimumClues}-${maximumClues}.`);
    }

    if (audit.minimumTier === null || audit.minimumTier > target.maximumTier) {
        reasons.push(`Requires logic beyond Tier ${target.maximumTier}.`);
        return { status: 'tooHard', complexityScore, advancedScore, reasons };
    }

    if (audit.minimumTier < target.minimumTier) {
        reasons.push(`Only requires Tier ${audit.minimumTier}; target starts at Tier ${target.minimumTier}.`);
    }
    if (complexityScore < target.minimumComplexityScore) {
        reasons.push(
            `Complexity score ${complexityScore} is below the target minimum ${target.minimumComplexityScore}.`
        );
    }
    if (advancedScore < target.minimumAdvancedScore) {
        reasons.push(
            `Advanced-technique score ${advancedScore} is below the target minimum ${target.minimumAdvancedScore}.`
        );
    }

    if (
        audit.minimumTier < target.minimumTier ||
        complexityScore < target.minimumComplexityScore ||
        advancedScore < target.minimumAdvancedScore ||
        audit.clues > maximumClues
    ) {
        return { status: 'tooEasy', complexityScore, advancedScore, reasons };
    }

    if (
        (target.maximumComplexityScore !== undefined &&
            complexityScore > target.maximumComplexityScore) ||
        audit.clues < minimumClues
    ) {
        if (
            target.maximumComplexityScore !== undefined &&
            complexityScore > target.maximumComplexityScore
        ) {
            reasons.push(
                `Complexity score ${complexityScore} exceeds the target maximum ${target.maximumComplexityScore}.`
            );
        }
        return { status: 'tooHard', complexityScore, advancedScore, reasons };
    }

    return {
        status: 'match',
        complexityScore,
        advancedScore,
        reasons: []
    };
};
