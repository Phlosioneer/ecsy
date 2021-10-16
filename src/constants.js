/**
 * @enum {string}
 */
export const QueryEvents = {
  added: "Query#ENTITY_ADDED",
  removed: "Query#ENTITY_REMOVED",
  changed: "Query#COMPONENT_CHANGED",
};

/**
 * @enum {string}
 */
export const EntityEvents = {
  created: "EntityManager#ENTITY_CREATE",
  removed: "EntityManager#ENTITY_REMOVED",
  componentAdded: "EntityManager#COMPONENT_ADDED",
  componentRemoved: "EntityManager#COMPONENT_REMOVE",
  tagAdded: "EntityManager#TAG_ADDED",
  tagRemoved: "EntityManager#TAG_REMOVE",
  pairAdded: "EntityManager#PAIR_ADDED",
  pairRemoved: "EntityManager#PAIR_REMOVE"
};

/**
 * @template {import("./Component").Component} C
 * @typedef {(new(...args: any[]) => C) &
 *  typeof import("./Component").Component
 * } ComponentConstructor
 */

/**
 * @typedef {ComponentConstructor<any> | NotTerm |
 *  (import("./Tag").Tag | string)} QueryTerm
 */

/**
 * @typedef {{
 *  components: ComponentConstructor<any>[],
 *  tags: import("./Tag").Tag[],
 *  notComponents: ComponentConstructor<any>[],
 *  notTags: import("./Tag").Tag[]
 * }} ParsedQueryTerms
 */

/**
 * @typedef {{
 *  operator: "not",
 *  innerTerm: QueryTerm
 * }} NotTerm
 */

/**
 * @typedef {{
 *  components: QueryTerm[],
 *  listen?: {
 *    added?: boolean,
 *    removed?: boolean,
 *    changed?: boolean | ComponentConstructor<any>[]
 *  },
 *  mandatory?: boolean,
 * }} QueryDef
 */
