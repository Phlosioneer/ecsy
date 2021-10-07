import { Filter, Query } from "./Query.js";

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
   * 
   * @param {import("./Entity").Entity} entity 
   * @param {import("./Tag").Tag} tag 
   */
  onEntityTagAdded(entity, tag) {
    for (var queryName in this._queries) {
      var query = this._queries[queryName];

      if (
        query.filter.notTags.includes(tag) &&
        query.entities.includes(entity)
      ) {
        query.removeEntity(entity);
        continue;
      }

      if (
        query.filter.tags.includes(tag) &&
        query.match(entity) &&
        !query.entities.includes(entity)
      ) {
        query.addEntity(entity);
      }
    }
  }

  /**
   * 
   * @param {import("./Entity").Entity} entity 
   * @param {import("./Tag").Tag} tag 
   */
  onEntityTagRemoved(entity, tag) {
    for (let queryName in this._queries) {
      var query = this._queries[queryName];

      if (
        query.filter.notTags.includes(tag) &&
        query.match(entity) &&
        !query.entities.includes(entity)
      ) {
        query.addEntity(entity);
        continue;
      }

      if (
        query.filter.tags.includes(tag) &&
        query.match(entity) &&
        query.entities.includes(entity)
      ) {
        query.removeEntity(entity);
      }
    }
  }

  /**
   * Get a query for the specified components
   * @param {import("./Component").QueryTerm[] | Filter} termsOrFilter Components that the query should have
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
