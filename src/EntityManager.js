import { ObjectPool } from "./ObjectPool.js";
import QueryManager from "./QueryManager.js";
import EventDispatcher from "./EventDispatcher.js";
import { SystemStateComponent } from "./SystemStateComponent.js";
import environment from "./environment.js";
import { Entity } from "./Entity";
import { Tag } from "./Tag.js";
import { EntityHandle } from "./EntityHandle.js";
import { EntityEvents } from "./constants.js";

/**
 * @extends {ObjectPool<Entity>}
 */
export class EntityPool extends ObjectPool {
  /**
   * 
   * @param {EntityManager} entityManager 
   * @param {(new(manager: EntityManager) => Entity) & typeof Entity} entityClass 
   * @param {number} initialSize 
   */
  constructor(entityManager, entityClass, initialSize) {
    // Need to prevent the superclass from calling expand() before saving
    // entityManager.
    super(entityClass, undefined);

    /**
     * @type {EntityManager}
     */
    this.entityManager = entityManager;

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  /**
   * @param {number} count 
   */
  expand(count) {
    for (var n = 0; n < count; n++) {
      var clone = new this.Type(this.entityManager);
      clone._pool = this;
      this.freeList.push(clone);
    }
    this.count += count;
  }
}

/**
 * @private
 */
export class EntityManager {
  /**
   * 
   * @param {import("./World").World} world 
   */
  constructor(world) {
    /**
     * @type {import("./World").World}
     */
    this.world = world;

    /**
     * @type {import("./ComponentManager").ComponentManager}
     */
    this.componentsManager = world.componentsManager;

    /**
     * All the entities in this instance
     * @type {Entity[]}
     */
    this._entities = [];

    /**
     * @type {number}
     */
    this._nextEntityId = 0;

    /**
     * @type {{[name: string]: Entity}}
     */
    this._entitiesByNames = {};
    
    /**
     * Events fire before any changes happen
     * @type {EventDispatcher<any>}
     */
    this.beginEventDispatcher = new EventDispatcher();
    
    /**
     * Events fire after changes are completed
     * @type {EventDispatcher<any>}
     */
    this.endEventDispatcher = new EventDispatcher();
    
    /**
     * @type {EntityPool}
     */
    this._entityPool = new EntityPool(
      this,
      this.world.options.entityClass,
      this.world.options.entityPoolSize
    );

    /**
     * Deferred deletion of components
     * @type {Entity[]}
     */
    this.entitiesWithComponentsToRemove = [];
    /**
     * Deferred deletion of entities
     * @type {Entity[]}
     */
    this.entitiesToRemove = [];
    /**
     * Deferred deletion of tags
     * @type {Entity[]}
     */
    this.entitiesWithTagsToRemove = [];
    /**
     * Deferred deletion of pairs
     */
    this.entitiesWithPairsToRemove = [];
    /**
     * @type {boolean}
     */
    this.deferredRemovalEnabled = true;

    /**
     * @type {QueryManager}
     */
      this._queryManager = new QueryManager(this.world, this);
  }

  ///////////////////////////////////////////////////////////////////////////
  // COMPONENTS

  /**
   * Add a component to an entity
   * @param {Entity} entity Entity where the component will be added
   * @param {import("./constants").ComponentConstructor<any>} Component Component to be added to the entity
   * @param {object} [values] Optional values to replace the default attributes
   */
  entityAddComponent(entity, Component, values) {
    // @todo Probably define Component._typeId with a default value and avoid using typeof
    if (
      typeof Component._typeId === "undefined" ||
      !this.world.componentsManager._ComponentsMap[Component._typeId]
    ) {
      throw new Error(
        `Attempted to add unregistered component "${Component.getName()}"`
      );
    }

    if (~entity._ComponentTypes.indexOf(Component)) {
      if (environment.isDev) {
        console.warn(
          "Component type already exists on entity.",
          entity,
          Component.getName()
        );
      }
      return;
    }

    this.beginEventDispatcher.dispatchEvent(EntityEvents.componentAdded, entity, Component);

    entity._ComponentTypes.push(Component);

    if (Object.getPrototypeOf(Component) === SystemStateComponent) {
      entity.numStateComponents++;
    }

    var componentPool = this.world.componentsManager.getComponentsPool(Component);

    var component = componentPool
      ? componentPool.acquire()
      : new Component(values);

    if (componentPool && values) {
      component.copy(values);
    }

    entity._components[Component._typeId] = component;

    this.world.componentsManager.componentAddedToEntity(Component);
    this.endEventDispatcher.dispatchEvent(EntityEvents.componentAdded, entity, Component);

    
  }

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {import("./constants").ComponentConstructor<any>} Component Component to remove from the entity
   * @param {boolean} [immediately] If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity, Component, immediately) {
    var index = entity._ComponentTypes.indexOf(Component);
    if (!~index) return;

    this.beginEventDispatcher.dispatchEvent(EntityEvents.componentRemoved, entity, Component);

    if (immediately) {
      this._entityRemoveComponentSync(entity, Component, index);
    } else {
      if (entity._ComponentTypesToRemove.length === 0)
        this.entitiesWithComponentsToRemove.push(entity);

      entity._ComponentTypes.splice(index, 1);
      if (!entity._ComponentTypesToRemove.includes(Component)) {
        entity._ComponentTypesToRemove.push(Component);
      }

      entity._componentsToRemove[Component._typeId] =
        entity._components[Component._typeId];
      delete entity._components[Component._typeId];
    }

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);

    if (Object.getPrototypeOf(Component) === SystemStateComponent) {
      entity.numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (entity.numStateComponents === 0 && !entity.alive) {
        entity.remove();
      }
    }

    this.endEventDispatcher.dispatchEvent(EntityEvents.componentRemoved, entity, Component);
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {import("./constants").ComponentConstructor<any>} Component 
   * @param {number} index 
   */
  _entityRemoveComponentSync(entity, Component, index) {
    // Remove T listing on entity and property ref, then free the component.
    entity._ComponentTypes.splice(index, 1);
    var component = entity._components[Component._typeId];
    delete entity._components[Component._typeId];
    component.dispose();
    this.world.componentsManager.componentRemovedFromEntity(Component);
  }

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   * @param {boolean} [immediately]
   */
  entityRemoveAllComponents(entity, immediately) {
    let Components = entity._ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      if (Object.getPrototypeOf(Components[j]) !== SystemStateComponent)
        this.entityRemoveComponent(entity, Components[j], immediately);
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // TAGS

  /**
   * 
   * @param {Entity} entity 
   * @param {Tag | string} tagOrName 
   */
  entityAddTag(entity, tagOrName) {
    let tag = this.world._getTagOrError(tagOrName);
    if (tag.isRelation) {
      throw new Error("Cannot add a relation as a tag: " + tag.name);
    }

    if (entity._tags.includes(tag)) {
      return;
    }

    this.beginEventDispatcher.dispatchEvent(EntityEvents.tagAdded, entity, tag);
    entity._tags.push(tag);

    // If the tag was previously removed, delete it from the removed list.
    let removedListIndex = entity._tagsToRemove.indexOf(tag);
    if (removedListIndex !== -1) {
      entity._tagsToRemove.splice(removedListIndex, 1);
    }

    this.endEventDispatcher.dispatchEvent(EntityEvents.tagAdded, entity, tag);
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {Tag | string} tagOrName 
   * @param {boolean} [immediately]
   */
  entityRemoveTag(entity, tagOrName, immediately) {
    let tag = this.world._getTagOrError(tagOrName);
    if (tag.isRelation) { return; }
    let index = entity._tags.indexOf(tag);
    if (index === -1) { return; }

    this.beginEventDispatcher.dispatchEvent(EntityEvents.tagRemoved, entity, tag);

    if (immediately) {
      entity._tags.splice(index, 1);
    } else {
      // If this is the first time we're removing something since we last checked,
      // add it to the queue of entities for deferred processing.
      if (entity._tagsToRemove.length === 0) {
        this.entitiesWithTagsToRemove.push(entity);
      }

      entity._tags.splice(index, 1);

      // There is an invariant that a tag can't be on both _tags and _tagsToRemove,
      // so we can safely assume that pushing to _tagsToRemove won't duplicate
      entity._tagsToRemove.push(tag);
    }

    this.endEventDispatcher.dispatchEvent(EntityEvents.tagRemoved, entity, tag);
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {boolean} [immediately]
   */
  entityRemoveAllTags(entity, immediately) {
    let tags = entity._tags;
    for (let i = tags.length - 1; i >= 0; i--) {
      this.entityRemoveTag(entity, tags[i], immediately);
    }
  }
  
  ///////////////////////////////////////////////////////////////////////////
  // PAIRS

  /**
   * 
   * @param {Entity} entity 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle.js").EntityHandleType} relEntity 
   * @returns {boolean} False if the pair already existed
   */
  entityAddPair(entity, relation, relEntity) {
    
    // TODO: Events!
    let relationTag = this.world._getTagOrError(relation);
    if (!relationTag.isRelation) {
      throw new Error("Cannot use a tag as a relation: " + relationTag.name);
    }

    let relEntityOriginal = relEntity.unwrapHandle();
    let relEntityHandle = relEntity.getHandle();

    let currentRelEntities = entity._pairs[relationTag.name];
    if (currentRelEntities && currentRelEntities.includes(relEntityHandle)) {
      // Already in the list
      return false;
    }

    this.beginEventDispatcher.dispatchEvent(EntityEvents.pairAdded, entity, {
      relation: relationTag,
      entity: relEntityOriginal
    });

    if (currentRelEntities) {
      currentRelEntities.push(relEntityHandle);
    } else {
      entity._pairs[relationTag.name] = [relEntityHandle];
    }

    this.endEventDispatcher.dispatchEvent(EntityEvents.pairAdded, entity, {
      relation: relationTag,
      entity: relEntityOriginal
    });
    return true;
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {Tag | string} relation 
   * @param {Entity | import("./EntityHandle.js").EntityHandleType} relEntity 
   * @param {boolean} [immediately]
   * @returns {boolean} False if the pair doesn't exist
   */
  entityRemovePair(entity, relation, relEntity, immediately) {
    let relationTag = this.world._getTagOrError(relation);
    if (!relationTag.isRelation) {
      return false;
    }

    let relEntityHandle = relEntity.getHandle();
    
    let relEntities = entity._pairs[relationTag.name];
    if (!(relEntities && relEntities.includes(relEntityHandle))) {
      return false;
    }

    // Definitely removing the pair.
    this.beginEventDispatcher.dispatchEvent(EntityEvents.pairRemoved, entity, {
      relation: relationTag,
      entity: relEntityHandle
    });

    if (relEntities.length === 1) {
      delete entity._pairs[relationTag.name];
    } else {
      relEntities.splice(relEntities.indexOf(relEntityHandle), 1);
    }

    if (!immediately) {
      if (Object.keys(entity._pairsToRemove).length === 0) {
        this.entitiesWithPairsToRemove.push(entity);
      }
      if (entity._pairsToRemove[relationTag.name]) {
        entity._pairsToRemove[relationTag.name].push(relEntityHandle);
      } else {
        entity._pairsToRemove[relationTag.name] = [relEntityHandle];
      }
    }

    this.endEventDispatcher.dispatchEvent(EntityEvents.pairRemoved, entity, {
      relation: relationTag,
      entity: relEntityHandle
    });

    return true;
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {Tag | string} relation 
   * @param {boolean} [immediately]
   */
  entityRemoveRelation(entity, relation, immediately) {
    let relationTag = this.world._getTagOrError(relation);
    let objects = entity._pairs[relationTag.name];
    if (objects !== undefined) {
      for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        this.entityRemovePair(entity, relationTag, obj, immediately);
      }
    }
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {boolean} [immediately]
   */
  entityRemoveAllPairs(entity, immediately) {
    let relations = entity.getAllRelations();
    for (let i = relations.length - 1; i >= 0; i--) {
      this.entityRemoveRelation(entity, relations[i], immediately);
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // ENTITIES

  /**
   * 
   * @param {string} name
   * @returns {Entity?}
   */
  getEntityByName(name) {
    return this._entitiesByNames[name];
  }

  /**
   * Create a new entity
   * @param {string} [name]
   */
  createEntity(name) {
    var entity = this._entityPool.acquire();
    entity.alive = true;
    entity.name = name || "";
    if (name) {
      if (this._entitiesByNames[name]) {
        console.warn(`Entity name '${name}' already exists; preserving the old entity`);
      } else {
        this.beginEventDispatcher.dispatchEvent(EntityEvents.created, entity);
        this._entitiesByNames[name] = entity;
      }
    }

    this._entities.push(entity);
    this.endEventDispatcher.dispatchEvent(EntityEvents.created, entity);
    return entity;
  }

  /**
   * Remove the entity from this manager. It will clear also its components
   * @param {Entity} entity Entity to remove from the manager
   * @param {boolean} [immediately] If you want to remove the component immediately instead of deferred (Default is false)
   */
  removeEntity(entity, immediately) {
    var index = this._entities.indexOf(entity);

    if (!~index) throw new Error("Tried to remove entity not in list");
    if (!entity.alive && this.entitiesToRemove.includes(entity)) {
      throw new Error("Tried to remove entity not in list")
    }

    entity.alive = false;
    this.entityRemoveAllComponents(entity, immediately);
    this.entityRemoveAllTags(entity, immediately);
    this.entityRemoveAllPairs(entity, immediately);

    if (entity.numStateComponents === 0) {
      // Remove from entity list
      this.beginEventDispatcher.dispatchEvent(EntityEvents.removed, entity);

      if (immediately === true) {
        this._releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }

      this.endEventDispatcher.dispatchEvent(EntityEvents.removed, entity);
    }
  }

  /**
   * 
   * @param {Entity} entity 
   * @param {number} index 
   */
  _releaseEntity(entity, index) {
    this._entities.splice(index, 1);

    if (this._entitiesByNames[entity.name]) {
      delete this._entitiesByNames[entity.name];
    }
    entity._cachedHandle = null;
    entity._pool.release(entity);
  }

  /**
   * Remove all entities from this manager
   */
  removeAllEntities() {
    for (var i = this._entities.length - 1; i >= 0; i--) {
      this.removeEntity(this._entities[i]);
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // MISC

  processDeferredRemoval() {
    if (!this.deferredRemovalEnabled) {
      return;
    }

    for (let i = 0; i < this.entitiesToRemove.length; i++) {
      let entity = this.entitiesToRemove[i];
      let index = this._entities.indexOf(entity);
      this._releaseEntity(entity, index);
    }
    this.entitiesToRemove.length = 0;

    for (let i = 0; i < this.entitiesWithComponentsToRemove.length; i++) {
      let entity = this.entitiesWithComponentsToRemove[i];
      while (entity._ComponentTypesToRemove.length > 0) {
        let Component = entity._ComponentTypesToRemove.pop();

        var component = entity._componentsToRemove[Component._typeId];
        delete entity._componentsToRemove[Component._typeId];
        component.dispose();
        this.world.componentsManager.componentRemovedFromEntity(Component);

        //this._entityRemoveComponentSync(entity, Component, index);
      }
    }
    this.entitiesWithComponentsToRemove.length = 0;

    for (let i = 0; i < this.entitiesWithTagsToRemove.length; i++) {
      let entity = this.entitiesWithTagsToRemove[i];
      // TODO: For now there's no cleanup for tags
      entity._tagsToRemove.length = 0;
    }
    this.entitiesWithTagsToRemove.length = 0;

    for (let i = 0; i < this.entitiesWithPairsToRemove.length; i++) {
      let entity = this.entitiesWithPairsToRemove[i];
      // TODO: For now there's no cleanup for pairs
      entity._pairsToRemove = {};
    }
  }

  /**
   * Get a query based on a list of components
   * @param {import("./constants").QueryTerm[] | import("./Filter").Filter} termsOrFilter List of components that will form the query
   * @param {boolean} [createIfNotFound]
   */
  getQueryByComponents(termsOrFilter, createIfNotFound) {
    return this._queryManager.getQuery(termsOrFilter, createIfNotFound);
  }

  // EXTRAS

  /**
   * Return number of entities
   */
  count() {
    return this._entities.length;
  }

  /**
   * Return some stats
   */
  stats() {
    /**
     * @type {{
     *  numEntities: number,
     *  numQueries: number,
     *  queries: ReturnType<QueryManager["stats"]>,
     *  numComponentPool: number,
     *  componentPool: {
     *    [name: string]: ReturnType<ObjectPool["stats"]>
     *  },
     *  beginEventDispatcher: EventDispatcher["stats"],
     *  endEventDispatcher: EventDispatcher["stats"]
     * }}
     */
    var stats = {
      numEntities: this._entities.length,
      numQueries: Object.keys(this._queryManager._queries).length,
      queries: this._queryManager.stats(),
      numComponentPool: Object.keys(this.componentsManager._componentPool)
        .length,
      componentPool: {},
      beginEventDispatcher: this.beginEventDispatcher.stats,
      endEventDispatcher: this.endEventDispatcher.stats
    };

    for (var ecsyComponentId in this.componentsManager._componentPool) {
      var pool = this.componentsManager._componentPool[ecsyComponentId];
      let componentType = (/** @type {import("./constants").ComponentConstructor<any>} */ (pool.Type));
      stats.componentPool[componentType.getName()] = pool.stats();
    }

    return stats;
  }
}
