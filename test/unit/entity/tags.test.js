import test from "ava";
import environment from "../../../src/environment.js";
import { World, Component, Types } from "../../../src/index.js";
import { FooComponent, BarComponent } from "../../helpers/components";
import { loggerSetup, setConsole } from "../../helpers/loggerSetup.js";

loggerSetup();

test("adding/removing tags sync", t => {
    setConsole(t);
    var world = new World();

    world.registerTag("foo").registerTag("bar");
    var fooTag = world.getTag("foo");
    var barTag = world.getTag("bar");

    var entity = world.createEntity();

    t.false(entity.hasAnyTags([fooTag, barTag]));

    // Add a new tag and check that it exists
    entity.addTag("foo");
    t.deepEqual(entity.getTags(), [fooTag]);
    t.true(entity.hasTag("foo"));
    t.false(entity.hasTag("bar"));
    t.false(entity.hasAllTags([fooTag, barTag]));
    t.true(entity.hasAnyTags([fooTag, barTag]));

    // Add a second tag
    entity.addTag("bar");
    t.deepEqual(entity.getTags(), [fooTag, barTag]);
    t.true(entity.hasTag("foo"));
    t.true(entity.hasTag("bar"));
    t.true(entity.hasAllTags([fooTag, barTag]));
    t.true(entity.hasAnyTags([fooTag, barTag]));

    // Double-adding tag doesn't do anything
    entity.addTag("foo");
    t.deepEqual(entity.getTags(), [fooTag, barTag]);

    // Immediate remove
    entity.removeTag("foo", true);
    t.deepEqual(entity.getTags(), [barTag]);
    t.false(entity.hasTag("foo"));
    t.true(entity.hasTag("bar"));

    // Double-removing tag doesn't do anything
    entity.removeTag("foo", true);
    t.deepEqual(entity.getTags(), [barTag]);

    // Re-adding a tag works as expected
    entity.addTag("foo");
    t.deepEqual(entity.getTags(), [barTag, fooTag]);
});

test("Removing tags deferred", t => {
    setConsole(t);
    let world = new World();
  
    world.registerTag("foo").registerTag("bar");
    let fooTag = world.getTag("foo");
    let barTag = world.getTag("bar");
    let entity = world.createEntity();
  
    entity.addTag("foo").addTag("bar");
    t.true(entity.hasTag(fooTag));
    t.true(entity.hasTag(fooTag, true));
    t.true(entity.hasTag(barTag));
    t.false(entity.hasRemovedTag(fooTag));
    t.deepEqual(entity.getTags(), [fooTag, barTag]);
  
    // Remove the tag
    entity.removeTag(fooTag);
    t.false(entity.hasTag(fooTag));
    t.true(entity.hasTag(fooTag, true));
    t.true(entity.hasTag(barTag));
    t.true(entity.hasRemovedTag(fooTag));
    t.deepEqual(entity.getTags(), [barTag]);
  
    // Sync deferred actions
    world.entityManager.processDeferredRemoval();
  
    // No record of the tag on the entity anymore
    t.false(entity.hasTag(fooTag));
    t.false(entity.hasTag(fooTag, true));
    t.true(entity.hasTag(barTag));
    t.false(entity.hasRemovedTag(fooTag));
    t.deepEqual(entity.getTags(), [barTag]);
  });
  
  test("Double adding tag is noop", t => {
    setConsole(t);
  
    let world = new World().registerTag("foo");
    let entity = world.createEntity();
    let fooTag = world.getTag("foo");
  
    // Set up the test entity
    entity.addTag("foo");
    t.deepEqual(entity.getTags(), [fooTag]);
  
    // Add the tag again
    entity.addTag("foo");
    t.deepEqual(entity.getTags(), [fooTag]);
  });
  
  test("Adding tag after deferred removing the tag undoes removal", t => {
    setConsole(t);
  
    let world = new World().registerTag("foo");
    let entity = world.createEntity();
    let fooTag = world.getTag("foo");
  
    // Set up the test entity
    entity.addTag(fooTag);
    t.deepEqual(entity.getTags(), [fooTag]);
  
    // Remove the tag
    entity.removeTag(fooTag);
    t.false(entity.hasTag(fooTag));
    t.true(entity.hasTag(fooTag, true));
    t.true(entity.hasRemovedTag(fooTag));
    t.deepEqual(entity.getTags(), []);
  
    // Re-add the tag before processing deferred removal.
    entity.addTag(fooTag);
    t.true(entity.hasTag(fooTag));
    t.true(entity.hasTag(fooTag, true));
    t.false(entity.hasRemovedTag(fooTag));
    t.deepEqual(entity.getTags(), [fooTag]);
  
    // Process deferred removal.
    world.entityManager.processDeferredRemoval();
  
    // Nothing has changed.
    t.true(entity.hasTag(fooTag));
    t.true(entity.hasTag(fooTag, true));
    t.false(entity.hasRemovedTag(fooTag));
    t.deepEqual(entity.getTags(), [fooTag]);
  });