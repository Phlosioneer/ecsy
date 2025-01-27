import { Component } from "./Component.js";
import { ObjectPool } from "./ObjectPool.js";
import { Tag } from "./Tag.js";

export class ComponentManager {
  
  constructor() {
    /**
     * @type {import("./constants").ComponentConstructor<any>[]}
     */
    this.Components = [];

    /**
     * @type {{[typeId: number]: import("./constants").ComponentConstructor<any>}}
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
   * @param {import("./constants").ComponentConstructor<any>} Component 
   */
  hasComponent(Component) {
    return this.Components.indexOf(Component) !== -1;
  }

  /**
   * @template {Component} C
   * @param {import("./constants").ComponentConstructor<C>} Component 
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
   * @param {import("./constants").ComponentConstructor<any>} Component 
   */
  componentAddedToEntity(Component) {
    this.numComponents[Component._typeId]++;
  }

  /**
   * 
   * @param {import("./constants").ComponentConstructor<any>} Component 
   */
  componentRemovedFromEntity(Component) {
    this.numComponents[Component._typeId]--;
  }

  /**
   * @template {Component} C
   * @param {import("./constants").ComponentConstructor<C>} Component 
   * @returns {ObjectPool<C>?}
   */
  getComponentsPool(Component) {
    return this._componentPool[Component._typeId];
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
        throw new Error("Cannot register a tag with the same name as a registered tag or relation: " + tag);
      } else {
        this._tags[tag] = new Tag(tag, ComponentManager._nextComponentId, false);
        ComponentManager._nextComponentId += 1;
      }
    } else {
      // Reuse tag from another world
      if (tag.isRelation) {
        throw new Error("Cannot register a tag object from one world as a relation in another world: " + tag.name);
      }
      if (this._tags[tag.name]) {
        throw new Error("Cannot register a tag with the same name as a registered tag or relation: " + tag.name);
      } else {
        this._tags[tag.name] = tag;
      }
    }
  }

  /**
   * 
   * @param {Tag | string} relation 
   */
  registerRelation(relation) {
    if (typeof relation === "string") {
      // New tag
      if (this._tags[relation]) {
        throw new Error("Cannot register a relation with the same name as a registered tag or relation: " + relation);
      } else {
        this._tags[relation] = new Tag(relation, ComponentManager._nextComponentId, true);
        ComponentManager._nextComponentId += 1;
      }
    } else {
      // Reuse tag from another world
      if (!relation.isRelation) {
        throw new Error("Cannot register a relation object from one world as a tag in another world: " + relation.name);
      }
      if (this._tags[relation.name]) {
        throw new Error("Cannot register a relation with the same name as a registered tag or relation: " + relation.name);
      } else {
        this._tags[relation.name] = relation;
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
   * @param {import("./Tag").Tag} tag 
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