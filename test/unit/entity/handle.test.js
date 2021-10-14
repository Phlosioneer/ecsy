
import test from "ava";
import { EntityHandle } from "../../../src/EntityHandle.js";
import { World, Not, Component } from "../../../src/index.js";
import { loggerSetup, setConsole } from "../../helpers/loggerSetup.js";

loggerSetup();

test("Entity handle creation", t => {
  setConsole(t);

  let world = new World().registerTag("foo").registerTag("bar");
  let fooTag = world.getTag("foo");
  let barTag = world.getTag("bar");

  let entity1 = world.createEntity().addTag("foo");
  let handle = entity1.getHandle();
  
  t.true(handle instanceof EntityHandle);
  t.is(handle.deref, entity1);
  t.is(handle.id, entity1.id);
  t.deepEqual(handle.getTags(), [fooTag]);
  handle.addTag("bar");
  t.deepEqual(entity1.getTags(), [fooTag, barTag]);
});

test("Handle stops working when entity removed", t => {
  setConsole(t);

  let world = new World().registerTag("foo").registerTag("bar");
  let fooTag = world.getTag("foo");
  let barTag = world.getTag("bar");

  let entity1 = world.createEntity().addTag("foo");
  let handle1 = entity1.getHandle();

  t.true(handle1.alive);
  t.deepEqual(handle1.getTags(), [fooTag]);
  let oldId = entity1.id;
  t.is(handle1.id, oldId);

  // Delete the entity
  entity1.remove(true);
  t.false(handle1.alive);
  t.is(handle1.id, oldId);
  let error1 = t.throws(() => handle1.deref);
  t.is(error1.message, "Handle cannot be dereferenced: Entity { id: 0} is dead");
  let error2 = t.throws(() => handle1.getTags());
  t.is(error2.message, "Cannot access property \"getTags\": Entity { id: 0} is dead");

  // Reuse the entity via object pool
  let entity2 = world.createEntity().addTag("bar");
  t.is(entity1, entity2);

  // Old handle hasn't changed
  t.false(handle1.alive);
  t.is(handle1.id, oldId);
  t.throws(() => handle1.deref);
  t.throws(() => handle1.getTags());
  
  // New handle is different and tracks new entity as usual
  let handle2 = entity2.getHandle();
  t.not(handle1, handle2);
  t.true(handle2.alive);
  t.is(handle2.deref, entity2);
  t.deepEqual(handle2.getTags(), [barTag]);
});