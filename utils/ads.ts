
import { AdMob, RewardAdOptions, AdLoadInfo, RewardAdPluginEvents, AdMobRewardItem } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export const AD_IDS = {
    DIAMOND_REWARD: 'ca-app-pub-1693095758192325/2084679142',
    SCAN_REFILL: 'ca-app-pub-1693095758192325/9122706690',
    REVEAL_REFILL: 'ca-app-pub-1693095758192325/2850965902'
};

class AdMobService {
    private isReady = false;
    private currentAdId: string | null = null;
    private onRewardCallback: (() => void) | null = null;
    private isInitializing = false;

    async initialize() {
        if (!Capacitor.isNativePlatform() || this.isInitializing) return;
        this.isInitializing = true;

        try {
            await AdMob.initialize({
                initializeForTesting: false, 
            });

            // Listeners
            AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
                this.isReady = true;
                console.log('AdMob: Reward Video Loaded', info.adUnitId);
            });

            AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
                this.isReady = false;
                // Preload the last used ID again for convenience
                if (this.currentAdId) {
                    this.prepare(this.currentAdId);
                }
            });

            AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
                console.log('AdMob: User Rewarded', reward);
                if (this.onRewardCallback) {
                    this.onRewardCallback();
                    this.onRewardCallback = null;
                }
            });
            
            AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
                 console.error('AdMob: Failed to load', error);
                 this.isReady = false;
            });

            // Initial Load (Default to Diamond Ad)
            await this.prepare(AD_IDS.DIAMOND_REWARD);

        } catch (e) {
            console.error('AdMob Init Error', e);
        }
    }

    async prepare(adUnitId: string) {
        if (!Capacitor.isNativePlatform()) return;
        
        this.currentAdId = adUnitId;
        try {
            await AdMob.prepareRewardVideoAd({
                adId: adUnitId
            });
        } catch (e) {
            console.error('AdMob Prepare Error', e);
        }
    }

    async showRewardVideo(adUnitId: string, onReward: () => void): Promise<boolean> {
        // Mock for Web / Development
        if (!Capacitor.isNativePlatform()) {
            console.log(`AdMob: Web Mock - Showing Ad [${adUnitId}] (2s delay)`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log('AdMob: Web Mock - Rewarded');
                    onReward();
                    resolve(true);
                }, 2000);
            });
        }

        // If we want to show a DIFFERENT ad than what is ready, or if nothing is ready
        if (this.currentAdId !== adUnitId || !this.isReady) {
            console.log('AdMob: Ad not ready or ID mismatch, attempting load...');
            this.isReady = false; // Force status reset
            await this.prepare(adUnitId);
            
            // Wait a moment for load? (Native logic might vary, usually prepare awaits until loaded or failed)
            // Ideally prepareRewardVideoAd promise resolves when loaded.
        }

        if (!this.isReady) return false;

        this.onRewardCallback = onReward;
        
        try {
            await AdMob.showRewardVideoAd();
            return true;
        } catch (e) {
            console.error('AdMob Show Error', e);
            return false;
        }
    }
}

export const Ads = new AdMobService();
