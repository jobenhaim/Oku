import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppReviewPlugin {
    recordCompletion(options: { puzzleId: string }): Promise<void>;
    requestIfEligible(): Promise<{ requested: boolean }>;
    openReviewPage(): Promise<void>;
}

const NativeReview = registerPlugin<AppReviewPlugin>('OkuAppReview');
const available = () => Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('OkuAppReview');
const REVIEW_URL = 'https://apps.apple.com/app/id6757077544?action=write-review';
let pendingCompletion = Promise.resolve();

export const AppReview = {
    recordCompletion(difficulty: string, levelId: number) {
        if (!available()) return;
        pendingCompletion = pendingCompletion
            .then(() => NativeReview.recordCompletion({ puzzleId: `${difficulty}:${levelId}` }))
            .catch(error => { console.warn('Could not record review milestone', error); });
    },
    async requestIfEligible(isStillSafe: () => boolean) {
        if (!available()) return;
        await pendingCompletion;
        if (!isStillSafe()) return;
        try {
            await NativeReview.requestIfEligible();
        } catch (error) {
            console.warn('Could not request app review', error);
        }
    },
    async openReviewPage() {
        try {
            if (available()) await NativeReview.openReviewPage();
            else window.open(REVIEW_URL, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.warn('Could not open App Store review page', error);
        }
    },
};
