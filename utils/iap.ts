import { Purchases, LOG_LEVEL, PRODUCT_CATEGORY } from '@revenuecat/purchases-capacitor';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { PermanentPurchaseOwnership } from '../types';

const REVENUECAT_API_KEY = 'appl_flqGomKiQqiKEKJxfszjaPaRYnK';

export const PREMIUM_PRODUCT_ID = 'com.oku.sudoku.iap.premiumpack';
export const STARTER_PRODUCT_ID = 'com.oku.sudoku.iap.starterpack';
export const BOOKS_2_ALL_PRODUCT_ID = 'oku_books_2_all';
export const BOOKS_3_ALL_PRODUCT_ID = 'oku_books_3_all';
export const BOOKS_FOREVER_PRODUCT_ID = 'oku_books_forever';
const PREMIUM_ENTITLEMENT_ID = 'Oku: Sudoku Pro';
const STARTER_ENTITLEMENT_ID = 'Starter';
const BOOKS_2_ALL_ENTITLEMENT_ID = 'books_2_all';
const BOOKS_3_ALL_ENTITLEMENT_ID = 'books_3_all';
const BOOKS_FOREVER_ENTITLEMENT_ID = 'books_forever';
const PERMANENT_PRODUCT_IDS = new Set([
    PREMIUM_PRODUCT_ID,
    STARTER_PRODUCT_ID,
    BOOKS_2_ALL_PRODUCT_ID,
    BOOKS_3_ALL_PRODUCT_ID,
    BOOKS_FOREVER_PRODUCT_ID
]);

export type SuccessfulIAPPurchase = {
    status: 'purchased';
    productIdentifier: string;
    transactionIdentifier: string;
    ownership: PermanentPurchaseOwnership;
    isMock: boolean;
} | {
    status: 'restored';
    productIdentifier: string;
    transactionIdentifier: string | null;
    ownership: PermanentPurchaseOwnership;
    isMock: boolean;
};

export type IAPPurchaseResult = SuccessfulIAPPurchase | {
    status: 'cancelled' | 'failed';
    message?: string;
};

const getPermanentOwnership = (customerInfo: CustomerInfo): PermanentPurchaseOwnership => {
    const activeEntitlements = customerInfo.entitlements.active || {};
    const permanentTransactions = (customerInfo.nonSubscriptionTransactions || []).filter(transaction =>
        PERMANENT_PRODUCT_IDS.has(transaction.productIdentifier)
    );

    return {
        // `allPurchasedProductIdentifiers` contains historical purchases. It is
        // not an access check and can keep refunded products looking owned.
        // RevenueCat's active entitlements are the current source of truth.
        premiumOwned: Boolean(activeEntitlements[PREMIUM_ENTITLEMENT_ID]?.isActive),
        starterOwned: Boolean(activeEntitlements[STARTER_ENTITLEMENT_ID]?.isActive),
        books2AllOwned: Boolean(activeEntitlements[BOOKS_2_ALL_ENTITLEMENT_ID]?.isActive),
        books3AllOwned: Boolean(activeEntitlements[BOOKS_3_ALL_ENTITLEMENT_ID]?.isActive),
        booksForeverOwned: Boolean(activeEntitlements[BOOKS_FOREVER_ENTITLEMENT_ID]?.isActive),
        transactionIds: permanentTransactions.map(transaction => transaction.transactionIdentifier).filter(Boolean)
    };
};

const isProductOwned = (ownership: PermanentPurchaseOwnership, productId: string) => {
    if (productId === PREMIUM_PRODUCT_ID) return ownership.premiumOwned;
    if (productId === STARTER_PRODUCT_ID) return ownership.starterOwned;
    if (productId === BOOKS_2_ALL_PRODUCT_ID) return ownership.books2AllOwned;
    if (productId === BOOKS_3_ALL_PRODUCT_ID) return ownership.books3AllOwned;
    if (productId === BOOKS_FOREVER_PRODUCT_ID) return ownership.booksForeverOwned;
    return false;
};

class IAPManager {
    private initialized = false;
    private localizedPrices: Record<string, string> = {};

    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
            try {
                await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
                await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                console.log('IAP: RevenueCat initialized for iOS');
                this.initialized = true;
            } catch (error) {
                console.error('IAP: Failed to initialize RevenueCat:', error);
            }
            return;
        }

        console.log('IAP: Web mode (mock purchases enabled)');
        this.initialized = true;
    }

    async getOwnership(): Promise<PermanentPurchaseOwnership | null> {
        if (!Capacitor.isNativePlatform()) return null;
        if (!this.initialized) await this.initialize();
        if (!this.initialized) return null;

        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            return getPermanentOwnership(customerInfo);
        } catch (error) {
            console.error('IAP: Failed to fetch customer ownership:', error);
            return null;
        }
    }

    async getLocalizedPrices(productIds: string[]): Promise<Record<string, string>> {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return {};
        if (!this.initialized) await this.initialize();
        if (!this.initialized) return {};

        const missingProductIds = productIds.filter(productId => !this.localizedPrices[productId]);

        if (missingProductIds.length > 0) {
            try {
                const { products } = await Purchases.getProducts({
                    productIdentifiers: missingProductIds,
                    type: PRODUCT_CATEGORY.NON_SUBSCRIPTION
                });

                products.forEach(product => {
                    if (product.priceString) {
                        this.localizedPrices[product.identifier] = product.priceString;
                    }
                });
            } catch (error) {
                console.error('IAP: Failed to fetch localized prices:', error);
            }
        }

        return productIds.reduce<Record<string, string>>((prices, productId) => {
            const localizedPrice = this.localizedPrices[productId];
            if (localizedPrice) prices[productId] = localizedPrice;
            return prices;
        }, {});
    }

    async purchase(productId: string): Promise<IAPPurchaseResult> {
        if (!Capacitor.isNativePlatform()) {
            console.log(`IAP: Mock purchasing ${productId}`);
            return new Promise(resolve => {
                window.setTimeout(() => {
                    resolve({
                        status: 'purchased',
                        productIdentifier: productId,
                        transactionIdentifier: `web-mock-${productId}-${Date.now()}`,
                        ownership: {
                            premiumOwned: productId === PREMIUM_PRODUCT_ID,
                            starterOwned: productId === STARTER_PRODUCT_ID,
                            books2AllOwned: productId === BOOKS_2_ALL_PRODUCT_ID,
                            books3AllOwned: productId === BOOKS_3_ALL_PRODUCT_ID,
                            booksForeverOwned: productId === BOOKS_FOREVER_PRODUCT_ID,
                            transactionIds: []
                        },
                        isMock: true
                    });
                }, 1000);
            });
        }

        if (!this.initialized) await this.initialize();
        if (!this.initialized) return { status: 'failed', message: 'Purchases are unavailable.' };

        try {
            if (PERMANENT_PRODUCT_IDS.has(productId)) {
                const { customerInfo: currentCustomerInfo } = await Purchases.getCustomerInfo();
                const currentOwnership = getPermanentOwnership(currentCustomerInfo);

                if (isProductOwned(currentOwnership, productId)) {
                    const existingTransaction = [...(currentCustomerInfo.nonSubscriptionTransactions || [])]
                        .reverse()
                        .find(transaction => transaction.productIdentifier === productId);

                    return {
                        status: 'restored',
                        productIdentifier: productId,
                        transactionIdentifier: existingTransaction?.transactionIdentifier || null,
                        ownership: currentOwnership,
                        isMock: false
                    };
                }
            }

            console.log(`IAP: Purchasing ${productId} via RevenueCat`);
            const { products } = await Purchases.getProducts({
                productIdentifiers: [productId],
                type: PRODUCT_CATEGORY.NON_SUBSCRIPTION
            });

            const product = products.find(candidate => candidate.identifier === productId);
            if (!product) {
                console.error('IAP: Product not found:', productId);
                return { status: 'failed', message: 'Product not found.' };
            }

            const purchaseResult = await Purchases.purchaseStoreProduct({ product });
            if (
                purchaseResult.productIdentifier !== productId ||
                purchaseResult.transaction.productIdentifier !== productId
            ) {
                console.error('IAP: Purchased product did not match request', purchaseResult);
                return { status: 'failed', message: 'The purchased product did not match.' };
            }

            const transactionIdentifier = purchaseResult.transaction.transactionIdentifier;
            if (!transactionIdentifier) {
                console.error('IAP: Successful Store response had no transaction identifier', purchaseResult);
                return { status: 'failed', message: 'The purchase could not be verified.' };
            }

            return {
                status: 'purchased',
                productIdentifier: purchaseResult.productIdentifier,
                transactionIdentifier,
                ownership: getPermanentOwnership(purchaseResult.customerInfo),
                isMock: false
            };
        } catch (error: any) {
            const cancelled = error?.code === 'PURCHASE_CANCELLED' || error?.userCancelled === true;
            if (cancelled) {
                console.log('IAP: Purchase cancelled by user');
                return { status: 'cancelled' };
            }

            console.error('IAP: Purchase failed', error);
            return { status: 'failed', message: error?.message || 'Unknown purchase error.' };
        }
    }

    async restore(): Promise<PermanentPurchaseOwnership | null> {
        if (!Capacitor.isNativePlatform()) {
            console.log('IAP: Mock restore has no store receipt');
            return {
                premiumOwned: false,
                starterOwned: false,
                books2AllOwned: false,
                books3AllOwned: false,
                booksForeverOwned: false,
                transactionIds: []
            };
        }

        if (!this.initialized) await this.initialize();
        if (!this.initialized) return null;

        try {
            console.log('IAP: Restoring purchases via RevenueCat');
            const { customerInfo } = await Purchases.restorePurchases();
            return getPermanentOwnership(customerInfo);
        } catch (error) {
            console.error('IAP: Restore failed', error);
            return null;
        }
    }
}

export const IAP = new IAPManager();
