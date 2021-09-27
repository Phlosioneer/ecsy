
/**
 * @template T
 * @typedef {{
 *  name: string,
 *  default: T | Partial<T>,
 *  copy: (src: T, dest: T) => T,
 *  clone: (value: T) => T,
 *  isType: true
 * }} PropType<T,D>
 */

import { Entity } from "./Entity";
import environment from "./environment";

/**
 * @typedef {string} QueryKey
 */

/**
 * Copy something by value.
 * 
 * Identical to cloning for simple values, like strings.
 * 
 * @template T
 * @param {T} src 
 * @returns T
 */
export const copyValue = (src) => src;

/**
 * Clone something by value.
 * 
 * @template T
 * @param {T} src 
 * @returns T
 */
export const cloneValue = (src) => src;

/**
 * Copy an array, reusing every element of the original array (a "shallow" copy).
 * 
 * If a destination is given, that array is reused for the copy. Otherwise, the original
 * is cloned.
 * 
 * This function is safe to use with `null` and `undefined`.
 * 
 * @template T The type of each element in the array, can be `any`.
 * @param {T[]} src The array to copy.
 * @param {T[]} [dest] Optional array to reuse.
 * @returns {T[]} The new array, or `dest` if it was given.
 */
export const copyArray = (src, dest) => {
  if (!src) {
    return src;
  }

  if (!dest) {
    return src.slice();
  }

  dest.length = 0;

  for (let i = 0; i < src.length; i++) {
    dest.push(src[i]);
  }

  return dest;
};

/**
 * Clone an array, reusing each element of the original array (a "shallow" clone).
 * 
 * This function is safe to use with `null` and `undefined`.
 * 
 * @template T
 * @param {T[]} src 
 * @returns {T[]}
 */
export const cloneArray = (src) => src && src.slice();

/**
 * Expensive way to create a "deep" copy of an object or array of objects.
 * 
 * There is no way to reuse an object for JSON.parse, so this is equivalent
 * to `cloneJSON`.
 * 
 * This function is safe to use with `null` but is NOT safe with `undefined`.
 * 
 * @template T
 * @param {T} src 
 * @returns {T}
 */
export const copyJSON = (src) => JSON.parse(JSON.stringify(src));

/**
 * Expensive way to create a "deep" clone of an object or array of objects.
 * 
 * This function is safe to use with `null` but is NOT safe with `undefined`.
 * 
 * @template T
 * @param {T} src 
 * @returns {T}
 */
export const cloneJSON = (src) => JSON.parse(JSON.stringify(src));

/**
 * Copy an object that has its own `copy` and `clone` functions.
 * 
 * If a destination is provided, this is equivalent to `dest.copy(src)`.
 * Otherwise, it's equivalent to `src.clone()`.
 * 
 * This function is safe to use with `null` and `undefined`.
 * 
 * @template {{copy: (src: T) => T, clone: () => T}} T A type with copy and clone functions
 * @param {T} src The object to copy
 * @param {T} [dest] An object to reuse for copying
 * @returns {T} The new object, or `dest` if it was provided.
 */
export const copyCopyable = (src, dest) => {
  if (!src) {
    return src;
  }

  if (!dest) {
    return src.clone();
  }

  return dest.copy(src);
};

/**
 * Clone an object that has its own `clone` function.
 *
 * This function is safe to use with `null` and `undefined`.
 * 
 * @template {{ clone: () => T}} T A type with a clone function
 * @param {T} src 
 * @returns {T}
 */
export const cloneClonable = (src) => src && src.clone();


/**
 * @template T
 * @param {Partial<PropType<T>>} typeDefinition 
 * @returns {PropType<T>}
 */
export function createType(typeDefinition) {
  var mandatoryProperties = ["name", "default", "copy", "clone"];

  var undefinedProperties = mandatoryProperties.filter((p) => {
    return !typeDefinition.hasOwnProperty(p);
  });

  if (undefinedProperties.length > 0) {
    throw new Error(
      `createType expects a type definition with the following properties: ${undefinedProperties.join(
        ", "
      )}`
    );
  }

  typeDefinition.isType = true;

  return /** @type {PropType<T>} */ (typeDefinition);
}

class EntityRef {
  /**
   * @param {Entity} [entity] The initial entity to reference
   */
  constructor(entity) {
    /** @type {number?} */
    this.targetId = null;
    /** @type {import("./Entity").Entity?} */
    this._target = null;

    if (entity) {
      this.entity = entity;
    }
  }

  /**
   * The referenced entity. Attempting to access a dead entity will always fail.
   */
  get entity() {
    if (this.targetId === null) {
      return undefined;
    } else if (this.targetId === this._target.id) {
      return this._target;
    } else {
      if (environment.isDev) {
        throw new Error("Entity " + this.targetId + " has been removed from world!");
      } else {
        return undefined;
      }
    }
  }

  /**
   * @param {import("./Entity").Entity} newTarget
   */
  set entity(newTarget) {
    if (!newTarget) {
      this.targetId = null;
      this._target = null;
    } else if (newTarget instanceof Entity) {
      if (newTarget.alive) {
        this.targetId = newTarget.id;
        this._target = newTarget;
      } else {
        this.targetId = null;
        this._target = null;
        if (environment.isDev) {
          console.warn("EntityRef set to entity that has been removed; using undefined instead " + this.targetId);
        }
      }
    } else {
      if (environment.isDev) {
        throw new Error("EntityRef set to a non-entity object!");
      } else {
        this.targetId = null;
        this._target = null;
      }
    }
  }

  /**
   * Check whether or not the entity is alive.
   */
  get alive() {
    if (this.targetId !== null && this.targetId === this._target.id) {
      return this._target.alive;
    } else {
      return false;
    }
  }

  /**
   * Make `this` a copy of `other`.
   * @param {EntityRef} other 
   */
  copy(other) {
    this.targetId = other.targetId;
    this._target = other._target;
    return this;
  }

  clone() {
    return new EntityRef().copy(this);
  }
}

/**
 * Standard types
 */
export const Types = {
  /** Default: 0 */
  Number: createType({
    name: "Number",
    default: 0,
    copy: copyValue,
    clone: cloneValue,
  }),

  /** Default: false */
  Boolean: createType({
    name: "Boolean",
    default: false,
    copy: copyValue,
    clone: cloneValue,
  }),

  /**
   * Default: ""
   */
  String: createType({
    name: "String",
    default: "",
    copy: copyValue,
    clone: cloneValue,
  }),

  /**
   * When copying or cloning a property with this type, ECSY will do a shallow
   * copy, preserving references to the original elements. If you need a deep
   * copy of the array, consider `Types.JSON`.
   * 
   * Default: []
   */
  Array: createType({
    name: "Array",
    default: [],
    copy: copyArray,
    clone: cloneArray,
  }),

  /**
   * Ref values are never directly copied or cloned. The reference to the same
   * object will be shared by the component's copies. If you're looking for a
   * deep copy/clone, see `Types.JSON`.
   * 
   * NEVER STORE A REF TO AN ENTITY OR COMPONENT! An entity or component can
   * be reused if object pools are enabled! Use the `Types.Entity` or
   * `Types.Component` types instead.
   * 
   * Default: `undefined`.
   */
  Ref: createType({
    name: "Ref",
    default: undefined,
    copy: copyValue,
    clone: cloneValue,
  }),

  /**
   * JSON values are plain objects that are always deep copy/cloned. The deep
   * copy is accomplished through `JSON.parse(JSON.stringify(object))`. This is
   * an expensive operation, though sometimes useful during development.
   * 
   * The object cannot have any circular references, or else the `JSON.stringify`
   * operation will fail.
   * 
   * Default: `null`.
   */
  JSON: createType({
    name: "JSON",
    default: null,
    copy: copyJSON,
    clone: cloneJSON,
  }),

  /**
   * Safely stores an Entity. The EntityRef will keep track of the entity's unique
   * id and will throw an error when accessing an entity that has been removed and
   * reused.
   * 
   * @type {PropType<EntityRef>}
   */
  Entity: createType({
    name: "Entity",
    default: new EntityRef(),
    copy: copyCopyable,
    clone: cloneClonable,
  })
};
