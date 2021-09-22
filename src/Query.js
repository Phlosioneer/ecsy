import EventDispatcher from "./EventDispatcher.js";
import { queryKey } from "./Utils.js";

export default class Query {
  /**
   * @param {Array(Component)} Components List of types of components to query
   */
  constructor(Components, manager) {
    this.filter = new Filter(Components);

    this.entities = [];

    this.eventDispatcher = new EventDispatcher();

    // This query is being used by a reactive system
    this.reactive = false;

    this.key = queryKey(Components);

    // Fill the query with the existing entities
    this.entities = this.filter.findAll(manager);
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

  match(entity) {
    return this.filter.isMatch(entity);
  }

  toJSON() {
    return {
      key: this.key,
      reactive: this.reactive,
      components: {
        included: this.Components.map((C) => C.name),
        not: this.NotComponents.map((C) => C.name),
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

export class Filter {
  constructor(components) {
    this.components = [];
    this.notComponents = [];

    components.forEach((component) => {
      if (typeof component === "object") {
        this.notComponents.push(component.Component);
      } else {
        this.components.push(component);
      }
    });

    if (this.components.length === 0) {
      throw new Error("Can't create a query without components");
    }
  }

  isMatch(entity) {
    return (
      entity.hasAllComponents(this.components) &&
      !entity.hasAnyComponents(this.notComponents)
    );
  }

  findAll(entityManager) {
    return entityManager._entities.filter(entity => this.isMatch(entity));
  }
}



