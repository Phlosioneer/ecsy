import test from "ava";
import { World, Not, Component } from "../../src/index.js";
import { Filter } from "../../src/Filter.js";
import {
  FooComponent,
  BarComponent,
} from "../helpers/components";
import { loggerSetup, setConsole } from "../helpers/loggerSetup.js";

loggerSetup();

test("Create and use tags", t => {
  setConsole(t);

  let world = new World();
  
  world.registerTag("foo").registerTag("bar");

  let fooTag = world.getTag("foo");
  let barTag = world.getTag("bar");

  // Stress test creating tags
  for (let i = 0; i < 10; i++) {
      world.createEntity().addTag(fooTag);
      world.createEntity().addTag(barTag);
      world.createEntity().addTag(fooTag).addTag(barTag);
  }

  let fooFilter = new Filter([fooTag], world);
  let barFilter = new Filter([barTag], world);
  let fooBarFilter = new Filter([fooTag, barTag], world);
  let justFooFilter = new Filter([fooTag, Not(barTag)], world);
  let justBarFilter = new Filter([Not(fooTag), barTag], world);
  
  // Check that adding tags worked
  t.is(fooFilter.findAll().length, 20);
  t.is(barFilter.findAll().length, 20);
  t.is(fooBarFilter.findAll().length, 10);
  t.is(justFooFilter.findAll().length, 10);
  t.is(justBarFilter.findAll().length, 10);
});

test("Strings and tags are interchangable", t => {
  setConsole(t);
  
  let world = new World().registerTag("foo");
  let fooTag = world.getTag("foo");

  // Filters convert tags
  let filter1 = new Filter(["foo"], world);
  let filter2 = new Filter([fooTag], world);
  t.deepEqual(filter1, filter2);

  // Entities convert tags
  let entity1 = world.createEntity().addTag("foo");
  let entity2 = world.createEntity().addTag(fooTag);
  t.deepEqual(entity1._tags, entity2._tags);

  // Various function calls work with both
  t.true(world.hasRegisteredTag("foo"));
  t.true(world.hasRegisteredTag(fooTag));
  t.is(world.getTag("foo"), fooTag);
  t.is(world.getTag(fooTag), fooTag);
  t.true(entity1.hasTag("foo"));
  t.true(entity1.hasTag(fooTag));
});

test("Register same tag object to different world", t => {
  setConsole(t);

  let world1 = new World().registerTag("foo");
  let world2 = new World();
  let fooTag = world1.getTag("foo");
  let id = fooTag._id;
  world2.registerTag(fooTag);
  t.true(world2.hasRegisteredTag("foo"));
  t.true(world2.hasRegisteredTag(fooTag));
  t.true(world1.hasRegisteredTag("foo"));
  t.true(world1.hasRegisteredTag(fooTag));
  t.is(fooTag._id, id);
});

test("Can't register two tags with same name", t => {
  setConsole(t);

  // Registering the same tag name twice
  let world1 = new World().registerTag("foo");
  let error1 = t.throws(() => world1.registerTag("foo"));
  t.is(error1.message, "Cannot register a tag with the same name as a registered tag: foo");

  // Registering the same tag object
  let fooTag = world1.getTag("foo");
  let error2 = t.throws(() => world1.registerTag(fooTag));
  t.is(error2.message, "Cannot register a tag with the same name as a registered tag: foo");

  // Registering a tag object from another world where the name is already in use
  let world2 = new World().registerTag("foo");
  let error3 = t.throws(() => world2.registerTag(fooTag));
  t.is(error3.message, "Cannot register a tag with the same name as a registered tag: foo");

  // Registering two different tag objects with the same name
  let bar1 = world1.registerTag("bar").getTag("bar");
  let bar2 = world2.registerTag("bar").getTag("bar");
  let world3 = new World().registerTag(bar1);
  let error4 = t.throws(() => world3.registerTag(bar2));
  t.is(error4.message, "Cannot register a tag with the same name as a registered tag: bar");

});