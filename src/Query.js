import { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import EventDispatcher from "./EventDispatcher.js";
import { Filter } from "./Filter.js";

/**
 * Imported
 * @typedef {import("./Component.js").QueryTerm} QueryTerm
 */

export class Query {
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

    this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);
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
        Query.prototype.ENTITY_REMOVED,
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

Query.prototype.ENTITY_ADDED = "Query#ENTITY_ADDED";
Query.prototype.ENTITY_REMOVED = "Query#ENTITY_REMOVED";
Query.prototype.COMPONENT_CHANGED = "Query#COMPONENT_CHANGED";

/**
 * @enum {string}
 */
 export const QueryEvents = {
  added: Query.prototype.ENTITY_ADDED,
  removed: Query.prototype.ENTITY_REMOVED,
  changed: Query.prototype.COMPONENT_CHANGED, // Query.prototype.ENTITY_CHANGED
};
