import test from "ava";
import { Component, World } from "../../src";
import { loggerSetup, setConsole } from "../helpers/loggerSetup";

loggerSetup();

test("check for unregistered components", (t) => {
  setConsole(t);
  const world = new World();
  const testEntity = world.createEntity();
  class MyComponent extends Component {}

  // Component not registered to any world
  const err =  t.throws(() => testEntity.addComponent(MyComponent));
  t.is(err.message, "Attempted to add unregistered component \"MyComponent\"");

  // Component registered to a world, but not this one
  const world2 = new World();
  world2.registerComponent(MyComponent);
  const err2 = t.throws(() => testEntity.addComponent(MyComponent));
  t.is(err2.message, "Attempted to add unregistered component \"MyComponent\"");
});

test("entity id", (t) => {
  setConsole(t);
  var world = new World();

  for (var i = 0; i < 10; i++) {
    world.createEntity();
  }

  t.is(world.entityManager.count(), 10);

  // @todo Check ids
});

test("deferred entity remove", (t) => {
  setConsole(t);
  var world = new World();

  for (let i = 0; i < 10; i++) {
    world.createEntity();
  }

  // Force remove
  let i = 5;
  while (i-- > 0) {
    world.entityManager._entities[i].remove(true);
  }

  t.is(world.entityManager.count(), 5);
  t.is(world.entityManager.entitiesToRemove.length, 0);

  // Deferred remove
  i = 5;
  while (i-- > 0) {
    world.entityManager._entities[i].remove();
  }

  t.is(world.entityManager.count(), 5);
  t.is(world.entityManager.entitiesToRemove.length, 5);

  world.entityManager.processDeferredRemoval();

  t.is(world.entityManager.count(), 0);
  t.is(world.entityManager.entitiesToRemove.length, 0);
});

test("remove entity clears and reset components first ", (t) => {
  setConsole(t);
  class MyComponent extends Component {
    constructor() {
      super();
      this.isReset = false;
    }
    dispose() {
      this.isReset = true;
      super.dispose();
    }
  }
  const world = new World();
  world.registerComponent(MyComponent, false);

  let entity = world.createEntity();
  entity.addComponent(MyComponent);

  let component = entity.getComponent(MyComponent);
  t.is(component.isReset, false);

  // Deletes component immeditatly.
  entity.remove(true);
  t.is(component.isReset, true);

  // Deletes component is a deferred manner.

  entity = world.createEntity();
  entity.addComponent(MyComponent);
  component = entity.getComponent(MyComponent);
  t.is(component.isReset, false);

  entity.remove();
  world.entityManager.processDeferredRemoval();
  t.is(component.isReset, true);
});

test("double deferred remove throws error", t => {
  setConsole(t);

  let world = new World();
  for (let i = 0; i < 10; i++) {
    world.createEntity();
  }
  let testEntity = world.createEntity();
  for (let i = 0; i < 10; i++) {
    world.createEntity();
  }
  let entities = world.entityManager._entities;

  t.is(entities.length, 21);
  testEntity.remove();
  let error = t.throws(() => testEntity.remove());
  t.is(error.message, "Tried to remove entity not in list");
  
});

test("double immediate remove throws error", t => {
  setConsole(t);

  let world = new World();
  for (let i = 0; i < 10; i++) {
    world.createEntity();
  }
  let testEntity = world.createEntity();
  for (let i = 0; i < 10; i++) {
    world.createEntity();
  }
  let entities = world.entityManager._entities;

  t.is(entities.length, 21);
  testEntity.remove(true);
  let error = t.throws(() => testEntity.remove(true));
  t.is(error.message, "Tried to remove entity not in list");
  
})