import { Component } from "./Component.js";
import { ObjectPool } from "./ObjectPool.js";
import { Tag } from "./Tag.js";

export class ComponentManager {
  
  constructor() {
    /**
     * @type {import("./Typedefs").ComponentConstructor<any>[]}
     */
    this.Components = [];

    /**
     * @type {{[typeId: number]: import("./Typedefs").ComponentConstructor<any>}}
     */
    this._ComponentsMap = {};

    /**
     * @type {{[typeId: number]: ObjectPool}}
     */
    this._componentPool = {};

    /**
     * @type {{[typeId: number]: number}}
     */
    this.numComponents = {};

    /**
     * @type {number}
     */
    this.nextComponentId = 0;

    /**
     * All registered tags by name
     * @type {{ [name: string]: Tag }}
     */
    this._tags = {}
  }

  /**
   * 
   * @param {import("./Typedefs").ComponentConstructor<any>} Component 
   */
  hasComponent(Component) {
    return this.Components.indexOf(Component) !== -1;
  }

  /**
   * @template {Component} C
   * @param {import("./Typedefs").ComponentConstructor<C>} Component 
   * @param {ObjectPool<C> | false} [objectPool]
   */
  registerComponent(Component, objectPool) {
    if (this.Components.indexOf(Component) !== -1) {
      console.warn(
        `Component type: '${Component.getName()}' already registered.`
      );
      return;
    }

    const schema = Component.schema;

    if (!schema) {
      throw new Error(
        `Component "${Component.getName()}" has no schema property.`
      );
    }

    for (const propName in schema) {
      const prop = schema[propName];

      if (!prop.type) {
        throw new Error(
          `Invalid schema for component "${Component.getName()}". Missing type for "${propName}" property.`
        );
      }
    }

    if (Component._typeId === undefined) {
      Component._typeId = ComponentManager._nextComponentId++;
    }
    this.Components.push(Component);
    this._ComponentsMap[Component._typeId] = Component;
    this.numComponents[Component._typeId] = 0;

    let pool;
    if (objectPool === undefined) {
      pool = new ObjectPool(Component);
    } else if (objectPool === false) {
      pool = undefined;
    } else {
      pool = objectPool
    }
    this._componentPool[Component._typeId] = pool;
  }

  /**
   * 
   * @param {import("./Typedefs").ComponentConstructor<any>} Component 
   */
  componentAddedToEntity(Component) {
    this.numComponents[Component._typeId]++;
  }

  /**
   * 
   * @param {import("./Typedefs").ComponentConstructor<any>} Component 
   */
  componentRemovedFromEntity(Component) {
    this.numComponents[Component._typeId]--;
  }

  /**
   * @template {Component} C
   * @param {import("./Typedefs").ComponentConstructor<C>} Component 
   * @returns {ObjectPool<C>?}
   */
  getComponentsPool(Component) {
    return this._componentPool[Component._typeId];
  }

  /**
   * Create a new tag and register it.
   * @param {string} name 
   */
  createTag(name) {
    if (this._tags[name]) {
      throw new Error("Cannot create a new tag with the same name as a registered tag: " + name);
    }

    const tag = new Tag(name, ComponentManager._nextComponentId);
    ComponentManager._nextComponentId += 1;
    this._tags[name] = tag;
    return tag;
  }

  /**
   * Register a tag that was created by another world, or that was unregistered.
   * 
   * @param {Tag | string} tag 
   */
  registerTag(tag) {
    if (typeof tag === "string") {
      // New tag
      if (this._tags[tag]) {
        throw new Error("Cannot register a tag with the same name as a registered tag: " + tag);
      } else {
        this._tags[tag] = new Tag(tag, ComponentManager._nextComponentId);
        ComponentManager._nextComponentId += 1;
      }
    } else {
      // Reuse tag from another world
      if (this._tags[tag.name]) {
        throw new Error("Cannot register a tag with the same name as a registered tag: " + tag.name);
      } else {
        this._tags[tag.name] = tag;
      }
    }
  }

  /**
   * Get the tag object for a given tag name, if it exists.
   * 
   * @param {string} name
   * @returns {Tag?}
   */
  getTag(name) {
    return this._tags[name];
  }

  /**
   * 
   * @param {import ("./Tag").Tag} tag 
   * @returns 
   */
  hasRegisteredTag(tag) {
    return this._tags[tag.name] === tag;
  }

  /**
   * Unregister the tag if it was registered. Does nothing if the tag doesn't
   * exist.
   * @param {string} name 
   */
  unregisterTag(name) {
    delete this._tags[name]
  }
}

ComponentManager._nextComponentId = 1;