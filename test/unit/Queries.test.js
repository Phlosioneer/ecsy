import test from "ava";
import { World, System, Not, Component } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";
import { loggerSetup, setConsole } from "../helpers/loggerSetup.js";

loggerSetup();

function queriesLength(queries) {
  let result = {};
  Object.entries(queries).forEach((q) => {
    const name = q[0];
    const values = q[1];
    result[name] = values.length;
  });

  return result;
}

test("Reactive queries with Not operator", (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  // System 1
  class SystemTest extends System {
    execute() {}
  }

  SystemTest.queries = {
    normal: {
      components: [FooComponent, BarComponent],
      listen: {
        added: true,
        changed: true,
        removed: true,
      },
    },
    not: {
      components: [FooComponent, Not(BarComponent)],
      listen: {
        added: true,
        changed: true,
        removed: true,
      },
    },
  };

  // Register empty system
  world.registerSystem(SystemTest);

  let system = world.systemManager.getSystem(SystemTest);

  // Both queries starts empty
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  t.deepEqual(queriesLength(system.queries.not), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  //
  let entity = world.createEntity().addComponent(FooComponent);

  // It doesn't match the `BarComponent`
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  // It matches the `Not(BarComponent)`
  t.deepEqual(queriesLength(system.queries.not), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });

  // clean up reactive queries
  world.execute();

  entity.addComponent(BarComponent);

  // It matches the `BarComponent`
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });

  // It does not match `Not(BarComponent)` so it's being removed
  t.deepEqual(queriesLength(system.queries.not), {
    added: 0,
    changed: 0,
    removed: 1,
    results: 0,
  });

  // clean up
  world.execute();
  entity.removeComponent(BarComponent);

  // It doesn't match `BarComponent` anymore, so it's being removed
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 1,
    results: 0,
  });

  // It does match `Not(BarComponent)` so it's being added
  t.deepEqual(queriesLength(system.queries.not), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });
});

test("Entity living just within the frame", (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent);

  // System 1
  class SystemTest extends System {
    execute() {}
  }

  SystemTest.queries = {
    normal: {
      components: [FooComponent],
      listen: {
        added: true,
        changed: true,
        removed: true,
      },
    },
  };

  // Register empty system
  world.registerSystem(SystemTest);

  let system = world.systemManager.getSystem(SystemTest);
  let query = system.queries.normal;

  // Query starts empty
  t.deepEqual(queriesLength(query), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  let entity = world.createEntity().addComponent(FooComponent);

  // Adding `FooComponent` on frame #0 it's added and matches the results query too
  t.deepEqual(queriesLength(query), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });

  let addedEntity = query.added[0];
  let resultEntity = query.results[0];

  t.true(addedEntity.getComponent(FooComponent) !== undefined);
  t.true(resultEntity.getComponent(FooComponent) !== undefined);

  entity.removeComponent(FooComponent);

  // After removing the component on the same frame #0, it's still in the `added` list
  // added also to the `remove` list, but removed from the `results`
  t.deepEqual(queriesLength(query), {
    added: 1,
    changed: 0,
    removed: 1,
    results: 0,
  });

  addedEntity = query.added[0];
  let removedEntity = query.removed[0];

  // As the component has been removed, `getComponent` won't return it
  t.true(removedEntity.getComponent(FooComponent) === undefined);

  // But both, `getComponent(_, true)` or `getRemovedComponent` will success
  t.true(removedEntity.getComponent(FooComponent, true) !== undefined);
  t.true(removedEntity.getRemovedComponent(FooComponent) !== undefined);

  // The entity has been removed from the query so `getComponent` won't return it either
  t.true(addedEntity.getComponent(FooComponent) === undefined);

  // Advance 1 frame
  world.execute();

  // Now it's not available anymore as it was purged
  t.deepEqual(queriesLength(query), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });
});

class ComponentSystemTest extends System {
  execute() {}
}

ComponentSystemTest.queries = {
  normal: {
    components: [FooComponent, BarComponent],
    listen: {
      added: true,
      changed: true,
      removed: true,
    },
  }
};

test("Reactive queries: Components: Adding", t => {
  setConsole(t);

  var world = new World()
    .registerComponent(FooComponent)
    .registerComponent(BarComponent)
    .registerSystem(ComponentSystemTest);
  let system = world.getSystem(ComponentSystemTest);

  // Query starts empty
  t.deepEqual(system.queries.normal, {
    added: [], changed: [],
    removed: [], results: [],
  });

  // Just adding one of the two components doesn't do anything
  let entity = world.createEntity().addComponent(FooComponent);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [],
    removed: [], results: [],
  });

  // Add the other component
  entity.addComponent(BarComponent);
  t.deepEqual(system.queries.normal, {
    added: [entity], changed: [],
    removed: [], results: [entity],
  });

  // Cleanup the system
  system.clearEvents();
  t.deepEqual(system.queries.normal, {
    added: [], changed: [],
    removed: [], results: [entity],
  });
});

test("Reactive queries: Components: Removing", t => {
  setConsole(t);

  var world = new World()
    .registerComponent(FooComponent)
    .registerComponent(BarComponent)
    .registerSystem(ComponentSystemTest);
  let system = world.getSystem(ComponentSystemTest);
  let prefab = () => world.createEntity()
  .addComponent(FooComponent)
  .addComponent(BarComponent);
  let entity1 = prefab();
  let entity2 = prefab();
  let entity3 = prefab();
  let entity4 = prefab();
  let entity5 = prefab();
  let entity6 = prefab();
  system.clearEvents();

  t.deepEqual(system.queries.normal, {
    added: [], changed: [], removed: [],
    results: [entity1, entity2, entity3, entity4, entity5, entity6]
  });

  // Removing one of the components
  entity1.removeComponent(FooComponent);
  entity2.removeComponent(FooComponent, true);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [], removed: [entity1, entity2],
    results: [entity3, entity4, entity5, entity6]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();

  // Removing again doesn't change anything
  entity1.removeComponent(BarComponent);
  entity2.removeComponent(BarComponent, true);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [], removed: [],
    results: [entity3, entity4, entity5, entity6]
  });
  world.entityManager.processDeferredRemoval();

  // Removing all the components
  entity3.removeAllComponents();
  entity4.removeAllComponents(true);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [], removed: [entity3, entity4],
    results: [entity5, entity6]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
  
  // Removing the entities. Note, in the immediate case, this is UNSAFE!
  // TODO: Added, Changed, and Removed should use EntityRef, not entity
  entity5.remove();
  entity6.remove(true);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [], removed: [entity5, entity6],
    results: []
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
});

test("Reactive queries: Components: Changing", t => {
  setConsole(t);

  var world = new World()
    .registerComponent(FooComponent)
    .registerComponent(BarComponent)
    .registerSystem(ComponentSystemTest);
  let system = world.getSystem(ComponentSystemTest);
  let entity = world.createEntity().addComponent(FooComponent);
  
  // Modifying something not in the queue doesn't change anything.
  entity.getMutableComponent(FooComponent);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [],
    removed: [], results: [],
  });

  entity.addComponent(BarComponent);
  system.clearEvents();

  // Modifying something marks the component as changed
  entity.getMutableComponent(FooComponent);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [entity],
    removed: [], results: [entity],
  });

  // Changing again doesn't double-up the changed queue
  entity.getMutableComponent(FooComponent);
  t.deepEqual(system.queries.normal, {
    added: [], changed: [entity],
    removed: [], results: [entity]
  });
});

test("Reactive queries: Doubling-up removals", t => {
  setConsole(t);

  class DoubleUpSystemTest extends System {
    execute() {}
  }

  DoubleUpSystemTest.queries = {
    comp: {
      components: [FooComponent],
      listen: {
        added: true,
        changed: true,
        removed: true,
      },
    },
    tag: {
      components: ["foo"],
      listen: {
        added: true,
        removed: true,
      },
    },
    pair: {
      components: ["bar"],
      listen: {
        added: true,
        removed: true,
      },
    }
  };

  var world = new World()
    .registerComponent(FooComponent)
    .registerTag("foo")
    .registerRelation("bar")
    .registerSystem(DoubleUpSystemTest);
  let system = world.getSystem(DoubleUpSystemTest);
  let immediate = world.createEntity();
  let deferred = world.createEntity();

  // Adding, removing, and re-adding, and re-removing doesn't create double entries
  immediate.addComponent(FooComponent)
    .removeComponent(FooComponent, true)
    .addComponent(FooComponent)
    .removeComponent(FooComponent, true);
  deferred.addComponent(FooComponent)
    .removeComponent(FooComponent)
    .addComponent(FooComponent)
    .removeComponent(FooComponent);
  t.deepEqual(system.queries.comp, {
    added: [immediate, deferred], changed: [],
    removed: [immediate, deferred], results: []
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();

  immediate.addTag("foo")
    .removeTag("foo", true)
    .addTag("foo")
    .removeTag("foo", true);
  deferred.addTag("foo")
    .removeTag("foo")
    .addTag("foo")
    .removeTag("foo");
  t.deepEqual(system.queries.tag, {
    added: [immediate, deferred],
    removed: [immediate, deferred], results: []
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();

  let relEntity = world.createEntity();
  immediate.addPair("bar", relEntity);
  immediate.removePair("bar", relEntity, true);
  immediate.addPair("bar", relEntity);
  immediate.removePair("bar", relEntity, true);
  deferred.addPair("bar", relEntity);
  deferred.removePair("bar", relEntity);
  deferred.addPair("bar", relEntity);
  deferred.removePair("bar", relEntity);
  t.deepEqual(system.queries.pair, {
    added: [immediate, deferred],
    removed: [immediate, deferred], results: []
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
});

class TagSystemTest extends System {
  execute() {}
}

TagSystemTest.queries = {
  normal: {
    components: ["foo", "bar"],
    listen: {
      added: true,
      removed: true
    }
  }
};

test("Reactive queries: Tags: Adding", t => {
  setConsole(t);

  var world = new World()
    .registerTag("foo")
    .registerTag("bar")
    .registerSystem(TagSystemTest);
  let system = world.getSystem(TagSystemTest);

  // Query starts empty
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [],
  });

  // Just adding one of the two components doesn't do anything
  let entity = world.createEntity().addTag("foo");
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [],
  });

  // Add the other component
  entity.addTag("bar");
  t.deepEqual(system.queries.normal, {
    added: [entity], removed: [], results: [entity],
  });

  // Cleanup the system
  system.clearEvents();
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [entity],
  });
});

test("Reactive queries: Tags: Removing", t => {
  setConsole(t);

  var world = new World()
    .registerTag("foo")
    .registerTag("bar")
    .registerSystem(TagSystemTest);
  let system = world.getSystem(TagSystemTest);
  let prefab = () => world.createEntity().addTag("foo").addTag("bar");
  let entity1 = prefab();
  let entity2 = prefab();
  let entity3 = prefab();
  let entity4 = prefab();
  let entity5 = prefab();
  let entity6 = prefab();
  system.clearEvents();

  t.deepEqual(system.queries.normal, {
    added: [], removed: [],
    results: [entity1, entity2, entity3, entity4, entity5, entity6]
  });

  // Removing one of the components
  entity1.removeTag("foo");
  entity2.removeTag("foo", true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [entity1, entity2],
    results: [entity3, entity4, entity5, entity6]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();

  // Removing again doesn't change anything
  entity1.removeTag("bar");
  entity2.removeTag("bar", true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [],
    results: [entity3, entity4, entity5, entity6]
  });
  world.entityManager.processDeferredRemoval();

  // Removing all the components
  entity3.removeAllTags();
  entity4.removeAllTags(true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [entity3, entity4],
    results: [entity5, entity6]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
  
  // Removing the entities. Note, in the immediate case, this is UNSAFE!
  // TODO: Added, Changed, and Removed should use EntityRef, not entity
  entity5.remove();
  entity6.remove(true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [entity5, entity6],
    results: []
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
});

class PairSystemTest extends System {
  execute() {}
}

PairSystemTest.queries = {
  normal: {
    components: ["foo", "bar"],
    listen: {
      added: true,
      removed: true
    }
  }
};

test("Reactive queries: Pairs: Adding", t => {
  setConsole(t);

  var world = new World()
    .registerRelation("foo")
    .registerRelation("bar")
    .registerSystem(PairSystemTest);
  let system = world.getSystem(PairSystemTest);
  let relEntity = world.createEntity();

  // Query starts empty
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [],
  });

  // Just adding one of the two pairs doesn't do anything
  let entity = world.createEntity();
  entity.addPair("foo", relEntity);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [],
  });

  // Add the other pair
  entity.addPair("bar", relEntity);
  t.deepEqual(system.queries.normal, {
    added: [entity], removed: [], results: [entity],
  });
  system.clearEvents();

  // Cleanup the system
  system.clearEvents();
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [entity],
  });

  // Adding another copy of the same pair doesn't trigger any events
  let otherRelEntity = world.createEntity();
  entity.addPair("bar", otherRelEntity);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [entity]
  });
});

test("Reactive queries: Pairs: Removing", t => {
  setConsole(t);

  var world = new World()
    .registerRelation("foo")
    .registerRelation("bar")
    .registerSystem(PairSystemTest);
  let system = world.getSystem(PairSystemTest);
  let relEntity = world.createEntity();
  let prefab = () => {
    let ret = world.createEntity();
    ret.addPair("foo", relEntity);
    ret.addPair("bar", relEntity);
    return ret;
  };
  let entity1 = prefab();
  let entity2 = prefab();
  let entity3 = prefab();
  let entity4 = prefab();
  let entity5 = prefab();
  let entity6 = prefab();
  system.clearEvents();

  t.deepEqual(system.queries.normal, {
    added: [], removed: [],
    results: [entity1, entity2, entity3, entity4, entity5, entity6]
  });

  // Removing one of the components
  entity1.removePair("foo", relEntity);
  entity2.removePair("foo", relEntity, true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [entity1, entity2],
    results: [entity3, entity4, entity5, entity6]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();

  // Removing again doesn't change anything
  entity1.removePair("bar", relEntity);
  entity2.removePair("bar", relEntity, true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [],
    results: [entity3, entity4, entity5, entity6]
  });
  world.entityManager.processDeferredRemoval();

  // Removing all the components
  entity3.removeAllPairs();
  entity4.removeAllPairs(true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [entity3, entity4],
    results: [entity5, entity6]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
  
  // Removing the entities. Note, in the immediate case, this is UNSAFE!
  // TODO: Added, Changed, and Removed should use EntityRef, not entity
  entity5.remove();
  entity6.remove(true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [entity5, entity6],
    results: []
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();

  let entity7 = prefab();
  let entity8 = prefab();
  let otherRelEntity = world.createEntity();
  entity7.addPair("foo", otherRelEntity);
  entity8.addPair("foo", otherRelEntity);
  system.clearEvents();
  
  // Removing another copy of a pair doesn't trigger any events
  entity7.removePair("foo", otherRelEntity);
  entity8.removePair("bar", otherRelEntity, true);
  t.deepEqual(system.queries.normal, {
    added: [], removed: [], results: [entity7, entity8]
  });
  system.clearEvents();
  world.entityManager.processDeferredRemoval();
});

test.skip("Reactive queries: Not", t => {
  t.fail();
});