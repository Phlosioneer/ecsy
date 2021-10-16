import { Tag } from "./Tag";


/**
 * Use the Not pseudo-class to negate a component query.
 * 
 * @template {import("./Component").Component} C
 * @param {import("./constants").QueryTerm} term
 * @returns {import("./constants").NotTerm}
 */
 export function Not(term) {
  return {
    operator: "not",
    innerTerm: term
  };
}

export class Filter {
    /**
   * Parse an array of mixed terms into split arrays.
   * @param {import("./constants").QueryTerm[]} terms 
   * @param {import("./World").World} world 
   */
    constructor(terms, world) {
      /** @type {import("./World").World} */
      this._world = world;
  
      /** @type {Tag[]} */
      this.tags = [];
      /** @type {Tag[]} */
      this.relations = [];
      /** @type {import("./constants").ComponentConstructor<any>[]} */
      this.components = [];

      /** @type {Tag[]} */
      this.notTags = [];
      /** @type {Tag[]} */
      this.notRelations = [];
      /** @type {import("./constants").ComponentConstructor<any>[]} */
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
     * @param {import("./Entity").Entity} entity 
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
     * @param {import("./constants").QueryTerm} term
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
  
  
  
  