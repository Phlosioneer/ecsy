import { Component } from "./Component";
import environment from "./environment.js";
import { Query } from "./Query.js";
import wrapImmutableComponent from "./WrapImmutableComponent.js";

/**
 * Imported
 * @template {Component} C
 * @typedef {import("./Component.js").ComponentConstructor<C>} ComponentConstructor<C>
 */

/**
 * Imported
 * @typedef {import("./Tag").Tag} Tag
 */



/**
 * @typedef {{
 *  [key: string]: Component
 * }} ComponentLookup
 */

/**
 * An entity in the world.
 */
export class Entity {
  /**
   * 
   * @param {import("./EntityManager").EntityManager} entityManager 
   */
  constructor(entityManager) {
    
    /**
     * Unique ID for this entity
     * @type {number}
     */
    this.id = entityManager._nextEntityId++;
    
    /**
     * Whether or not the entity is alive or removed.
     * @type {boolean}
     */
    this.alive = false;

    /**
     * @type {import("./EntityManager.js").EntityManager?}
     */
    this._entityManager = entityManager || null;
    
    /**
     * List of components types the entity has
     * @type {ComponentConstructor<any>[]}
     */
    this._ComponentTypes = [];

    /**
     * Instances of the components, by their class's ID number
     * @type {ComponentLookup}
     */ 
    this._components = {};

    /**
     * List of tags the entity has
     * @type {Tag[]}
     */
    this._tags = [];

    /**
     * The queries that this entity is part of
     * @type {import("./Query").Query[]}
     */
    this.queries = [];

    /**
     * Entries from `_ComponentTypes` that are waiting for deferred removal
     * @type {ComponentConstructor<any>[]}
     */
    this._ComponentTypesToRemove = [];

    /**
     * Entries from `_components` that are waiting for deferred removal
     * @type {ComponentLookup}
     */
    this._componentsToRemove = {};

    /**
     * Entries from `_tags` that are waiting for deferred removal
     * @type {Tag[]}
     */
    this._tagsToRemove = [];

    /**
     * if there are state components on a entity, it can't be removed completely
     * @type {number}
     */
    this.numStateComponents = 0;

    /**
     * @type {import("./EntityManager").EntityPool}
     */
    this._pool = undefined;

    /**
     * The entity's unique name.
     * @type {string}
     */
    this.name = "";
  }

  ///////////////////////////////////////////////////////////////////////////
  // COMPONENTS
  //
  // Entity offloads most of the work for adding and removing components
  // to the entityManager.

  /**
   * Get an immutable reference to a component on this entity.
   * @template {Component} C
   * @param {ComponentConstructor<C>} Component Type of component to get
   * @param {boolean} [includeRemoved] Whether a component that is staled to be removed should be also considered
   * @returns {C?}
   */
  getComponent(Component, includeRemoved) {
    var component = /** @type {C?} */ (this._components[Component._typeId]);

    if (!component && includeRemoved === true) {
      component = /** @type {C?} */ (this._componentsToRemove[Component._typeId]);
    }

    return environment.isDev
      ? wrapImmutableComponent(Component, component)
      : component;
  }

  /**
   * Get a component that is slated to be removed from this entity.
   * @template {Component} C
   * @param {ComponentConstructor<C>} Component Type of component to get
   * @returns {C?}
   */
  getRemovedComponent(Component) {
    const component = /** @type {C?} */ (this._componentsToRemove[Component._typeId]);

    return environment.isDev
      ? wrapImmutableComponent(Component, component)
      : component;
  }

  /**
   * Get a list of component types that have been added to this entity.
   */
  getComponentTypes() {
    return this._ComponentTypes;
  }

  /**
   * Get a mutable reference to a component on this entity.
   * @template {Component} C
   * @param {ComponentConstructor<C>} Component Type of component to get
   * @returns {C?}
   */
  getMutableComponent(Component) {
    var component = (/** @type {C?} */ (this._components[Component._typeId]));

    if (!component) {
      return;
    }

    for (var i = 0; i < this.queries.length; i++) {
      var query = this.queries[i];
      // @todo accelerate this check. Maybe having query._Components as an object
      // @todo add Not components
      if (query.reactive && query.filter.components.indexOf(Component) !== -1) {
        query.eventDispatcher.dispatchEvent(
          Query.prototype.COMPONENT_CHANGED,
          this,
          component
        );
      }
    }
    return component;
  }

  /**
   * Add a component to the entity.
   * @param {ComponentConstructor<any>} Component Type of component to add to this entity
   * @param {object} [values] Optional values to replace the default attributes on the component
   */
  addComponent(Component, values) {
    this._entityManager.entityAddComponent(this, Component, values);
    return this;
  }

  /**
   * Remove a component from the entity.
   * @param {ComponentConstructor<any>} Component Type of component to remove from this entity
   * @param {boolean} [forceImmediate] Whether a component should be removed immediately
   */
  removeComponent(Component, forceImmediate) {
    this._entityManager.entityRemoveComponent(this, Component, forceImmediate);
    return this;
  }

  /**
   * Check if the entity has a component.
   * @param {ComponentConstructor<any>} Component Type of component
   * @param {boolean} [includeRemoved] Whether a component that is staled to be removed should be also considered
   */
  hasComponent(Component, includeRemoved) {
    return (
      !!~this._ComponentTypes.indexOf(Component) ||
      (includeRemoved === true && this.hasRemovedComponent(Component))
    );
  }

  /**
   * Check if the entity has a component that is slated to be removed.
   * @param {ComponentConstructor<any>} Component Type of component
   */
  hasRemovedComponent(Component) {
    return !!~this._ComponentTypesToRemove.indexOf(Component);
  }

  /**
   * Check if the entity has all components in a list.
   * @param {ComponentConstructor<any>[]} Components Component types to check
   */
  hasAllComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.hasComponent(Components[i])) return false;
    }
    return true;
  }

  /**
   * Check if the entity has any of the components in a list.
   * @param {ComponentConstructor<any>[]} Components Component types to check
   */
  hasAnyComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (this.hasComponent(Components[i])) return true;
    }
    return false;
  }

  /**
   * Remove all components on this entity.
   * @param {boolean} [forceImmediate] Whether all components should be removed immediately
   */
  removeAllComponents(forceImmediate) {
    this._entityManager.entityRemoveAllComponents(this, forceImmediate);
  }

  ///////////////////////////////////////////////////////////////////////////
  // TAGS
  //
  // Entity offloads most of the work of adding and removing tags to the
  // entityManager.

  getTags() {
    return this._tags;
  }

  /**
   * Adds `tag` to this entity, if it wasn't already on this entity.
   * @param {Tag | string} tag 
   */
  addTag(tag) {
    this._entityManager.entityAddTag(this, tag);
    return this;
  }

  /**
   * Removes `tag` from this entity, if it was on this entity. 
   * @param {Tag | string} tag 
   * @param {boolean} [forceImmediate]
   */
  removeTag(tag, forceImmediate) {
    this._entityManager.entityRemoveTag(this, tag, forceImmediate);
    return this;
  }

  /**
   * 
   * @param {Tag | string} tag 
   * @param {boolean} [includeRemoved]
   */
  hasTag(tag, includeRemoved) {
    includeRemoved = !!includeRemoved;
    let tagObj = this._entityManager.world._getTagOrError(tag);
    return this._tags.includes(tagObj) ||
      (includeRemoved && this._tagsToRemove.includes(tagObj));
  }

  /**
   * 
   * @param {Tag | string} tag 
   */
  hasRemovedTag(tag) {
    let tagObj = this._entityManager.world._getTagOrError(tag);
    return this._tagsToRemove.includes(tagObj);
  }

  /**
   * 
   * @param {Tag[]} tags 
   */
  hasAllTags(tags) {
    for (let i = 0; i < tags.length; i++) {
      if (!this._tags.includes(tags[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * 
   * @param {Tag[]} tags 
   */

  hasAnyTags(tags) {
    for (let i = 0; i < tags.length; i++) {
      if (this._tags.includes(tags[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * 
   * @param {boolean} [forceImmediate]
   */
  removeAllTags(forceImmediate) {
    this._entityManager.entityRemoveAllTags(this, forceImmediate);
  }

  ///////////////////////////////////////////////////////////////////////////
  // MISC

  /**
   * Copies all components from `source` to this entity. To achieve a true copy
   * of the `source` entity, call `removeAllComponents()` first.
   * 
   * This method attempts to do a "deep" copy, though references may be shared
   * depending on how component field types implement `copy()`.
   * 
   * TODO: This method seems flimsy. Create tests for chaining deferred removal
   * into copying.
   * @param {this} src The "template" entity to copy from
   */
  copy(src) {
    // TODO: This can definitely be optimized
    for (var ecsyComponentId in src._components) {
      var srcComponent = src._components[ecsyComponentId];
      this.addComponent((/** @type {any} */ (srcComponent)).constructor);
      var component = this.getComponent((/** @type {any} */ (srcComponent)).constructor);
      component.copy(srcComponent);
    }

    return this;
  }

  /**
   * Creates a new entity that is a deep copy of this entity and all its components.
   * 
   * This method attempts to do a "deep" copy, though references may be shared
   * depending on how component field types implement `copy()`.
   */
  clone() {
    return new Entity(this._entityManager).copy(this);
  }

  /**
   * Removes all components from this entity and then assigns a new object id.
   * 
   * TODO: This method doesn't tell queries that it has been reset, nor does it
   * fire any new entity / destroy entity events! Same goes for all of its
   * components!
   */
  reset() {
    this.id = this._entityManager._nextEntityId++;
    this._ComponentTypes.length = 0;
    this.queries.length = 0;

    for (var ecsyComponentId in this._components) {
      delete this._components[ecsyComponentId];
    }
  }

  /**
   * Remove this entity from the world.
   * @param {boolean} [forceImmediate] Whether this entity should be removed immediately
   */
  remove(forceImmediate) {
    this._entityManager.removeEntity(this, forceImmediate);
  }
}
