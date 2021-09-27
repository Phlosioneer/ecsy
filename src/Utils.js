
/**
 * Get a key from a list of components
 * @param {import("./Component").LogicalComponent[]} Components Array of components to generate the key
 * @param {import("./World").World} world
 * @returns {import("./Types").QueryKey}
 * @private
 */
export function queryKey(Components, world) {
  var ids = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];

    if (!componentRegistered(T, world)) {
      throw new Error(`Tried to create a query with an unregistered component`);
    }

    if (typeof T === "object") {
      var operator = T.operator === "not" ? "!" : T.operator;
      ids.push(operator + T.Component._typeId);
    } else {
      ids.push(T._typeId);
    }
  }

  return ids.sort().join("-");
}

// Detector for browser's "window"
export const hasWindow = typeof window !== "undefined";

// performance.now() "polyfill"
export const now =
  hasWindow && typeof window.performance !== "undefined"
    ? performance.now.bind(performance)
    : Date.now.bind(Date);

/**
 * 
 * @param {import("./Component").LogicalComponent} T 
 * @param {import("./World").World} world 
 * @returns 
 */
export function componentRegistered(T, world) {
  var id;
  if (typeof T === "object") {
    id = T.Component._typeId;
  } else {
    id = T._typeId;
  }
  return id && id in world.componentsManager._ComponentsMap;
}
