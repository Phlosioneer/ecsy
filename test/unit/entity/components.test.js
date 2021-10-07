import test from "ava";
import environment from "../../../src/environment.js";
import { World, Component, Types } from "../../../src/index.js";
import { FooComponent, BarComponent } from "../../helpers/components";
import { loggerSetup, setConsole } from "../../helpers/loggerSetup.js";

loggerSetup();

test("adding/removing components sync", async (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);
  t.is(entity.getComponentTypes().length, 1);
  t.true(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(
    Object.values(entity._components).map((comp) => comp.constructor),
    [FooComponent]
  );

  // Entity doesn't contain BarComponent
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));

  entity.addComponent(BarComponent);
  t.is(entity.getComponentTypes().length, 2);
  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.true(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(
    Object.values(entity._components).map((comp) => comp.constructor),
    [FooComponent, BarComponent]
  );

  entity.removeComponent(FooComponent, true);
  t.is(entity.getComponentTypes().length, 1);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(
    Object.values(entity._components).map((comp) => comp.constructor),
    [BarComponent]
  );

  entity.addComponent(FooComponent);
  entity.removeAllComponents(true);
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(
    Object.values(entity._components).map((comp) => comp.constructor),
    []
  );
});

test("removing components deferred", async (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);

  entity.removeComponent(FooComponent); // Deferred remove
  t.is(entity.getComponentTypes().length, 0);
  t.true(entity.hasRemovedComponent(FooComponent));
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(
    Object.values(entity._components).map((comp) => comp.constructor),
    []
  );
  t.deepEqual(
    Object.values(entity._componentsToRemove).map(
      (comp) => comp.constructor
    ),
    [FooComponent]
  );

  world.entityManager.processDeferredRemoval();
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.deepEqual(
    Object.values(entity._components).map((comp) => comp.constructor),
    []
  );
});

test("get component: development", async (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  const component = entity.getComponent(FooComponent);

  t.throws(() => (component.variableFoo = 4));

  entity.removeComponent(FooComponent);

  t.is(entity.hasComponent(FooComponent), false);
  t.is(entity.getComponent(FooComponent), undefined);

  const removedComponent = entity.getComponent(FooComponent, true);

  t.throws(() => (removedComponent.variableFoo = 14));
});

test("get component: production", async (t) => {
  setConsole(t);
  const oldEnv = environment.isDev;
  environment.isDev = false;
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  t.log("Calling getComponent");
  const component = entity.getComponent(FooComponent);
  t.log("Call complete");

  t.notThrows(() => (component.variableFoo = 4));

  entity.removeComponent(FooComponent);

  t.is(entity.hasComponent(FooComponent), false);
  t.is(entity.getComponent(FooComponent), undefined);

  const removedComponent = entity.getComponent(FooComponent, true);

  t.notThrows(() => (removedComponent.variableFoo = 14));

  environment.isDev = oldEnv;
});

test("get removed component: development", async (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  entity.removeComponent(FooComponent);

  const component = entity.getRemovedComponent(FooComponent);

  t.throws(() => (component.variableFoo = 4));
});

test("get removed component: production", async (t) => {
  setConsole(t);
  const oldEnv = environment.isDev;
  environment.isDev = false;
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  entity.removeComponent(FooComponent);

  const component = entity.getRemovedComponent(FooComponent);

  t.notThrows(() => (component.variableFoo = 4));

  environment.isDev = oldEnv;
});

test("get mutable component", async (t) => {
  setConsole(t);
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  const component = entity.getMutableComponent(FooComponent);

  t.notThrows(() => (component.variableFoo = 4));

  t.deepEqual(entity.getMutableComponent(BarComponent), undefined);
});