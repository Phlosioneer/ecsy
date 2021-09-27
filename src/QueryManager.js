import { Query } from "./Query.js";
import { queryKey } from "./Utils.js";

/**
 * Imported
 * @template {import("./Component").Component} C
 * @typedef {import("./Component").ComponentConstructor<C>} ComponentConstructor<C>
 */



/**
 * @private
 * @class QueryManager
 */
export default class QueryManager {
  /**
   * 
   * @param {import("./World").World} world
   */
  constructor(world) {
    /**
     * @type {import("./World").World}
     */
    this._world = world;

    /**
     * Queries indexed by a unique identifier for the components it has
     * @type {{ [name: string]: Query }}
     */
    this._queries = {};
  }

  /**
   * 
   * @param {import("./Entity").Entity} entity 
   */
  onEntityRemoved(entity) {
    for (var queryName in this._queries) {
      var query = this._queries[queryName];
      if (entity.queries.indexOf(query) !== -1) {
        query.removeEntity(entity);
      }
    }
  }

  /**
   * Callback when a component is added to an entity
   * @param {import("./Entity").Entity} entity Entity that just got the new component
   * @param {ComponentConstructor<any>} Component Component added to the entity
   */
  onEntityComponentAdded(entity, Component) {
    // @todo Use bitmask for checking components?

    // Check each indexed query to see if we need to add this entity to the list
    for (var queryName in this._queries) {
      var query = this._queries[queryName];

      if (
        !!~query.filter.notComponents.indexOf(Component) &&
        ~query.entities.indexOf(entity)
      ) {
        query.removeEntity(entity);
        continue;
      }

      // Add the entity only if:
      // Component is in the query
      // and Entity has ALL the components of the query
      // and Entity is not already in the query
      if (
        !~query.filter.components.indexOf(Component) ||
        !query.match(entity) ||
        ~query.entities.indexOf(entity)
      )
        continue;

      query.addEntity(entity);
    }
  }

  /**
   * Callback when a component is removed from an entity
   * @param {import("./Entity").Entity} entity Entity to remove the component from
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
   * @param {import("./Query.js").LogicalComponent[]} Components Components that the query should have
   */
  getQuery(Components) {
    var key = queryKey(Components, this._world);
    var query = this._queries[key];
    if (!query) {
      this._queries[key] = query = new Query(Components, this._world.entityManager);
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
