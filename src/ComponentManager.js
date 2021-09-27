import { Component } from "./Component.js";
import { ObjectPool } from "./ObjectPool.js";

/**
 * @template {Component} C
 * @typedef {import("./Component.js").ComponentConstructor<C>} ComponentConstructor<C>
 */

export class ComponentManager {
  
  constructor() {
    /**
     * @type {ComponentConstructor<any>[]}
     */
    this.Components = [];

    /**
     * @type {{[typeId: number]: ComponentConstructor<any>}}
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
  }

  /**
   * 
   * @param {ComponentConstructor<any>} Component 
   */
  hasComponent(Component) {
    return this.Components.indexOf(Component) !== -1;
  }

  /**
   * @template {Component} C
   * @param {ComponentConstructor<C>} Component 
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
   * @param {ComponentConstructor<any>} Component 
   */
  componentAddedToEntity(Component) {
    this.numComponents[Component._typeId]++;
  }

  /**
   * 
   * @param {ComponentConstructor<any>} Component 
   */
  componentRemovedFromEntity(Component) {
    this.numComponents[Component._typeId]--;
  }

  /**
   * @template {Component} C
   * @param {ComponentConstructor<C>} Component 
   * @returns {ObjectPool<C>?}
   */
  getComponentsPool(Component) {
    return this._componentPool[Component._typeId];
  }
}

ComponentManager._nextComponentId = 1;