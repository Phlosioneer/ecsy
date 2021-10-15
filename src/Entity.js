import { Component } from "./Component";
import { EntityHandle } from "./EntityHandle";
import environment from "./environment.js";
import { QueryEvents } from "./constants.js";
import { Tag } from "./Tag";
import wrapImmutableComponent from "./WrapImmutableComponent.js";


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
    ///////////////////////////////////////////////
    // Public fields

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
     * The entity's unique name.
     * @type {string}
     */
     this.name = "";

    ///////////////////////////////////////////////
    // Private fields

    /**
     * @type {import("./EntityManager").EntityManager?}
     */
    this._entityManager = entityManager || null;
    
    /**
     * List of components types the entity has
     * @type {import("./Typedefs").ComponentConstructor<any>[]}
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
     * Pairs that the entity has
     * @type {{ [tagName: string]: import("./EntityHandle").EntityHandleType[] }}
     */
    this._pairs = {};

    /**
     * The queries that this entity is part of
     * @type {import("./Query").Query[]}
     */
    this.queries = [];

    /**
     * Entries from `_ComponentTypes` that are waiting for deferred removal
     * @type {import("./Typedefs").ComponentConstructor<any>[]}
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
     * Entries from `_pairs` that are waiting for deferred removal
     * @type {{ [tagName: string]: import("./EntityHandle").EntityHandleType[] }}
     */
    this._pairsToRemove = {};

    /**
     * if there are state components on a entity, it can't be removed completely
     * @type {number}
     */
    this.numStateComponents = 0;

    /**
     * @type {import("./EntityManager").EntityPool}
     */
    this._pool = undefined;

    this._cachedHandle = null;
  }

  ///////////////////////////////////////////////////////////////////////////
  // COMPONENTS
  //
  // Entity offloads most of the work for adding and removing components
  // to the entityManager.

  /**
   * Get an immutable reference to a component on this entity.
   * @template {Component} C
   * @param {import("./Typedefs").ComponentConstructor<C>} Component Type of component to get
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
   * @param {import("./Typedefs").ComponentConstructor<C>} Component Type of component to get
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
   * @param {import("./Typedefs").ComponentConstructor<C>} Component Type of component to get
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
          QueryEvents.changed,
          this,
          component
        );
      }
    }
    return component;
  }

  /**
   * Add a component to the entity.
   * @param {import("./Typedefs").ComponentConstructor<any>} Component Type of component to add to this entity
   * @param {object} [values] Optional values to replace the default attributes on the component
   */
  addComponent(Component, values) {
    this._entityManager.entityAddComponent(this, Component, values);
    return this;
  }

  /**
   * Remove a component from the entity.
   * @param {import("./Typedefs").ComponentConstructor<any>} Component Type of component to remove from this entity
   * @param {boolean} [forceImmediate] Whether a component should be removed immediately
   */
  removeComponent(Component, forceImmediate) {
    this._entityManager.entityRemoveComponent(this, Component, forceImmediate);
    return this;
  }

  /**
   * Check if the entity has a component.
   * @param {import("./Typedefs").ComponentConstructor<any>} Component Type of component
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
   * @param {import("./Typedefs").ComponentConstructor<any>} Component Type of component
   */
  hasRemovedComponent(Component) {
    return !!~this._ComponentTypesToRemove.indexOf(Component);
  }

  /**
   * Check if the entity has all components in a list.
   * @param {import("./Typedefs").ComponentConstructor<any>[]} Components Component types to check
   */
  hasAllComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.hasComponent(Components[i])) return false;
    }
    return true;
  }

  /**
   * Check if the entity has any of the components in a list.
   * @param {import("./Typedefs").ComponentConstructor<any>[]} Components Component types to check
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
      let tag = tags[i];
      if (tag.isRelation) {
        throw new Error("Cannot check for relations in hasAllTags");
      }
      if (!this._tags.includes(tag)) {
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
      let tag = tags[i];
      if (tag.isRelation) {
        throw new Error("Cannot check for relations in hasAnyTags");
      }
      if (this._tags.includes(tag)) {
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
  // Pairs
  //
  // A pair is a relation and a related object. A relation is a tag, and the
  // related object is any entity.

  /**
   * Returns false if the pair is already on this entity.
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle").EntityHandleType} entity 
   */
  addPair(relation, entity) {
    return this._entityManager.entityAddPair(this, relation, entity.unwrapHandle());
  }

  /**
   * Replace an old entity in a pair with a new one. If newEntity is not
   * associated with relation, then then this method does nothing and returns
   * false.
   * 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle").EntityHandleType} newEntity
   * @param {Entity | import("./EntityHandle").EntityHandleType} oldEntity
   */
  replacePair(relation, newEntity, oldEntity) {
    if (this.removePair(relation, oldEntity)) {
      this.addPair(relation, newEntity);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Remove all entities associated with a relation and replace with
   * entityOrEntities.
   * 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle").EntityHandleType |
   *   (Entity | import("./EntityHandle").EntityHandleType)[]} entityOrEntities 
   */
  overwritePair(relation, entityOrEntities) {
    this.removeRelation(relation);
    if (entityOrEntities instanceof Array) {
      entityOrEntities.forEach(entity => this.addPair(relation, entity), this);
    } else {
      this.addPair(relation, entityOrEntities);
    }
  }

  /**
   * 
   * @param {Tag | string} relation 
   * @param {boolean} [includeRemoved]
   * @returns {import("./EntityHandle").EntityHandleType |
   *   import("./EntityHandle").EntityHandleType[] | null}
   */
  getRelation(relation, includeRemoved) {
    let relationTag = this._entityManager.world._getTagOrError(relation);
    let ret = this._pairs[relationTag.name] || [];
    if (includeRemoved) {
      let entities = this._pairsToRemove[relationTag.name];
      if (entities) {
        ret = ret.concat(entities);
      }
    }

    if (ret.length === 0) {
      return null;
    } else if (ret.length === 1) {
      return ret[0];
    } else {
      return ret;
    }
  }

  /**
   * 
   * @param {Tag | string} relation 
   * @returns {import("./EntityHandle").EntityHandleType |
   *   import("./EntityHandle").EntityHandleType[] | null}
   */
  getRemovedRelation(relation) {
    let relationTag = this._entityManager.world._getTagOrError(relation);
    let entities = this._pairsToRemove[relationTag.name];
    if (entities === undefined) {
      return null;
    } else if (entities.length == 1) {
      return entities[0];
    } else {
      return entities;
    }
  }

  /**
   * 
   * @param {boolean} [includeRemoved]
   */
  getAllRelations(includeRemoved) {
    let ret = Object.keys(this._pairs);
    if (includeRemoved) {
      ret = ret.concat(Object.keys(this._pairsToRemove)
        .filter(key => !this._pairs[key]));
    }
    return ret;
  }

  /**
   * 
   */
  getAllRemovedRelations() {
    return Object.keys(this._pairsToRemove);
  }

  /**
   * 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle").EntityHandleType} entity 
   * @param {boolean} [forceImmediate]
   */
  removePair(relation, entity, forceImmediate) {
    return this._entityManager.entityRemovePair(this, relation, entity, forceImmediate);
  }

  /**
   * Remove all the related entities with this relation.
   * @param {Tag | string} relation 
   * @param {boolean} [forceImmediate]
   */
  removeRelation(relation, forceImmediate) {
    return this._entityManager.entityRemoveRelation(this, relation, forceImmediate);
  }

  /**
   * Remove all relations and related objects
   * @param {boolean} [forceImmediate]
   */
  removeAllPairs(forceImmediate) {
    this.getAllRelations().forEach(relation => this.removeRelation(relation, forceImmediate), this);
  }

  /**
   * 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle").EntityHandleType} relEntity 
   * @param {boolean} [includeRemoved]
   */
   hasPair(relation, relEntity, includeRemoved) {
    let relationTag = this._entityManager.world._getTagOrError(relation);
    if (this._pairs[relationTag.name]
          && this._pairs[relationTag.name].includes(relEntity.getHandle())) {
      return true;
    } else if (includeRemoved) {
      return this.hasRemovedPair(relation, relEntity);
    } else {
      return false;
    }
  }

  /**
   * 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle").EntityHandleType} relEntity 
   */
  hasRemovedPair(relation, relEntity) {
    let relationTag = this._entityManager.world._getTagOrError(relation);
    return !!(this._pairsToRemove[relationTag.name]
      && this._pairsToRemove[relationTag.name].includes(relEntity.getHandle()));
  }
  
  /**
   * 
   * @param {Tag[]} relations 
   */
  hasAllRelations(relations) {
    for (let i = 0; i < relations.length; i++) {
      let relation = relations[i];
      if (!relation.isRelation) {
        throw new Error("Cannot check for tags in hasAllRelations");
      }
      if (!this._pairs[relation.name]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 
   * @param {Tag[]} relations 
   */
  hasAnyRelations(relations) {
    for (let i = 0; i < relations.length; i++) {
      let relation = relations[i];
      if (!relation.isRelation) {
        throw new Error("Cannot check for tags in hasAnyRelation");
      }
      if (this._pairs[relation.name]) {
        return true;
      }
    }
    return false;
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

  /**
   * 
   * @returns {import("./EntityHandle").EntityHandleType}
   */
  getHandle() {
    if (!this._cachedHandle) {
      this._cachedHandle = new EntityHandle(this);
    }
    return (/** @type {import("./EntityHandle").EntityHandleType} */ (this._cachedHandle));
  }

  unwrapHandle() { return this; }
}
