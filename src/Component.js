import environment from "./environment";

/**
 * @typedef {{
 *  default?: any,
 *  type: import("./Types").PropType<any>
 * }} ComponentSchemaProp
 */

/**
 * @typedef {{
 *  [propName: import("./Types").QueryKey]: ComponentSchemaProp
 * }} ComponentSchema
 */

export class Component {
  /**
   * @param {object} props 
   */
  constructor(props) {
    if (props !== false) {
      const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

      for (const key in schema) {
        if (props && props.hasOwnProperty(key)) {
          this[key] = props[key];
        } else {
          const schemaProp = schema[key];
          if (schemaProp.hasOwnProperty("default")) {
            this[key] = schemaProp.type.clone(schemaProp.default);
          } else {
            const type = schemaProp.type;
            this[key] = type.clone(type.default);
          }
        }
      }

      if (environment.isDev && props !== undefined) {
        this._checkUndefinedAttributes(props);
      }
    }

    this._pool = null;
  }

  /**
   * 
   * @param {this} source 
   * @returns {this}
   */
  copy(source) {
    /** @type {ComponentSchema} */
    const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

    for (const key in schema) {
      const prop = schema[key];

      if (source.hasOwnProperty(key)) {
        this[key] = prop.type.copy(source[key], this[key]);
      }
    }

    // @DEBUG
    if (environment.isDev) {
      this._checkUndefinedAttributes(source);
    }

    return this;
  }

  clone() {
    const ctor = (/** @type {typeof Component} */ (this.constructor));
    return new ctor().copy(this);
  }

  reset() {
    /** @type {ComponentSchema} */
    const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

    for (const key in schema) {
      const schemaProp = schema[key];

      if (schemaProp.hasOwnProperty("default")) {
        this[key] = schemaProp.type.copy(schemaProp.default, this[key]);
      } else {
        const type = schemaProp.type;
        this[key] = type.copy(type.default, this[key]);
      }
    }
  }

  dispose() {
    if (this._pool) {
      this._pool.release(this);
    }
  }

  getName() {
    return (/** @type {typeof Component} */ (this.constructor)).getName();
  }

  /**
   * 
   * @param {this} src 
   */
  _checkUndefinedAttributes(src) {
    /** @type {ComponentSchema} */
    const schema = (/** @type {typeof Component} */ (this.constructor)).schema;

    // Check that the attributes defined in source are also defined in the schema
    Object.keys(src).forEach((srcKey) => {
      if (!schema.hasOwnProperty(srcKey)) {
        console.warn(
          `Trying to set attribute '${srcKey}' not defined in the '${this.constructor.name}' schema. Please fix the schema, the attribute value won't be set`
        );
      }
    });
  }
}

/**
 * @type {ComponentSchema}
 */
Component.schema = {};

/**
 * @type {true}
 */
Component.isComponent = true;

/**
 * @type {string?}
 */
Component.displayName = null;

Component.getName = function () {
  return this.displayName || this.name;
};

/**
 * @type {number?}
 */
Component._typeId = undefined;