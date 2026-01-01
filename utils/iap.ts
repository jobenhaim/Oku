
import { Capacitor } from '@capacitor/core';
import { DIAMOND_OFFERS } from './constants';

// We use the 'CdvPurchase' global variable injected by cordova-plugin-purchase
// To avoid TS errors, we declare it roughly.
declare var CdvPurchase: any;

class IAPManager {
    private isInitialized = false;
    private store: any = null;

    initialize() {
        if (!Capacitor.isNativePlatform()) {
            console.log("IAP: Web Platform detected, using mock mode.");
            return;
        }

        if (this.isInitialized) return;

        // Wait for device ready (standard for Cordova/Capacitor plugins)
        document.addEventListener('deviceready', () => {
            if (typeof CdvPurchase === 'undefined') {
                console.warn('IAP: CdvPurchase plugin not installed.');
                return;
            }

            this.store = CdvPurchase.store;
            
            // 1. Register Products
            DIAMOND_OFFERS.forEach(offer => {
                this.store.register({
                    id: offer.productId,
                    type: offer.type === 'pack' ? CdvPurchase.CONSUMABLE : CdvPurchase.NON_CONSUMABLE,
                    platform: CdvPurchase.APPLE_APPSTORE // Auto-detects usually, but safe default
                });
            });

            // 2. Setup Event Listeners
            this.store.when("product").approved((p: any) => p.verify());
            this.store.when("product").verified((p: any) => p.finish());
            
            // Global Error Handler
            this.store.error((err: any) => {
                console.error('IAP Error:', err);
            });

            // 3. Refresh Store
            this.store.refresh();
            this.isInitialized = true;
            console.log("IAP: Store Initialized");
        });
    }

    // Returns a promise that resolves on success, rejects on fail/cancel
    async purchase(productId: string): Promise<boolean> {
        // MOCK MODE FOR WEB / DEVELOPMENT
        if (!Capacitor.isNativePlatform()) {
            console.log(`IAP: Mock Purchasing ${productId}...`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log("IAP: Mock Purchase Successful");
                    resolve(true);
                }, 1500);
            });
        }

        if (!this.store) {
            console.error("IAP: Store not initialized");
            return Promise.reject("Store not initialized");
        }

        return new Promise((resolve, reject) => {
            // Setup one-time listeners for this specific purchase attempt
            const product = this.store.get(productId);
            
            if (!product) {
                reject("Product not found");
                return;
            }

            // We need to listen to events globally, but we can wrap the order call
            // The robust way in CdvPurchase is observing the updated product state
            // For simplicity in this wrapper, we trigger the order and let the global listeners handle 'approved'.
            // However, to wire it back to the UI, we can assume success if we reach the 'finished' state logic below.
            // A better way for UI feedback is to pass a callback to the global listener, 
            // but for now we will simulate the promise resolution via a temporary handler.
            
            const onFinished = (p: any) => {
                if (p.id === productId) {
                    resolve(true);
                    this.store.off(onFinished);
                }
            };
            
            // Listen for finish
            this.store.when("product").finished(onFinished);
            
            // Attempt Order
            this.store.order(productId).then(
                () => console.log("IAP: Order Initiated"),
                (e: any) => {
                    this.store.off(onFinished); // Cleanup
                    reject(e);
                }
            );
        });
    }

    async restore(): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            alert("Restore Purchases simulated.");
            return;
        }
        if (this.store) {
            this.store.refresh();
        }
    }
}

export const IAP = new IAPManager();
