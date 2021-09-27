/**
 * @typedef {{
 *  reset: () => void,
 *  _pool: ObjectPool
 * }} PoolableObject
 */

/**
 * @template {PoolableObject} T
 * @typedef {new(...args: any[]) => T} PoolableObjectConstructor<T>
 */

/**
 * Note: There is no list of assigned objects. There are no consequences if an
 * entity never returns to the pool.
 * @template {PoolableObject} T
 */
export class ObjectPool {
  
  /**
   * @param {PoolableObjectConstructor<T>} Type The type of object in this pool
   * @param {number} [initialSize] The initial number of objects in the pool. Defaults to 0.
   */
  constructor(Type, initialSize) {
    /**
     * The list of unassigned objects.
     * @type {T[]}
     */
    this.freeList = [];

    /**
     * The number of objects that have been created by this object pool.
     */
    this.count = 0;

    /**
     * The type of object in this pool.
     * @type {PoolableObjectConstructor<T>}
     */
    this.Type = Type;

    /**
     * @type {true}
     */
    this.isObjectPool = true;

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  /**
   * Get a new object from the pool.
   */
  acquire() {
    // Grow the list by 20%ish if we're out
    if (this.freeList.length <= 0) {
      this.expand(Math.round(this.count * 0.2) + 1);
    }

    var item = this.freeList.pop();

    return item;
  }

  /**
   * Reset the item and return it to the pool.
   * @param {T} item 
   */
  release(item) {
    item.reset();
    this.freeList.push(item);
  }

  /**
   * Expand the free list by `count` items.
   * @param {number} count 
   */
  expand(count) {
    for (var n = 0; n < count; n++) {
      var clone = new this.Type();
      clone._pool = this;
      this.freeList.push(clone);
    }
    this.count += count;
  }

  /**
   * Ensure that there are at least `count` items available.
   * @param {number} count
   */
  ensureAtLeast(count) {
    if (count > this.freeList.length) {
      this.expand(count - this.freeList.length);
    } 
  }

  totalSize() {
    return this.count;
  }

  totalFree() {
    return this.freeList.length;
  }

  totalUsed() {
    return this.count - this.freeList.length;
  }

  stats() {
    return {
      used: this.totalUsed(),
      free: this.totalFree(),
      size: this.totalSize()
    }
  }
}
