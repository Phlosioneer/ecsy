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