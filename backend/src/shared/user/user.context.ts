import { AsyncLocalStorage } from 'async_hooks';

interface UserStore {
  userId: string;
}

const storage = new AsyncLocalStorage<UserStore>();

export const UserContext = {
  setCurrentUser(userId: string, fn: () => void): void {
    storage.run({ userId }, fn);
  },

  getCurrentUserId(): string | undefined {
    return storage.getStore()?.userId;
  },
};
