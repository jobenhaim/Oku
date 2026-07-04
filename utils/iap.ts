
class IAPManager {
    private initialized = false;

    async initialize() {
        console.log("IAP: Web Mode (Mock Initialized)");
        this.initialized = true;
    }

    // Returns a promise that resolves on success, false on fail/cancel
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
        alert("Restore successful (Mock Mode)");
    }
}

export const IAP = new IAPManager();

