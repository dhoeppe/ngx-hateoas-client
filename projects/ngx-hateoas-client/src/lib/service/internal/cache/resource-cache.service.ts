import { Injectable } from '@angular/core';
import { CachedResource } from './model/cached-resource';
import { StageLogger } from '../../../logger/stage-logger';
import { Stage } from '../../../logger/stage.enum';
import { CacheKey } from './model/cache-key';
import * as _ from 'lodash';
import { HttpConfigService } from '../../../config/http-config.service';
import { ValidationUtils } from '../../../util/validation.utils';
import { ResourceIdentifiable } from '../../../model/declarations';

@Injectable()
export class ResourceCacheService {

  public static DEFAULT_CACHE_LIFE_TIME = 5 * 60 * 1000;

  public enabled: boolean;

  /**
   * Time before cache was expired (seconds).
   */
  private cacheLifeTime: number = ResourceCacheService.DEFAULT_CACHE_LIFE_TIME;

  private cacheMap: Map<string, CachedResource<ResourceIdentifiable>> = new Map<string, CachedResource<ResourceIdentifiable>>();

  constructor(private httpConfig: HttpConfigService) {
  }

  /**
   * Get cached resource value.
   *
   * @param key cache key
   * @return cached value or {@code null} when cached value is not exist or expired
   */
  public getResource(key: CacheKey): ResourceIdentifiable {
    ValidationUtils.validateInputParams({key});

    const cacheValue = this.cacheMap.get(key.value);
    if (_.isNil(cacheValue)) {
      StageLogger.stageLog(Stage.CACHE_GET, {cacheKey: key.value, result: null});
      return null;
    }

    const cacheExpiredTime = new Date(cacheValue.cachedTime);
    cacheExpiredTime.setSeconds(cacheExpiredTime.getSeconds() + this.cacheLifeTime);
    if (cacheExpiredTime.getTime() < new Date().getTime()) {
      this.cacheMap.delete(key.value);
      StageLogger.stageLog(Stage.CACHE_GET, {cacheKey: key.value, message: 'cache was expired', result: null});
      return null;
    }

    StageLogger.stageLog(Stage.CACHE_GET, {cacheKey: key.value, result: cacheValue.value});
    return cacheValue.value;
  }

  /**
   * Add resource value to the cache.
   * Before add new value, previous will be deleted if it was exist.
   *
   * @param key cache key
   * @param value cache value
   */
  public putResource(key: CacheKey, value: ResourceIdentifiable): void {
    ValidationUtils.validateInputParams({key, value});

    // TODO проверить надо ли удалять старое
    this.cacheMap.delete(key.value);
    this.cacheMap.set(key.value, new CachedResource(value, new Date()));

    StageLogger.stageLog(Stage.CACHE_PUT, {cacheKey: key.value, value});
  }

  /**
   * Delete cached resource value by passed key.
   *
   * @param key cache key
   */
  public evictResource(key: CacheKey): void {
    ValidationUtils.validateInputParams({key});

    // Get resource name by url to evict all resource cache with collection/paged collection data
    const resourceName = key.url.replace(`${ this.httpConfig.baseApiUrl }/`, '').split('/')[0];
    if (!resourceName) {
      return;
    }
    const evictedCache = [];
    for (const cacheKey of this.cacheMap.keys()) {
      if (cacheKey.startsWith(`url=${ this.httpConfig.baseApiUrl }/${ resourceName }`)) {
        evictedCache.push({
          key: cacheKey
        });
        this.cacheMap.delete(cacheKey);
      }
    }
    if (evictedCache.length > 0) {
      StageLogger.stageLog(Stage.CACHE_EVICT, {cacheKey: key.value, evicted: evictedCache});
    }
  }

  public setCacheLifeTime(lifeTime: number) {
    this.cacheLifeTime = lifeTime;
  }

}
