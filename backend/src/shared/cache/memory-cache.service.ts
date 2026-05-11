import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { CacheProvider } from './cache.interface.js';

interface CacheItem {
  value: unknown;
  expireAt: number;
}

@Injectable()
export class MemoryCacheService
  implements CacheProvider, OnApplicationShutdown
{
  private readonly cache = new Map<string, CacheItem>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU: 更新访问顺序
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value as T;
  }

  async set(key: string, value: unknown, ttl = 3600): Promise<void> {
    // LRU 淘汰：超出 maxSize 时删除最久未访问的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async reset(): Promise<void> {
    this.cache.clear();
  }

  onApplicationShutdown(): void {
    this.cache.clear();
  }
}
