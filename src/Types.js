
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
 * @template T
 * @param {T} src 
 * @returns T
 */
export const copyValue = (src) => src;

/**
 * @template T
 * @param {T} src 
 * @returns T
 */
export const cloneValue = (src) => src;

/**
 * @template T
 * @param {T[]} src 
 * @param {T[]?} dest 
 * @returns {T[]}
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
 * @template T
 * @param {T[]} src 
 * @returns {T[]}
 */
export const cloneArray = (src) => src && src.slice();

/**
 * @template T
 * @param {T} src 
 * @returns {T}
 */
export const copyJSON = (src) => JSON.parse(JSON.stringify(src));

/**
 * @template T
 * @param {T} src 
 * @returns {T}
 */
export const cloneJSON = (src) => JSON.parse(JSON.stringify(src));

/**
 * @template {{copy: (T) => T, clone: (T) => T}} T
 * @param {T} src 
 * @param {T} dest 
 * @returns {T}
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
 * @template {{ clone: (T) => T}} T
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
  constructor() {
    /** @type {number?} */
    this.targetId = null;
    /** @type {import("./Entity").Entity?} */
    this._target = null;
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
   * Make `thi` a copy of `other`.
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
