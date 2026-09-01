import type { AdvancedSudokuAuditResult, SudokuProofStep } from './sudokuAdvancedAudit';

export const IMPOSSIBLE_SOFT_PACING_THRESHOLDS = {
    exactHighEndSteps: 1,
    minimumOpeningSingles: 12,
    maximumCandidateDeductionSteps: 10,
    maximumMiddlePlacements: 2,
    minimumFinalSingles: 37
} as const;

export interface ImpossiblePacingMetrics {
    highEndSteps: number;
    openingSingles: number;
    candidateDeductionSteps: number;
    middlePlacements: number;
    finalSingles: number;
}

const isSingleStep = (step: SudokuProofStep): boolean =>
    step.technique === 'nakedSingle' || step.technique === 'hiddenSingle';

const countPlacements = (steps: SudokuProofStep[]): number =>
    steps.reduce((total, step) => total + step.placements.length, 0);

// Measures the deterministic no-guess proof in the same phases a player feels:
// an opening run of visible singles, a candidate-deduction phase, then the final
// singles cascade. The opening count comes from auditSudokuHumanFlow so it is
// independent of the advanced solver's internal single-ordering tie breaks.
export const measureImpossiblePacing = (
    audit: AdvancedSudokuAuditResult,
    openingSingles: number
): ImpossiblePacingMetrics => {
    const firstDeductionIndex = audit.proof.findIndex(step => !isSingleStep(step));
    let lastDeductionIndex = -1;
    for (let index = audit.proof.length - 1; index >= 0; index--) {
        if (!isSingleStep(audit.proof[index])) {
            lastDeductionIndex = index;
            break;
        }
    }

    const hasCandidateDeductions = firstDeductionIndex !== -1;
    const candidateDeductionSteps = audit.proof.filter(step => !isSingleStep(step)).length;
    const middlePlacements = hasCandidateDeductions
        ? countPlacements(audit.proof.slice(firstDeductionIndex, lastDeductionIndex + 1))
        : 0;
    const finalSingles = countPlacements(
        audit.proof.slice(hasCandidateDeductions ? lastDeductionIndex + 1 : 0)
    );

    return {
        highEndSteps: audit.highEndSteps,
        openingSingles,
        candidateDeductionSteps,
        middlePlacements,
        finalSingles
    };
};

export const hasSoftImpossiblePacing = (
    metrics: ImpossiblePacingMetrics
): boolean => {
    const thresholds = IMPOSSIBLE_SOFT_PACING_THRESHOLDS;
    return (
        metrics.highEndSteps === thresholds.exactHighEndSteps &&
        metrics.openingSingles >= thresholds.minimumOpeningSingles &&
        metrics.candidateDeductionSteps <= thresholds.maximumCandidateDeductionSteps &&
        metrics.middlePlacements <= thresholds.maximumMiddlePlacements &&
        metrics.finalSingles >= thresholds.minimumFinalSingles
    );
};
