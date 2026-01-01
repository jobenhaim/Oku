
import { DIAMOND_OFFERS } from './constants';

class IAPManager {
    initialize() {
        console.log("IAP: Initialized (Mock Mode)");
    }

    // Returns a promise that resolves on success, rejects on fail/cancel
    async purchase(productId: string): Promise<boolean> {
        console.log(`IAP: Mock Purchasing ${productId}...`);
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log("IAP: Mock Purchase Successful");
                resolve(true);
            }, 1000);
        });
    }

    async restore(): Promise<void> {
        console.log("IAP: Mock Restore");
        return Promise.resolve();
    }
}

export const IAP = new IAPManager();
