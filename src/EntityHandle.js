
/**
 * @typedef {import("./Entity").Entity & EntityHandle & {
 *   deref: import("./Entity").Entity?,
 *   forceDeref: import("./Entity").Entity
 * }} EntityHandleType
 */

/**
 * 
 */
export class EntityHandle {
  /**
   * 
   * @param {import("./Entity").Entity} parent 
   */
  constructor(parent) {
    if (!parent.alive) {
        throw new Error("Can't make handle to dead entity");
    }



    /** @type {{id: number, name: string?}} */
    let pseudoObject = {
      id: parent.id,
      name: parent.name
    };

    function describeEntity(entity) {
      let ret = "Entity { id: " + pseudoObject.id;
      if (pseudoObject.name && pseudoObject.name.length > 0) {
        ret += ", name: \"" + pseudoObject.name + "\"";
      }
      return ret + "}";
    }

    let ret = new Proxy(parent, {
      // @ts-ignore
      pseudoObject: pseudoObject,
      get: function (target, prop, proxy) {
        prop = typeof prop === "string" ? prop : prop.toString();

        let alive = target.id === pseudoObject.id && target.alive;
        switch (prop) {
          // Always return the original id
          case "id": return pseudoObject.id;

          // Return the entity name, or if the entity is dead, return its last
          // known name
          case "name": return alive ? target.name : pseudoObject.name;

          // Aliveness is determined by matching IDs and the alive field
          case "alive": return alive;

          // Special function to get past the proxy
          case "deref":
            if (alive) {
              return target;
            } else {
              throw new Error(`Handle cannot be dereferenced: ${describeEntity(target)} is dead`);
            }
          
          // Function form of deref
          case "unwrapHandle": return () => proxy.deref;

          // Make sure that getHandle always works
          case "getHandle": return () => proxy;
          
          // Unsafely get past the proxy
          case "forceDeref": return target;
        }

        // For everything else, if alive, default to normal entity stuff.
        if (alive) {
          let property = target[prop];
          if (typeof property === "function") {
            return property.bind(target);
          } else {
            return target[prop];
          }
        } else {
          throw new Error(`Cannot access property "${prop}": ${describeEntity(target)} is dead`);
        }
      },
      set: function (target, prop, newValue) {
        prop = typeof prop === "string" ? prop : prop.toString();

        let alive = target.id === pseudoObject.id && target.alive;
        // Special: if name is set, update name in proxy
        if (prop === "name") {
          self.name = newValue;
          if (alive) {
            target.name = newValue;
          }
        }

        if (alive) {
          target[prop] = newValue;
        } else {
          throw new Error(`Cannot access property "${prop}": ${describeEntity(target)} is dead`);
        }
        return true;
      },
      // This is to ensure `(new EntityHandler()) instanceof EntityHandler`
      getPrototypeOf: function(target) {
        return EntityHandle.prototype;
      }
    });
    return ret;
  }

  /**
   * Dummy function for typechecking
   * @returns {import("./Entity").Entity}
   */
  unwrapHandle() { throw new Error("Unreachable"); }

  /**
   * Dummy function for typechecking
   * @returns {EntityHandleType}
   */
  getHandle() { throw new Error("Unreachable"); }
}

