
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const REVENUECAT_API_KEY = 'appl_flqGomKiQqiKEKJxfszjaPaRYnK';

class IAPManager {
    private initialized = false;

    async initialize() {
        if (Capacitor.isNativePlatform()) {
            if (Capacitor.getPlatform() === 'ios') {
                try {
                    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
                    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                    console.log("IAP: RevenueCat Initialized for iOS");
                    this.initialized = true;
                } catch (error) {
                    console.error("IAP: Failed to initialize RevenueCat:", error);
                }
            } else {
                console.log("IAP: Native platform is not iOS. Skipping RevenueCat config.");
            }
        } else {
            console.log("IAP: Web Mode (Mock Initialized)");
            this.initialized = true;
        }
    }

    // Returns a promise that resolves on success, false on fail/cancel
    async purchase(productId: string): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            console.log(`IAP: Mock Purchasing ${productId}...`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log("IAP: Mock Purchase Successful");
                    resolve(true);
                }, 1000);
            });
        }
        
        try {
            console.log(`IAP: Purchasing ${productId} via RevenueCat...`);
            const { products } = await Purchases.getProducts({
                productIdentifiers: [productId],
                type: "NON_SUBSCRIPTION"
            } as any);

            if (products.length === 0) {
                console.error("IAP: Product not found");
                alert("Purchase failed: Product not found");
                return false;
            }

            const purchaseResult = await Purchases.purchaseStoreProduct({
                product: products[0]
            });
            // You might want to check the customer info to verify the entitlement/purchase
            console.log("IAP: Purchase successful!", purchaseResult);
            return true;
        } catch (error: any) {
            if (error.code === 'PURCHASE_CANCELLED') {
                console.log("IAP: Purchase cancelled by user");
            } else {
                console.error("IAP: Purchase failed", error);
                alert("Purchase failed: " + (error.message || "Unknown error"));
            }
            return false;
        }
    }

    async restore(): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            console.log("IAP: Mock Restore");
            alert("Restore successful (Mock Mode)");
            return;
        }

        try {
            console.log("IAP: Restoring purchases via RevenueCat...");
            const customerInfo = await Purchases.restorePurchases();
            console.log("IAP: Restore successful", customerInfo);
            alert("Restore successful");
        } catch (error: any) {
            console.error("IAP: Restore failed", error);
            alert("Restore failed: " + (error.message || "Unknown error"));
        }
    }
}

export const IAP = new IAPManager();

