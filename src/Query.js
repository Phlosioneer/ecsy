import { QueryEvents } from "./constants.js";
import { Entity } from "./Entity.js";
import EventDispatcher from "./EventDispatcher.js";
import { Filter } from "./Filter.js";

export class Query {
  /**
   * @param {import("./Typedefs").QueryTerm[] | Filter} termsOrFilter List of terms to query
   * @param {import("./EntityManager").EntityManager} manager
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

