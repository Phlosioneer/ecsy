import { SystemManager } from "./SystemManager.js";
import { EntityManager } from "./EntityManager.js";
import { ComponentManager } from "./ComponentManager.js";
import { Version } from "./Version.js";
import { hasWindow, now } from "./Utils.js";
import { Entity } from "./Entity.js";
import { Filter } from "./Filter.js";

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
export class World {
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
   * @template {import("./Component").Component} C
   * @param {import("./constants").ComponentConstructor<C>} Component 
   * @param {import("./ObjectPool").ObjectPool<C> | false} [objectPool]
   */
  registerComponent(Component, objectPool) {
    this.componentsManager.registerComponent(Component, objectPool);
    return this;
  }

  /**
   * Check whether a component class has been registered to this world.
   * @param {import("./constants").ComponentConstructor<any>} Component 
   */
   hasRegisteredComponent(Component) {
    return this.componentsManager.hasComponent(Component);
  }

  /**
   * Register a system, adding it to the list of systems to execute.
   * @param {import("./System").SystemConstructor<any>} System 
   * @param {any} attributes 
   */
  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
  }

  /**
   * Unregister a system, removing it from the list of systems to execute.
   * @param {import("./System").SystemConstructor<any>} System 
   */
  unregisterSystem(System) {
    this.systemManager.unregisterSystem(System);
    return this;
  }

  /**
   * Get the instance of a system type that is registered in this world.
   * @template {import("./System").System} S The system's class
   * @param {import("./System").SystemConstructor<S>} System The type of system to get.
   * @returns {S?}
   */
  getSystem(System) {
    return this.systemManager.getSystem(System);
  }

  /**
   * Get a list of systems registered in this world.
   * @returns {import("./System").System[]}
   */
  getSystems() {
    return this.systemManager.getSystems();
  }

  /**
   * Register a new tag or a tag created in another world.
   * @param {string | import("./Tag").Tag} tagOrName
   */
  registerTag(tagOrName) {
    this.componentsManager.registerTag(tagOrName);
    return this;
  }

  /**
   * Register a new relation or a relation created in another world.
   * @param {string | import("./Tag").Tag} relationOrName 
   * @returns 
   */
  registerRelation(relationOrName) {
    this.componentsManager.registerRelation(relationOrName);
    return this;
  }

  /**
   * Get the tag object for a given tag name or relation name, if it exists.
   * @param {string | import("./Tag").Tag} nameOrTag 
   * @param {boolean} [createIfNotFound] If a tag is not found, create a new one and return that.
   * @returns {import("./Tag").Tag?}
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
   * @param {string | import("./Tag").Tag} nameOrTag 
   * @returns {import("./Tag").Tag}
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
   * @param {import("./Tag").Tag | string} tagOrName
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
   * @param {import("./Tag").Tag | string} relation 
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
   * @param {import("./constants").QueryTerm[]} components 
   */
  filter(components) {
    return new Filter(components, this).findAll();
  }
}
