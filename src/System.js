import { Component } from "./Component.js";
import { Entity } from "./Entity.js";
import { Query } from "./Query.js";
import { Filter } from "./Filter.js";
import { QueryEvents } from "./constants.js";

/**
 * @typedef {{
 *  [queryName: string]: import("./constants").QueryDef
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
 * @typedef {(new(world: import("./World").World, attributes: object) => S) & typeof System} SystemConstructor<S>
 */

/**
 * A system that manipulates entities in the world.
 */
export class System {
  /**
   * 
   * @param {import("./World").World} world 
   * @param {object} [attributes]
   */
  constructor(world, attributes) {
    /**
     * @type {import("./World").World}
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
   * @param {import("./constants").QueryDef} queryConfig 
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
   * @param {boolean | import("./constants").ComponentConstructor<any>[]} config 
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
            config.includes(/** @type{import("./constants").ComponentConstructor<any>} */ (changedComponent.constructor)) &&
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

