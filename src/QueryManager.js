import { Query } from "./Query.js";
import { Filter } from "./Filter.js";
import { EntityEvents } from "./constants.js";

/**
 * @private
 * @class QueryManager
 */
export default class QueryManager {
  /**
   * 
   * @param {import("./World").World} world
   * @param {import("./EntityManager").EntityManager} manager
   */
  constructor(world, manager) {
    /**
     * @type {import("./World").World}
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
      EntityEvents.pairAdded, EntityEvents.pairRemoved]
    events.forEach(eventName => {
      manager.endEventDispatcher.addEventListener(eventName, this._onEntityEvent.bind(this));
    }, this);
  }

  /**
   * @param {string} eventType
   * @param {import("./Entity").Entity} entity 
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
   * @param {import("./Entity").Entity} entity Entity that just got the new component
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
   * @param {import("./Entity").Entity} entity Entity to remove the component from
   * @param {import("./Typedefs").ComponentConstructor<any>} Component Component to remove from the entity
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
   * @param {import("./Typedefs").QueryTerm[] | Filter} termsOrFilter Components that the query should have
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
