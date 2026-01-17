
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// --- CONFIGURATION ---
// TODO: Replace these with your Public API Keys from the RevenueCat Dashboard
const API_KEY_IOS = 'appl_flqGomKiQqiKEKJxfszjaPaRYnK';
const API_KEY_ANDROID = 'goog_REPLACE_WITH_YOUR_KEY';

class IAPManager {
    private initialized = false;

    async initialize() {
        // 1. Web / Mock Mode Handling
        if (!Capacitor.isNativePlatform()) {
            console.log("IAP: Web Mode (Mock Initialized)");
            this.initialized = true;
            return;
        }

        // 2. Native RevenueCat Initialization
        try {
            // Enable debug logs for development builds
            await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

            if (Capacitor.getPlatform() === 'ios') {
                await Purchases.configure({ apiKey: API_KEY_IOS });
            } else if (Capacitor.getPlatform() === 'android') {
                await Purchases.configure({ apiKey: API_KEY_ANDROID });
            }
            
            this.initialized = true;
            console.log("IAP: RevenueCat Initialized Successfully");
        } catch (e) {
            console.error("IAP: Initialization failed", e);
        }
    }

    // Returns a promise that resolves on success, false on fail/cancel
    async purchase(productId: string): Promise<boolean> {
        // Mock Mode for Web
        if (!Capacitor.isNativePlatform()) {
            console.log(`IAP: Mock Purchasing ${productId}...`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log("IAP: Mock Purchase Successful");
                    resolve(true);
                }, 1000);
            });
        }

        if (!this.initialized) {
            console.error("IAP: Not initialized");
            // Try to init again just in case
            await this.initialize();
            if (!this.initialized) return false;
        }

        try {
            // 1. Fetch the product details from RevenueCat
            const products = await Purchases.getProducts({ productIdentifiers: [productId] });
            
            if (products.products.length === 0) {
                console.error(`IAP: Product not found: ${productId}`);
                return false;
            }

            const productToBuy = products.products[0];

            // 2. Initiate the Purchase
            const { customerInfo } = await Purchases.purchaseStoreProduct({
                product: productToBuy
            });

            // 3. Success!
            console.log("IAP: Purchase Successful", customerInfo);
            return true;

        } catch (e: any) {
            if (e.userCancelled) {
                console.log("IAP: User cancelled transaction");
            } else {
                console.error("IAP: Purchase error", e);
            }
            return false;
        }
    }

    async restore(): Promise<string[]> {
        if (!Capacitor.isNativePlatform()) {
            console.log("IAP: Mock Restore");
            return []; // Web mock returns empty or test data
        }

        try {
            const { customerInfo } = await Purchases.restorePurchases();
            console.log("IAP: Restore Complete", customerInfo);
            
            // Return all active purchased products so the App can update state
            return customerInfo.allPurchasedProductIdentifiers || [];
        } catch (e) {
            console.error("IAP: Restore failed", e);
            throw e;
        }
    }
}

export const IAP = new IAPManager();
