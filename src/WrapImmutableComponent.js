
/**
 * @type {WeakMap<import("./Component").Component, Proxy<import("./Component").Component>>}
 */
const proxyMap = new WeakMap();

/** @type {ProxyHandler<any>} */
const proxyHandler = {
  set(target, prop) {
    throw new Error(
      `Tried to write to "${target.constructor.getName()}#${String(
        prop
      )}" on immutable component. Use .getMutableComponent() to modify a component.`
    );
  },
};

/**
 * Returns a Proxy<C> that does not allow the modification of any fields.
 * 
 * @template {import("./Component").Component} C
 * @param {import("./Typedefs").ComponentConstructor<C>} T
 * @param {C} component
 * @returns {C}
 */
export default function wrapImmutableComponent(T, component) {
  if (component === undefined) {
    return undefined;
  }

  let wrappedComponent = proxyMap.get(component);

  if (!wrappedComponent) {
    wrappedComponent = new Proxy(component, proxyHandler);
    proxyMap.set(component, wrappedComponent);
  }

  return /** @type {C} */ ( /** @type {any} */ (wrappedComponent));
}
