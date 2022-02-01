(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, (function () {
		var current = global.ECSY;
		var exports = global.ECSY = {};
		factory(exports);
		exports.noConflict = function () { global.ECSY = current; return exports; };
	})());
})(this, (function (exports) { 'use strict';

	var environment = { isDev: true };

	/**
	 * @typedef {{
	 *  default?: any,
	 *  type: PropType<any>
	 * }} ComponentSchemaProp
	 */

	/**
	 * @typedef {{
	 *  [propName: QueryKey]: ComponentSchemaProp
	 * }} ComponentSchema
	 */

	class Component {
	  /**
	   * @param {object} props 
	   */
	  constructor(props) {
	    if (props !== false) {
	      const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

	      for (const key in schema) {
	        if (props && props.hasOwnProperty(key)) {
	          this[key] = props[key];
	        } else {
	          const schemaProp = schema[key];
	          if (schemaProp.hasOwnProperty("default")) {
	            this[key] = schemaProp.type.clone(schemaProp.default);
	          } else {
	            const type = schemaProp.type;
	            this[key] = type.clone(type.default);
	          }
	        }
	      }

	      if (environment.isDev && props !== undefined) {
	        this._checkUndefinedAttributes(props);
	      }
	    }

	    this._pool = null;
	  }

	  /**
	   * 
	   * @param {this} source 
	   * @returns {this}
	   */
	  copy(source) {
	    /** @type {ComponentSchema} */
	    const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

	    for (const key in schema) {
	      const prop = schema[key];

	      if (source.hasOwnProperty(key)) {
	        this[key] = prop.type.copy(source[key], this[key]);
	      }
	    }

	    // @DEBUG
	    if (environment.isDev) {
	      this._checkUndefinedAttributes(source);
	    }

	    return this;
	  }

	  clone() {
	    const ctor = (/** @type {typeof Component} */ (this.constructor));
	    return new ctor().copy(this);
	  }

	  reset() {
	    /** @type {ComponentSchema} */
	    const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

	    for (const key in schema) {
	      const schemaProp = schema[key];

	      if (schemaProp.hasOwnProperty("default")) {
	        this[key] = schemaProp.type.copy(schemaProp.default, this[key]);
	      } else {
	        const type = schemaProp.type;
	        this[key] = type.copy(type.default, this[key]);
	      }
	    }
	  }

	  dispose() {
	    if (this._pool) {
	      this._pool.release(this);
	    }
	  }

	  getName() {
	    return (/** @type {typeof Component} */ (this.constructor)).getName();
	  }

	  /**
	   * 
	   * @param {this} src 
	   */
	  _checkUndefinedAttributes(src) {
	    /** @type {ComponentSchema} */
	    const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

	    // Check that the attributes defined in source are also defined in the schema
	    Object.keys(src).forEach((srcKey) => {
	      if (!schema.hasOwnProperty(srcKey)) {
	        console.warn(
	          `Trying to set attribute '${srcKey}' not defined in the '${this.constructor.name}' schema. Please fix the schema, the attribute value won't be set`
	        );
	      }
	    });
	  }
	}

	/**
	 * @type {ComponentSchema}
	 */
	Component.schema = {};

	/**
	 * @type {true}
	 */
	Component.isComponent = true;

	/**
	 * @type {string?}
	 */
	Component.displayName = null;

	Component.getName = function () {
	  return this.displayName || this.name;
	};

	/**
	 * @type {number?}
	 */
	Component._typeId = undefined;

	/**
	 * @typedef {Entity & EntityHandle & {
	 *   deref: Entity?,
	 *   forceDeref: Entity
	 * }} EntityHandleType
	 */

	/**
	 * 
	 */
	class EntityHandle {
	  /**
	   * 
	   * @param {Entity} parent 
	   */
	  constructor(parent) {
	    if (!parent.alive) {
	        throw new Error("Can't make handle to dead entity");
	    }



	    /** @type {{id: number, name: string?}} */
	    let pseudoObject = {
	      id: parent.id,
	      name: parent.name
	    };

	    function describeEntity(entity) {
	      let ret = "Entity { id: " + pseudoObject.id;
	      if (pseudoObject.name && pseudoObject.name.length > 0) {
	        ret += ", name: \"" + pseudoObject.name + "\"";
	      }
	      return ret + "}";
	    }

	    let ret = new Proxy(parent, {
	      // @ts-ignore
	      pseudoObject: pseudoObject,
	      get: function (target, prop, proxy) {
	        prop = typeof prop === "string" ? prop : prop.toString();

	        let alive = target.id === pseudoObject.id && target.alive;
	        switch (prop) {
	          // Always return the original id
	          case "id": return pseudoObject.id;

	          // Return the entity name, or if the entity is dead, return its last
	          // known name
	          case "name": return alive ? target.name : pseudoObject.name;

	          // Aliveness is determined by matching IDs and the alive field
	          case "alive": return alive;

	          // Special function to get past the proxy
	          case "deref":
	            if (alive) {
	              return target;
	            } else {
	              throw new Error(`Handle cannot be dereferenced: ${describeEntity(target)} is dead`);
	            }
	          
	          // Function form of deref
	          case "unwrapHandle": return () => proxy.deref;

	          // Make sure that getHandle always works
	          case "getHandle": return () => proxy;
	          
	          // Unsafely get past the proxy
	          case "forceDeref": return target;
	        }

	        // For everything else, if alive, default to normal entity stuff.
	        if (alive) {
	          let property = target[prop];
	          if (typeof property === "function") {
	            return property.bind(target);
	          } else {
	            return target[prop];
	          }
	        } else {
	          throw new Error(`Cannot access property "${prop}": ${describeEntity(target)} is dead`);
	        }
	      },
	      set: function (target, prop, newValue) {
	        prop = typeof prop === "string" ? prop : prop.toString();

	        let alive = target.id === pseudoObject.id && target.alive;
	        // Special: if name is set, update name in proxy
	        if (prop === "name") {
	          self.name = newValue;
	          if (alive) {
	            target.name = newValue;
	          }
	        }

	        if (alive) {
	          target[prop] = newValue;
	        } else {
	          throw new Error(`Cannot access property "${prop}": ${describeEntity(target)} is dead`);
	        }
	        return true;
	      },
	      // This is to ensure `(new EntityHandler()) instanceof EntityHandler`
	      getPrototypeOf: function(target) {
	        return EntityHandle.prototype;
	      }
	    });
	    return ret;
	  }

	  /**
	   * Dummy function for typechecking
	   * @returns {Entity}
	   */
	  unwrapHandle() { throw new Error("Unreachable"); }

	  /**
	   * Dummy function for typechecking
	   * @returns {EntityHandleType}
	   */
	  getHandle() { throw new Error("Unreachable"); }
	}

	/**
	 * @enum {string}
	 */
	const QueryEvents = {
	  added: "Query#ENTITY_ADDED",
	  removed: "Query#ENTITY_REMOVED",
	  changed: "Query#COMPONENT_CHANGED",
	};

	/**
	 * @enum {string}
	 */
	const EntityEvents = {
	  created: "EntityManager#ENTITY_CREATE",
	  removed: "EntityManager#ENTITY_REMOVED",
	  componentAdded: "EntityManager#COMPONENT_ADDED",
	  componentRemoved: "EntityManager#COMPONENT_REMOVE",
	  tagAdded: "EntityManager#TAG_ADDED",
	  tagRemoved: "EntityManager#TAG_REMOVE",
	  pairAdded: "EntityManager#PAIR_ADDED",
	  pairRemoved: "EntityManager#PAIR_REMOVE"
	};

	/**
	 * @template {Component} C
	 * @typedef {(new(...args: any[]) => C) &
	 *  typeof Component
	 * } ComponentConstructor
	 */

	/**
	 * @typedef {ComponentConstructor<any> | NotTerm |
	 *  (Tag | string)} QueryTerm
	 */

	/**
	 * @typedef {{
	 *  components: ComponentConstructor<any>[],
	 *  tags: Tag[],
	 *  notComponents: ComponentConstructor<any>[],
	 *  notTags: Tag[]
	 * }} ParsedQueryTerms
	 */

	/**
	 * @typedef {{
	 *  operator: "not",
	 *  innerTerm: QueryTerm
	 * }} NotTerm
	 */

	/**
	 * @typedef {{
	 *  components: QueryTerm[],
	 *  listen?: {
	 *    added?: boolean,
	 *    removed?: boolean,
	 *    changed?: boolean | ComponentConstructor<any>[]
	 *  },
	 *  mandatory?: boolean,
	 * }} QueryDef
	 */

	class Tag {
	    /**
	     * 
	     * @param {string} name 
	     * @param {number} id 
	     * @param {boolean} isRelation
	     */
	    constructor(name, id, isRelation) {
	        /** @type {string} */
	        this.name = name;
	        /** @type {number} */
	        this._id = id;
	        /** @type {boolean} */
	        this.isRelation = isRelation;
	    }
	}

	/**
	 * @type {WeakMap<Component, Proxy<Component>>}
	 */
	const proxyMap = new WeakMap();

	/** @type {ProxyHandler<any>} */
	const proxyHandler = {
	  set(target, prop) {
	    throw new Error(
	      `Tried to write to "${target.constructor.getName()}#${String(
        prop
      )}" on immutable component. Use .getMutableComponent() to modify a component.`
	    );
	  },
	};

	/**
	 * Returns a Proxy<C> that does not allow the modification of any fields.
	 * 
	 * @template {Component} C
	 * @param {ComponentConstructor<C>} T
	 * @param {C} component
	 * @returns {C}
	 */
	function wrapImmutableComponent(T, component) {
	  if (component === undefined) {
	    return undefined;
	  }

	  let wrappedComponent = proxyMap.get(component);

	  if (!wrappedComponent) {
	    wrappedComponent = new Proxy(component, proxyHandler);
	    proxyMap.set(component, wrappedComponent);
	  }

	  return /** @type {C} */ ( /** @type {any} */ (wrappedComponent));
	}

	/**
	 * @typedef {{
	 *  [key: string]: Component
	 * }} ComponentLookup
	 */

	/**
	 * An entity in the world.
	 */
	class Entity {
	  /**
	   * 
	   * @param {EntityManager} entityManager 
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
	     * @type {EntityManager?}
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
	     * Pairs that the entity has
	     * @type {{ [tagName: string]: EntityHandleType[] }}
	     */
	    this._pairs = {};

	    /**
	     * The queries that this entity is part of
	     * @type {Query[]}
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
	     * Entries from `_pairs` that are waiting for deferred removal
	     * @type {{ [tagName: string]: EntityHandleType[] }}
	     */
	    this._pairsToRemove = {};

	    /**
	     * if there are state components on a entity, it can't be removed completely
	     * @type {number}
	     */
	    this.numStateComponents = 0;

	    /**
	     * @type {EntityPool}
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
	   * @param {Entity | EntityHandleType} entity 
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
	   * @param {Entity | EntityHandleType} newEntity
	   * @param {Entity | EntityHandleType} oldEntity
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
	   * @param {Entity | EntityHandleType |
	   *   (Entity | EntityHandleType)[]} entityOrEntities 
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
	   * @returns {EntityHandleType[]?}
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
	    } else {
	      return ret;
	    }
	  }

	  /**
	   * 
	   * @param {Tag | string} relation 
	   * @returns {EntityHandleType[]?}
	   */
	  getRemovedRelation(relation) {
	    let relationTag = this._entityManager.world._getTagOrError(relation);
	    let entities = this._pairsToRemove[relationTag.name];
	    if (entities === undefined) {
	      return null;
	    } else {
	      return entities;
	    }
	  }

	  /**
	   * If there are more than one pairs, throws an error
	   * @param {Tag | string} relation 
	   * @param {boolean} [includeRemoved]
	   * @returns {EntityHandleType?}
	   */
	  getPair(relation, includeRemoved) {
	    let ret = this.getRelation(relation, includeRemoved);
	    if (ret) {
	      if (ret.length == 1) {
	        return ret[0];
	      } else {
	        throw new Error("More than one pair for relation '" + relation + "'");
	      }
	    } else {
	      return null;
	    }
	  }

	  
	  /**
	   * If there are more than one pairs, throws an error
	   * @param {Tag | string} relation 
	   * @returns {EntityHandleType?}
	   */
	  getRemovedPair(relation) {
	    let ret = this.getRemovedRelation(relation);
	    if (ret) {
	      if (ret.length == 1) {
	        return ret[0];
	      } else {
	        throw new Error("More than one pair for relation '" + relation + "'");
	      }
	    } else {
	      return null;
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
	   * @param {Entity | EntityHandleType} entity 
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
	   * @param {Entity | EntityHandleType} relEntity 
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
	   * @param {Entity | EntityHandleType} relEntity 
	   */
	  hasRemovedPair(relation, relEntity) {
	    let relationTag = this._entityManager.world._getTagOrError(relation);
	    return !!(this._pairsToRemove[relationTag.name]
	      && this._pairsToRemove[relationTag.name].includes(relEntity.getHandle()));
	  }

	  /**
	   * 
	   * @param {Tag | string} relation 
	   */
	  hasRelation(relation) {
	    let relationTag = this._entityManager.world._getTagOrError(relation);
	    if (!relationTag.isRelation) {
	      throw new Error("Cannot check for tags in hasAllRelations");
	    }
	    return !!this._pairs[relationTag.name];
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
	   * @returns {EntityHandleType}
	   */
	  getHandle() {
	    if (!this._cachedHandle) {
	      this._cachedHandle = new EntityHandle(this);
	    }
	    return (/** @type {EntityHandleType} */ (this._cachedHandle));
	  }

	  unwrapHandle() { return this; }
	}

	/**
	 * @template T
	 * @typedef {(
	 *  dispatcher: EventDispatcher,
	 *  eventName: string,
	 *  entity: Entity?,
	 *  data: T?
	 * ) => void} EventListener<T>
	 */

	/**
	 * @template T The extra data that might be included in an event
	 */
	class EventDispatcher {
	  constructor() {
	    /**
	     * @type {{ [eventName: string]: EventListener<T>[] }}
	     */
	    this._listeners = {};

	    /**
	     * @type {{ fired: number, handled: number }}
	     */
	    this.stats = {
	      fired: 0,
	      handled: 0,
	    };
	  }

	  /**
	   * Add an event listener
	   * @param {String} eventName Name of the event to listen
	   * @param {EventListener<T>} listener Callback to trigger when the event is fired
	   */
	  addEventListener(eventName, listener) {
	    let listeners = this._listeners;
	    if (listeners[eventName] === undefined) {
	      listeners[eventName] = [];
	    }

	    if (listeners[eventName].indexOf(listener) === -1) {
	      listeners[eventName].push(listener);
	    }
	  }

	  /**
	   * Check if an event listener is already added to the list of listeners
	   * @param {String} eventName Name of the event to check
	   * @param {EventListener<T>} listener Callback for the specified event
	   */
	  hasEventListener(eventName, listener) {
	    return (
	      this._listeners[eventName] !== undefined &&
	      this._listeners[eventName].indexOf(listener) !== -1
	    );
	  }

	  /**
	   * Remove an event listener
	   * @param {String} eventName Name of the event to remove
	   * @param {EventListener<T>} listener Callback for the specified event
	   */
	  removeEventListener(eventName, listener) {
	    var listenerArray = this._listeners[eventName];
	    if (listenerArray !== undefined) {
	      var index = listenerArray.indexOf(listener);
	      if (index !== -1) {
	        listenerArray.splice(index, 1);
	      }
	    }
	  }

	  /**
	   * Dispatch an event
	   * @param {String} eventName Name of the event to dispatch
	   * @param {Entity} [entity] (Optional) Entity to emit
	   * @param {T} [data]
	   */
	  dispatchEvent(eventName, entity, data) {
	    this.stats.fired++;

	    var listenerArray = this._listeners[eventName];
	    let wasHandled = false;
	    if (listenerArray !== undefined) {
	      // Make a copy of the array, to prevent mutation by listeners (such as
	      // listeners removing themselves)
	      var array = listenerArray.slice(0);

	      for (var i = 0; i < array.length; i++) {
	        array[i](this, eventName, entity, data);
	        wasHandled = true;
	      }
	    }
	    if (wasHandled) {
	      this.stats.handled++;
	    }
	  }

	  /**
	   * Reset stats counters
	   */
	  resetCounters() {
	    this.stats.fired = this.stats.handled = 0;
	  }
	}

	/**
	 * Use the Not pseudo-class to negate a component query.
	 * 
	 * @template {Component} C
	 * @param {QueryTerm} term
	 * @returns {NotTerm}
	 */
	 function Not(term) {
	  return {
	    operator: "not",
	    innerTerm: term
	  };
	}

	class Filter {
	    /**
	   * Parse an array of mixed terms into split arrays.
	   * @param {QueryTerm[]} terms 
	   * @param {World} world 
	   */
	    constructor(terms, world) {
	      /** @type {World} */
	      this._world = world;
	  
	      /** @type {Tag[]} */
	      this.tags = [];
	      /** @type {Tag[]} */
	      this.relations = [];
	      /** @type {ComponentConstructor<any>[]} */
	      this.components = [];

	      /** @type {Tag[]} */
	      this.notTags = [];
	      /** @type {Tag[]} */
	      this.notRelations = [];
	      /** @type {ComponentConstructor<any>[]} */
	      this.notComponents = [];
	  
	      /** @type {string[]} */
	      this._unregisteredTags = [];
	      /** @type {string[]} */
	      this._unregisteredComponents = [];
	  
	      /**
	       * @private
	       * @type {string?}
	       */
	      this._cachedKey = null;
	  
	      /**
	       * @private
	       * @type {boolean?}
	       */
	      this._cachedIsValid = null;
	      
	      terms.forEach(term => this._parseTerm(term));
	  
	      // Validated lazily
	      // this.validate();
	    }
	  
	    get key() {
	      this.validate();
	      if (this._cachedKey === null) {
	        var ids = [];
	        this.components.forEach(component => ids.push("" + component._typeId));
	        this.tags.forEach(tag => ids.push("" + tag._id));
	        this.relations.forEach(tag => ids.push("" + tag._id));
	        this.notComponents.forEach(component =>ids.push("!" + component._typeId));
	        this.notTags.forEach(tag => ids.push("!" + tag._id));
	        this.notRelations.forEach(tag => ids.push("!" + tag._id));
	  
	        this._cachedKey = ids.sort().join("-");
	      }
	      return this._cachedKey;
	    }
	  
	    /**
	     * 
	     * @param {string} [queryName]
	     * 
	     */
	    validate(queryName) {
	      if (!queryName && this._cachedIsValid !== null) {
	        // No need to print anything, this is just a normal validity check.
	        return this._cachedIsValid;
	      }
	      this._cachedIsValid = true;
	      
	      if (this._unregisteredComponents.length !== 0) {
	        this._cachedIsValid = false;
	        throw new Error(`Tried to create a query ${ queryName ? '"' + queryName + '" ' : ""
        }with unregistered components: [${this._unregisteredComponents.join(", ")}]`);
	      }
	      
	      if (this._unregisteredTags.length !== 0) {
	        this._cachedIsValid = false;
	        throw new Error(`Tried to create a query ${ queryName ? '"' + queryName + '" ' : ""
        }with unregistered tags: [${this._unregisteredTags.join(", ")}]`);
	      }
	    
	      if (this.components.length === 0 && this.tags.length === 0 && this.relations.length === 0) {
	        throw new Error("Tried to create a query with no positive components or tags (Not() components don't count)");
	      }
	  
	      return this._cachedIsValid;
	    }
	  
	    /**
	     * 
	     * @param {Entity} entity 
	     */
	    isMatch(entity) {
	      this.validate();
	      return (
	        entity.hasAllComponents(this.components) &&
	        !entity.hasAnyComponents(this.notComponents) &&
	        entity.hasAllTags(this.tags) &&
	        !entity.hasAnyTags(this.notTags) &&
	        entity.hasAllRelations(this.relations) &&
	        !entity.hasAnyRelations(this.notRelations)
	      );
	    }
	  
	    /**
	     * 
	     */
	    findAll() {
	      this.validate();
	      return this._world.entityManager._entities.filter(entity => this.isMatch(entity));
	    }
	  
	    /**
	     * @param {QueryTerm} term
	     * @param {boolean} [inverted]
	     */
	    _parseTerm(term, inverted) {
	      if (typeof term === "string") {
	        let tag = this._world.getTag(term);
	        if (tag) {
	          if (tag.isRelation) {
	            inverted ? this.notRelations.push(tag) : this.relations.push(tag);
	          } else {
	            inverted ? this.notTags.push(tag) : this.tags.push(tag);
	          }
	        } else {
	          this._unregisteredTags.push(term);
	        }
	      } else if (typeof term === "function") {
	        if (this._world.hasRegisteredComponent(term)) {
	          inverted ? this.notComponents.push(term) : this.components.push(term);
	        } else if (term.getName) {
	          this._unregisteredComponents.push(term.getName());
	        } else {
	          this._unregisteredComponents.push(term.name);
	        }
	      } else if (term instanceof Tag) {
	        if (this._world.hasRegisteredTag(term)) {
	          if (term.isRelation) {
	            inverted ? this.notRelations.push(term) : this.relations.push(term);
	          } else {
	            inverted ? this.notTags.push(term) : this.tags.push(term);
	          }
	        } else {
	          this._unregisteredTags.push(term.name);
	        }
	      } else {
	        if (term.operator !== "not") {
	          throw new Error("Logic operator '" + term.operator + "' is not supported. Supported logic operators: [not]");
	        }
	        if (inverted) {
	          throw new Error("Nested 'not' operators are not supported.");
	        }
	        this._parseTerm(term.innerTerm, true);
	      }
	    }
	  }

	class Query {
	  /**
	   * @param {QueryTerm[] | Filter} termsOrFilter List of terms to query
	   * @param {EntityManager} manager
	   */
	  constructor(termsOrFilter, manager) {
	    /**
	     * @type {Filter}
	     */
	    this.filter = null;
	    if (termsOrFilter instanceof Filter) {
	      this.filter = termsOrFilter;
	    } else {
	      this.filter = new Filter(termsOrFilter, manager.world);
	    }

	    /**
	     * @type {Entity[]}
	     */
	    this.entities = [];

	    /**
	     * @type {EventDispatcher<any>}
	     */
	    this.eventDispatcher = new EventDispatcher();

	    /**
	     * This query is being used by a reactive system
	     * @type {boolean}
	     */
	    this.reactive = false;

	    // Fill the query with the existing entities
	    this.entities = this.filter.findAll();
	    this.entities.forEach(entity => entity.queries.push(this));
	  }

	  /**
	   * Add entity to this query
	   * @param {Entity} entity
	   */
	  addEntity(entity) {
	    entity.queries.push(this);
	    this.entities.push(entity);

	    this.eventDispatcher.dispatchEvent(QueryEvents.added, entity);
	  }

	  /**
	   * Remove entity from this query
	   * @param {Entity} entity
	   */
	  removeEntity(entity) {
	    let index = this.entities.indexOf(entity);
	    if (~index) {
	      this.entities.splice(index, 1);

	      index = entity.queries.indexOf(this);
	      entity.queries.splice(index, 1);

	      this.eventDispatcher.dispatchEvent(
	        QueryEvents.removed,
	        entity
	      );
	    }
	  }

	  /**
	   * 
	   * @param {Entity} entity
	   */
	  match(entity) {
	    return this.filter.isMatch(entity);
	  }

	  toJSON() {
	    return {
	      key: this.filter.key,
	      reactive: this.reactive,
	      components: {
	        included: this.filter.components.map((C) => C.name),
	        not: this.filter.notComponents.map((C) => C.name),
	      },
	      numEntities: this.entities.length,
	    };
	  }

	  /**
	   * Return stats for this query
	   */
	  stats() {
	    return {
	      numComponents: this.filter.components.length,
	      numEntities: this.entities.length,
	    };
	  }
	}

	/**
	 * @typedef {{
	 *  [queryName: string]: QueryDef
	 * } | {}} SystemQueryDefs
	 */

	/**
	 * @typedef {{
	 *  results: Entity[],
	 *  added?: Entity[],
	 *  removed?: Entity[],
	 *  changed?: Entity[] | {[componentName: string]: Entity[]}
	 * }} QueryOutput
	 */

	/**
	 * @template S
	 * @typedef {(new(world: World, attributes: object) => S) & typeof System} SystemConstructor<S>
	 */

	/**
	 * A system that manipulates entities in the world.
	 */
	class System {
	  /**
	   * 
	   * @param {World} world 
	   * @param {object} [attributes]
	   */
	  constructor(world, attributes) {
	    /**
	     * @type {World}
	     */
	    this.world = world;

	    /**
	     * @type {boolean}
	     */
	    this.enabled = true;

	    /**
	     * A maping of names to query objects
	     * @type {{
	     *  [queryName: string]: Query
	     * }}
	     */
	    this._queryObjects = {};

	    /**
	     * The results of the queries defined in `Type.queries`. These results are
	     * updated live, even when entity removal and component removal is deferred!
	     * @type {{
	     *  [queryName: string]: QueryOutput
	     * }}
	     */
	    this.queries = {};

	    /**
	     * Execution priority (i.e: order) of the system. Systems with the same
	     * priority will execute in the order they were registered to the world.
	     * 
	     * @type {number}
	     */
	    this.priority = 0;

	    /**
	     * Used for stats
	     * @type {number}
	     */ 
	    this.executeTime = 0;

	    if (attributes && attributes.priority) {
	      this.priority = attributes.priority;
	    }

	    /**
	     * @type {Query[]}
	     */
	    this._mandatoryQueries = [];

	    /**
	     * @type {boolean}
	     */
	    this.initialized = true;

	    // Parse the query definition object into queries
	    const queryDefs = (/** @type {SystemConstructor<this>} */(this.constructor)).queries;
	    if (queryDefs) {
	      for (var queryName in queryDefs) {
	        var queryConfig = queryDefs[queryName];
	        this._createQuery(queryName, queryConfig);
	      }
	    }
	  }

	  /**
	   * 
	   * @param {string} queryName 
	   * @param {QueryDef} queryConfig 
	   */
	  _createQuery(queryName, queryConfig) {
	    var terms = queryConfig.components;
	    if (!terms || terms.length === 0) {
	      throw new Error("'components' attribute can't be empty in a query");
	    }

	    // Check for errors in the query
	    let filter = new Filter(terms, this.world);
	    filter.validate(this.getName() + "." + queryName);

	    // Find or create the query object.
	    var query = this.world.entityManager.getQueryByComponents(filter, true);
	    
	    this._queryObjects[queryName] = query;
	    this.queries[queryName] = {
	      results: query.entities,
	    };

	    if (queryConfig.mandatory === true) {
	      this._mandatoryQueries.push(query);
	    }
	    
	    // Reactive configuration added/removed/changed
	    var validEvents = Object.keys(QueryEvents);

	    if (queryConfig.listen) {
	      if (this.execute === System.prototype.execute) {
	        console.warn(
	          `System '${this.getName()}' has defined listen events (${validEvents.join(
            ", "
          )}) for query '${queryName}' but it does not implement the 'execute' method.`
	        );
	      }

	      validEvents
	        .filter(eventName => queryConfig.listen[eventName] && eventName !== QueryEvents.changed)
	        .forEach((eventName) => this._registerQueryEventListener(eventName, query, queryName));
	      
	        if (queryConfig.listen.changed) {
	          this._registerChangedEventListener(query, queryName, queryConfig.listen.changed);
	        }
	    }
	  }

	  /**
	   * 
	   * @param {Query} query 
	   * @param {string} queryName 
	   * @param {boolean | ComponentConstructor<any>[]} config 
	   */
	  _registerChangedEventListener(query, queryName, config) {
	    query.reactive = true;
	    if (config === true) {
	      // Any change on the entity from the components in the query
	      /** @type {Entity[]} */
	      let eventList = (this.queries[queryName].changed = []);
	      query.eventDispatcher.addEventListener(
	        QueryEvents.changed,
	        (dispatcher, eventName, entity) => {
	          // Avoid duplicates
	          if (!eventList.includes(entity)) {
	            eventList.push(entity);
	          }
	        }
	      );
	    } else if (Array.isArray(config)) {
	      /** @type {Entity[]} */
	      let eventList = (this.queries[queryName].changed = []);
	      query.eventDispatcher.addEventListener(
	        QueryEvents.changed,
	        (dispatcher, eventName, entity, changedComponent) => {
	          // Avoid duplicates
	          if (
	            config.includes(/** @type{ComponentConstructor<any>} */ (changedComponent.constructor)) &&
	            !eventList.includes(entity)
	          ) {
	            eventList.push(entity);
	          }
	        }
	      );
	    } else {
	      throw new Error("Expected either `true` or Array for listen.changed, found: " + config);
	      /*
	      // Checking just specific components
	      let changedList = (this.queries[queryName][eventName] = {});
	      event.forEach(component => {
	        let eventList = (changedList[
	          componentPropertyName(component)
	        ] = []);
	        query.eventDispatcher.addEventListener(
	          Query.prototype.COMPONENT_CHANGED,
	          (entity, changedComponent) => {
	            if (
	              changedComponent.constructor === component &&
	              eventList.indexOf(entity) === -1
	            ) {
	              eventList.push(entity);
	            }
	          }
	        );
	      });
	      */
	    }
	  }

	  /**
	   * 
	   * @param {string} eventName 
	   * @param {Query} query 
	   * @param {string} queryName 
	   */
	  _registerQueryEventListener(eventName, query, queryName) {
	    /** @type {Entity[]} */
	    let eventList = (this.queries[queryName][eventName] = []);

	    query.eventDispatcher.addEventListener(
	      QueryEvents[eventName],
	      (dispatcher, eventName, entity) => {
	        // @fixme overhead?
	        if (!eventList.includes(entity)) {
	          eventList.push(entity);
	        }
	      }
	    );
	  }

	  /**
	   * Check if there are any mandatory queries that are blocking execution.
	   */
	   canExecute() {
	    if (this._mandatoryQueries.length === 0) return true;

	    for (let i = 0; i < this._mandatoryQueries.length; i++) {
	      var query = this._mandatoryQueries[i];
	      if (query.entities.length === 0) {
	        return false;
	      }
	    }

	    return true;
	  }

	  /**
	   * This function is called for each run of world.
	   * All of the `queries` defined on the class are available here.
	   * 
	   * Deferred removal of entities and components is processed right after
	   * the call to `execute`.
	   * 
	   * @param {number} delta
	   * @param {number} time
	   */
	  execute(delta, time) {}

	  /**
	   * Called when the system is added to the world.
	   * 
	   * @param {any} attributes 
	   */
	  init(attributes) {}

	  getName() {
	    return (/** @type {typeof System} */ (this.constructor)).getName();
	  }

	  stop() {
	    this.executeTime = 0;
	    this.enabled = false;
	  }

	  play() {
	    this.enabled = true;
	  }

	  // @question rename to clear queues?
	  clearEvents() {
	    for (let queryName in this.queries) {
	      var query = this.queries[queryName];
	      if (query.added) {
	        query.added.length = 0;
	      }
	      if (query.removed) {
	        query.removed.length = 0;
	      }
	      if (query.changed) {
	        if (Array.isArray(query.changed)) {
	          query.changed.length = 0;
	        } else {
	          for (let name in query.changed) {
	            query.changed[name].length = 0;
	          }
	        }
	      }
	    }
	  }

	  toJSON() {
	    var json = {
	      name: this.getName(),
	      enabled: this.enabled,
	      executeTime: this.executeTime,
	      priority: this.priority,
	      queries: {},
	    };

	    const queryDefs = (/** @type {SystemConstructor<this>} */ (this.constructor)).queries;
	    if (queryDefs) {
	      var queries = queryDefs;
	      for (let queryName in queries) {
	        let query = this.queries[queryName];
	        let queryDefinition = queries[queryName];
	        /** @type {object} */
	        let jsonQuery = (json.queries[queryName] = {
	          key: this._queryObjects[queryName].filter.key,
	        });

	        jsonQuery.mandatory = queryDefinition.mandatory === true;
	        jsonQuery.reactive =
	          queryDefinition.listen &&
	          (queryDefinition.listen.added === true ||
	            queryDefinition.listen.removed === true ||
	            queryDefinition.listen.changed === true ||
	            Array.isArray(queryDefinition.listen.changed));

	        if (jsonQuery.reactive) {
	          jsonQuery.listen = {};

	          const methods = ["added", "removed", "changed"];
	          methods.forEach((method) => {
	            if (query[method]) {
	              jsonQuery.listen[method] = {
	                entities: query[method].length,
	              };
	            }
	          });
	        }
	      }
	    }

	    return json;
	  }
	}

	/**
	 * @type {true}
	 */
	System.isSystem = true;

	/**
	 * @type {string?}
	 */
	System.displayName = undefined;

	/**
	 * Defines what Components the System will query for.
	 * This needs to be user defined.
	 * @type {SystemQueryDefs}
	 */
	System.queries = undefined;

	System.getName = function () {
	  return this.displayName || this.name;
	};

	// Detector for browser's "window"
	const hasWindow = typeof window !== "undefined";

	// performance.now() "polyfill"
	const now =
	  hasWindow && typeof window.performance !== "undefined"
	    ? performance.now.bind(performance)
	    : Date.now.bind(Date);

	class SystemManager {
	  /**
	   * 
	   * @param {World} world 
	   */
	  constructor(world) {
	    /**
	     * @type {System[]}
	     */
	    this._systems = [];
	    /**
	     * Systems that have `execute` method
	     * @type {System[]}
	     */
	    this._executeSystems = [];
	    /**
	     * @type {World}
	     */
	    this.world = world;
	    /**
	     * @type {System?}
	     */
	    this.lastExecutedSystem = null;
	  }

	  /**
	   * @template {System} S
	   * @param {SystemConstructor<S>} SystemClass 
	   * @param {object} [attributes]
	   */
	  registerSystem(SystemClass, attributes) {
	    if (!SystemClass.isSystem) {
	      throw new Error(
	        `System '${SystemClass.name}' does not extend 'System' class`
	      );
	    }

	    if (this.getSystem(SystemClass) !== undefined) {
	      console.warn(`System '${SystemClass.getName()}' already registered.`);
	      return this;
	    }

	    var system = new SystemClass(this.world, attributes);
	    if (system.init !== System.prototype.init) {
	      system.init(attributes);
	    }
	    this._systems.push(system);
	    if (system.execute !== System.prototype.execute) {
	      this._executeSystems.push(system);
	      this.sortSystems();
	    }
	    return this;
	  }

	  /**
	   * @template {System} S
	   * @param {SystemConstructor<S>} SystemClass 
	   */
	  unregisterSystem(SystemClass) {
	    let system = this.getSystem(SystemClass);
	    if (system === undefined) {
	      console.warn(
	        `Can't unregister system '${SystemClass.getName()}'. It doesn't exist.`
	      );
	      return this;
	    }

	    this._systems.splice(this._systems.indexOf(system), 1);

	    if (system.execute !== System.prototype.execute) {
	      this._executeSystems.splice(this._executeSystems.indexOf(system), 1);
	    }

	    // @todo Add system.unregister() call to free resources
	    return this;
	  }

	  sortSystems() {
	    /**
	     * @param {System} a 
	     * @param {System} b 
	     */
	    let sortFn = (a, b) => {
	      return a.priority - b.priority || this._systems.indexOf(a) - this._systems.indexOf(b);
	    };
	    sortFn.bind(this);
	    this._executeSystems.sort(sortFn);
	  }

	  /**
	   * @template {System} S
	   * @param {SystemConstructor<S>} SystemClass 
	   * @returns {S?}
	   */
	  getSystem(SystemClass) {
	    return /** @type {S?} */ (this._systems.find((s) => s instanceof SystemClass));
	  }

	  getSystems() {
	    return this._systems;
	  }

	  /**
	   * 
	   * @param {System} system 
	   * @param {number} delta 
	   * @param {number} time 
	   */
	  executeSystem(system, delta, time) {
	    if (system.initialized) {
	      if (system.canExecute()) {
	        let startTime = now();
	        system.execute(delta, time);
	        system.executeTime = now() - startTime;
	        this.lastExecutedSystem = system;
	        system.clearEvents();
	      }
	    }
	  }

	  stop() {
	    this._executeSystems.forEach((system) => system.stop());
	  }

	  /**
	   * 
	   * @param {number} delta 
	   * @param {number} time 
	   * @param {boolean} [forcePlay]
	   */
	  execute(delta, time, forcePlay) {
	    this._executeSystems.forEach(
	      (system) =>
	        (forcePlay || system.enabled) && this.executeSystem(system, delta, time)
	    );
	  }

	  stats() {
	    /**
	     * @type {{
	     *  numSystems: number,
	     *  systems: {
	     *    [name: string]: {
	     *      executeTime: number,
	     *      queries: {
	     *        [name: string]: ReturnType<Query["stats"]>
	     *      }
	     *    }
	     *  }
	     * }}
	     */
	    var stats = {
	      numSystems: this._systems.length,
	      systems: {},
	    };

	    for (var i = 0; i < this._systems.length; i++) {
	      var system = this._systems[i];
	      var systemStats = (stats.systems[system.getName()] = {
	        queries: {},
	        executeTime: system.executeTime,
	      });
	      for (var name in system.queries) {
	        systemStats.queries[name] = system._queryObjects[name].stats();
	      }
	    }

	    return stats;
	  }
	}

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
	class ObjectPool {
	  
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

	/**
	 * @private
	 * @class QueryManager
	 */
	class QueryManager {
	  /**
	   * 
	   * @param {World} world
	   * @param {EntityManager} manager
	   */
	  constructor(world, manager) {
	    /**
	     * @type {World}
	     */
	    this._world = world;

	    /**
	     * Queries indexed by a unique identifier for the components it has
	     * @type {{ [name: string]: Query }}
	     */
	    this._queries = {};

	    manager.endEventDispatcher.addEventListener(EntityEvents.removed, this.onEntityRemoved.bind(this));
	    let events = [
	      EntityEvents.componentAdded, EntityEvents.componentRemoved,
	      EntityEvents.tagAdded, EntityEvents.tagRemoved,
	      EntityEvents.pairAdded, EntityEvents.pairRemoved];
	    events.forEach(eventName => {
	      manager.endEventDispatcher.addEventListener(eventName, this._onEntityEvent.bind(this));
	    }, this);
	  }

	  /**
	   * @param {string} eventType
	   * @param {Entity} entity 
	   */
	  onEntityRemoved(dispatcher, eventType, entity) {
	    for (var queryName in this._queries) {
	      var query = this._queries[queryName];
	      if (entity.queries.indexOf(query) !== -1) {
	        query.removeEntity(entity);
	      }
	    }
	  }

	  /**
	   * @param {string} eventType
	   * @param {Entity} entity Entity that just got the new component
	   * @param {any} data
	   */
	  _onEntityEvent(dispatcher, eventType, entity, data) {

	    // Check each indexed query to see if we need to add this entity to the list
	    for (var queryName in this._queries) {
	      var query = this._queries[queryName];

	      if (query.entities.includes(entity)) {
	        if (!query.filter.isMatch(entity)) {
	          query.removeEntity(entity);
	        }
	      } else {
	        if (query.filter.isMatch(entity)) {
	          query.addEntity(entity);
	        }
	      }
	    }
	  }

	  /**
	   * Callback when a component is removed from an entity
	   * @param {Entity} entity Entity to remove the component from
	   * @param {ComponentConstructor<any>} Component Component to remove from the entity
	   */
	  onEntityComponentRemoved(entity, Component) {
	    for (var queryName in this._queries) {
	      var query = this._queries[queryName];

	      if (
	        !!~query.filter.notComponents.indexOf(Component) &&
	        !~query.entities.indexOf(entity) &&
	        query.match(entity)
	      ) {
	        query.addEntity(entity);
	        continue;
	      }

	      if (
	        !!~query.filter.components.indexOf(Component) &&
	        !!~query.entities.indexOf(entity) &&
	        !query.match(entity)
	      ) {
	        query.removeEntity(entity);
	        continue;
	      }
	    }
	  }

	  /**
	   * Get a query for the specified components
	   * @param {QueryTerm[] | Filter} termsOrFilter Components that the query should have
	   * @param {boolean} [createIfNotFound]
	   */
	  getQuery(termsOrFilter, createIfNotFound) {
	    let filter;
	    if (termsOrFilter instanceof Array) {
	      filter = new Filter(termsOrFilter, this._world);
	    } else {
	      filter = termsOrFilter;
	    }

	    let query = this._queries[filter.key];
	    if (!query) {
	      if (createIfNotFound) {
	        this._queries[filter.key] = query = new Query(filter, this._world.entityManager);
	      } else {
	        query = null;
	      }
	    }
	    return query;
	  }

	  /**
	   * Return some stats from this class
	   */
	  stats() {
	    /**
	     * @type {{ [queryName: string]: ReturnType<Query["stats"]> }}
	     */
	    var stats = {};
	    for (var queryName in this._queries) {
	      stats[queryName] = this._queries[queryName].stats();
	    }
	    return stats;
	  }
	}

	/**
	 * Components that extend the SystemStateComponent are not removed when an
	 * entity is deleted.
	 */
	class SystemStateComponent extends Component {}

	/**
	 * @type {true}
	 */
	SystemStateComponent.isSystemStateComponent = true;

	/**
	 * @extends {ObjectPool<Entity>}
	 */
	class EntityPool extends ObjectPool {
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
	class EntityManager {
	  /**
	   * 
	   * @param {World} world 
	   */
	  constructor(world) {
	    /**
	     * @type {World}
	     */
	    this.world = world;

	    /**
	     * @type {ComponentManager}
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
	   * @param {ComponentConstructor<any>} Component Component to be added to the entity
	   * @param {object} [values] Optional values to replace the default attributes
	   */
	  entityAddComponent(entity, Component, values) {
	    // @todo Probably define Component._typeId with a default value and avoid using typeof
	    if (
	      typeof Component._typeId !== "undefined" &&
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
	   * @param {ComponentConstructor<any>} Component Component to remove from the entity
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
	   * @param {ComponentConstructor<any>} Component 
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
	   * @param {Entity | EntityHandleType} relEntity 
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
	   * @param {Entity | EntityHandleType} relEntity 
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
	   * @param {QueryTerm[] | Filter} termsOrFilter List of components that will form the query
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
	      let componentType = (/** @type {ComponentConstructor<any>} */ (pool.Type));
	      stats.componentPool[componentType.getName()] = pool.stats();
	    }

	    return stats;
	  }
	}

	class ComponentManager {
	  
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

	    /**
	     * All registered tags by name
	     * @type {{ [name: string]: Tag }}
	     */
	    this._tags = {};
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
	      pool = objectPool;
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
	   * @param {Tag} tag 
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
	    delete this._tags[name];
	  }
	}

	ComponentManager._nextComponentId = 1;

	const Version = "0.3.1";

	/**
	 * @typedef {{
	 *  entityPoolSize: number,
	 *  entityClass: typeof Entity
	 * }} WorldOptions
	 */

	/** @type {WorldOptions} */
	const DEFAULT_OPTIONS = {
	  entityPoolSize: 0,
	  entityClass: Entity,
	};

	/**
	 * The World is the root of the ECS.
	 */
	class World {
	  /**
	   * Create a new World.
	   * 
	   * @param {Partial<WorldOptions>} options 
	   */
	  constructor(options = {}) {
	    /**
	     * @type {WorldOptions}
	     */
	    this.options = Object.assign({}, DEFAULT_OPTIONS, options);

	    /**
	     * @type {ComponentManager}
	     */
	    this.componentsManager = new ComponentManager();

	    /**
	     * @type {EntityManager}
	     */
	    this.entityManager = new EntityManager(this);

	    /**
	     * @type {SystemManager}
	     */
	    this.systemManager = new SystemManager(this);

	    /**
	     * Whether the world should execute its systems. If true, the world
	     * will use the `execute` function to update its timers, but won't
	     * do anything else.
	     * @type {boolean}
	     */
	    this.enabled = true;

	    if (hasWindow && typeof CustomEvent !== "undefined") {
	      var event = new CustomEvent("ecsy-world-created", {
	        detail: { world: this, version: Version },
	      });
	      window.dispatchEvent(event);
	    }

	    /**
	     * @type {number} The sum of all delta times between executions
	     */
	    this.totalTimePassed = 0;

	    /**
	     * @type {number} The last time execute() was called, in seconds
	     */
	    this.lastTime = now() / 1000;
	  }

	  /**
	   * Register a component class.
	   * @template {Component} C
	   * @param {ComponentConstructor<C>} Component 
	   * @param {ObjectPool<C> | false} [objectPool]
	   */
	  registerComponent(Component, objectPool) {
	    this.componentsManager.registerComponent(Component, objectPool);
	    return this;
	  }

	  /**
	   * Check whether a component class has been registered to this world.
	   * @param {ComponentConstructor<any>} Component 
	   */
	   hasRegisteredComponent(Component) {
	    return this.componentsManager.hasComponent(Component);
	  }

	  /**
	   * Register a system, adding it to the list of systems to execute.
	   * @param {SystemConstructor<any>} System 
	   * @param {any} attributes 
	   */
	  registerSystem(System, attributes) {
	    this.systemManager.registerSystem(System, attributes);
	    return this;
	  }

	  /**
	   * Unregister a system, removing it from the list of systems to execute.
	   * @param {SystemConstructor<any>} System 
	   */
	  unregisterSystem(System) {
	    this.systemManager.unregisterSystem(System);
	    return this;
	  }

	  /**
	   * Get the instance of a system type that is registered in this world.
	   * @template {System} S The system's class
	   * @param {SystemConstructor<S>} System The type of system to get.
	   * @returns {S?}
	   */
	  getSystem(System) {
	    return this.systemManager.getSystem(System);
	  }

	  /**
	   * Get a list of systems registered in this world.
	   * @returns {System[]}
	   */
	  getSystems() {
	    return this.systemManager.getSystems();
	  }

	  /**
	   * Register a new tag or a tag created in another world.
	   * @param {string | Tag} tagOrName
	   */
	  registerTag(tagOrName) {
	    this.componentsManager.registerTag(tagOrName);
	    return this;
	  }

	  /**
	   * Register a new relation or a relation created in another world.
	   * @param {string | Tag} relationOrName 
	   * @returns 
	   */
	  registerRelation(relationOrName) {
	    this.componentsManager.registerRelation(relationOrName);
	    return this;
	  }

	  /**
	   * Get the tag object for a given tag name or relation name, if it exists.
	   * @param {string | Tag} nameOrTag 
	   * @param {boolean} [createIfNotFound] If a tag is not found, create a new one and return that.
	   * @returns {Tag?}
	   */
	  getTag(nameOrTag, createIfNotFound) {
	    if (typeof nameOrTag === "string") {
	      let tag = this.componentsManager.getTag(nameOrTag);
	      if (!tag && createIfNotFound) {
	        this.componentsManager.registerTag(nameOrTag);
	        return this.componentsManager.getTag(nameOrTag);
	      } else {
	        return tag;
	      }
	    } else {
	      return nameOrTag;
	    }
	  }

	  /**
	   * Gets a Tag object that may represent a tag or a relation
	   * @param {string | Tag} nameOrTag 
	   * @returns {Tag}
	   */
	  _getTagOrError(nameOrTag) {
	    if (typeof nameOrTag === "string") {
	      let tag = this.componentsManager.getTag(nameOrTag);
	      if (tag) {
	        return tag;
	      } else {
	        throw new Error(`Cannot use tag "${nameOrTag}" before registering it.`);
	      }
	    } else {
	      return nameOrTag;
	    }
	  }

	  /**
	   * 
	   * @param {Tag | string} tagOrName
	   */
	  hasRegisteredTag(tagOrName) {
	    if (typeof tagOrName === "string") {
	      let tag = this.componentsManager.getTag(tagOrName);
	      return !!(tag && !tag.isRelation);
	    } else {
	      return !tagOrName.isRelation && this.componentsManager.hasRegisteredTag(tagOrName);
	    }
	  }

	  /**
	   * 
	   * @param {Tag | string} relation 
	   * @returns 
	   */
	  hasRegisteredRelation(relation) {
	    if (typeof relation === "string") {
	      let relationTag = this.componentsManager.getTag(relation);
	      return !!(relationTag && relationTag.isRelation);
	    } else {
	      return relation.isRelation && this.componentsManager.hasRegisteredTag(relation);
	    }
	  }

	  /**
	   * Executes all systems in this world.
	   * 
	   * The delta since the last time execute() was run is calculated automatically.
	   * However, it can be overridden with the `delta` parameter. The provided or
	   * calculated delta will be used to update the `time` parameter passed to
	   * `System.execute()`.
	   * 
	   * @param {number} [delta] The time since the last frame, in seconds.
	   */

	  execute(delta) {
	    let currentTime = now() / 1000;
	    if (typeof delta !== "number") {
	      delta = currentTime - this.lastTime;
	    }
	    this.lastTime = currentTime;
	    this.totalTimePassed += delta;

	    if (this.enabled) {
	      this.systemManager.execute(delta, this.totalTimePassed);
	      this.entityManager.processDeferredRemoval();
	    }
	  }

	  /**
	   * Stop execution of this world.
	   */
	  stop() {
	    this.enabled = false;
	  }

	  /**
	   * Resume execution of this world.
	   */
	  play() {
	    this.enabled = true;
	  }

	  /**
	   * Create a new entity and add it to this world.
	   * @param {string} [name] A unique name for the entity.
	   */
	  createEntity(name) {
	    return this.entityManager.createEntity(name);
	  }

	  stats() {
	    var stats = {
	      entities: this.entityManager.stats(),
	      system: this.systemManager.stats(),
	    };

	    return stats;
	  }

	  /**
	   * 
	   * @param {QueryTerm[]} components 
	   */
	  filter(components) {
	    return new Filter(components, this).findAll();
	  }
	}

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
	const copyValue = (src) => src;

	/**
	 * Clone something by value.
	 * 
	 * @template T
	 * @param {T} src 
	 * @returns T
	 */
	const cloneValue = (src) => src;

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
	const copyArray = (src, dest) => {
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
	const cloneArray = (src) => src && src.slice();

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
	const copyJSON = (src) => JSON.parse(JSON.stringify(src));

	/**
	 * Expensive way to create a "deep" clone of an object or array of objects.
	 * 
	 * This function is safe to use with `null` but is NOT safe with `undefined`.
	 * 
	 * @template T
	 * @param {T} src 
	 * @returns {T}
	 */
	const cloneJSON = (src) => JSON.parse(JSON.stringify(src));

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
	const copyCopyable = (src, dest) => {
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
	const cloneClonable = (src) => src && src.clone();


	/**
	 * @template T
	 * @param {Partial<PropType<T>>} typeDefinition 
	 * @returns {PropType<T>}
	 */
	function createType(typeDefinition) {
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

	/**
	 * Standard types
	 */
	const Types = {
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
	};

	exports.Component = Component;
	exports.Entity = Entity;
	exports.EntityEvents = EntityEvents;
	exports.Filter = Filter;
	exports.Not = Not;
	exports.ObjectPool = ObjectPool;
	exports.Query = Query;
	exports.QueryEvents = QueryEvents;
	exports.System = System;
	exports.SystemStateComponent = SystemStateComponent;
	exports.Tag = Tag;
	exports.Types = Types;
	exports.Version = Version;
	exports.World = World;
	exports.cloneArray = cloneArray;
	exports.cloneClonable = cloneClonable;
	exports.cloneJSON = cloneJSON;
	exports.cloneValue = cloneValue;
	exports.copyArray = copyArray;
	exports.copyCopyable = copyCopyable;
	exports.copyJSON = copyJSON;
	exports.copyValue = copyValue;
	exports.createType = createType;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
