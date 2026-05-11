import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  setCurrentTenant(tenantId: string, fn: () => void): void {
    storage.run({ tenantId }, fn);
  },

  getCurrentTenant(): string | undefined {
    return storage.getStore()?.tenantId;
  },

  requireCurrentTenant(): string {
    const tenantId = storage.getStore()?.tenantId;
    if (!tenantId) {
      throw new Error('TenantContext: no tenant in current context');
    }
    return tenantId;
  },
};
