import { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import EventDispatcher from "./EventDispatcher.js";
import { Tag } from "./Tag.js";

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

export class Filter {
  /**
 * Parse an array of mixed terms into split arrays.
 * @param {import("./Query").QueryTerm[]} terms 
 * @param {import("./World").World} world 
 */
  constructor(terms, world) {
    /** @type {import("./World").World} */
    this._world = world;

    /** @type {Tag[]} */
    this.tags = [];
    /** @type {import("./Component").ComponentConstructor<any>[]} */
    this.components = [];
    /** @type {Tag[]} */
    this.notTags = [];
    /** @type {import("./Component").ComponentConstructor<any>[]} */
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
      this.notComponents.forEach(component =>ids.push("!" + component._typeId));
      this.notTags.forEach(tag => ids.push("!" + tag._id));

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
  
    if (this.components.length === 0 && this.tags.length === 0) {
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
      !entity.hasAnyTags(this.notTags)
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
   * @param {import("./Query").QueryTerm} term
   * @param {boolean} [inverted]
   */
  _parseTerm(term, inverted) {
    if (typeof term === "string") {
      let tag = this._world.getTag(term);
      if (tag) {
        inverted ? this.notTags.push(tag) : this.tags.push(tag);
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
        inverted ? this.notTags.push(term) : this.tags.push(term);
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



