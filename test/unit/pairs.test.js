import test from "ava";
import { World } from "../../src/World";
import { System } from "../../src/System";
import { Component } from "../../src/Component";
import {
  createType,
  copyCopyable,
  cloneClonable,
  Types,
} from "../../src/Types";
import { Vector3 } from "../helpers/customtypes";
import {loggerSetup, setConsole} from "../helpers/loggerSetup";

loggerSetup();

test("Create and use pairs", t => {
    setConsole(t);

    let world = new World().registerTag("isChild")
        .registerTag("isParent").registerTag("owesMoney");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();
    
    // Entities start with no pairs
    t.deepEqual(parent.getAllRelations(), []);
    t.deepEqual(parent.getAllRelations(true), []);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.is(parent.getRelation("isChild"), null);
    t.is(parent.getRelation("isChild", true), null);
    t.is(parent.getRemovedRelation("isChild"), null);

    // Basic pair functionality
    let success = parent.addPair("isChild", child1);
    t.deepEqual(parent.getAllRelations(), ["isChild"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.deepEqual(parent.getRelation("isChild"), child1);
    t.deepEqual(parent.getRelation("isChild", true), child1);
    t.is(parent.getRemovedRelation("isChild"), null);
    t.true(success);

    // Pairs can't be duplicated
    success = parent.addPair("isChild", child1);
    t.deepEqual(parent.getAllRelations(), ["isChild"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.deepEqual(parent.getRelation("isChild"), child1);
    t.deepEqual(parent.getRelation("isChild", true), child1);
    t.is(parent.getRemovedRelation("isChild"), null);
    t.false(success);

    // Relations can have multiple entities
    success = parent.addPair("isChild", child2);
    t.deepEqual(parent.getAllRelations(), ["isChild"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isChild", true), [child1, child2]);
    t.is(parent.getRemovedRelation("isChild"), null);
    t.true(success);

    // Entities can have multiple relations
    success = parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isChild", true), [child1, child2]);
    t.is(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getRelation("isParent", true), grandparent);
    t.is(parent.getRemovedRelation("isParent"), null);
    t.true(success);

    // Entities can be attached through multiple relations
    success = parent.addPair("owesMoney", child1);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent", "owesMoney"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild", "isParent", "owesMoney"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isChild", true), [child1, child2]);
    t.is(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getRelation("isParent", true), grandparent);
    t.is(parent.getRemovedRelation("isParent"), null);
    t.deepEqual(parent.getRelation("owesMoney"), child1);
    t.deepEqual(parent.getRelation("owesMoney", true), child1);
    t.is(parent.getRemovedRelation("owesMoney"), null);
    t.true(success);
});

test("Entities can be added to themselves through pairs", t => {
    setConsole(t);

    let world = new World().registerTag("isChild")
        .registerTag("isParent").registerTag("owesMoney");
    let timeTraveller = world.createEntity();

    let success = timeTraveller.addPair("isChild", timeTraveller);
    t.deepEqual(timeTraveller.getAllRelations(), ["isChild"]);
    t.deepEqual(timeTraveller.getAllRelations(true), ["isChild"]);
    t.deepEqual(timeTraveller.getAllRemovedRelations(), []);
    t.deepEqual(timeTraveller.getRelation("isChild"), timeTraveller);
    t.deepEqual(timeTraveller.getRelation("isChild", true), timeTraveller);
    t.is(timeTraveller.getRemovedRelation("isChild"), null);
    t.true(success);
});

test("Removing pairs sync", t => {
    setConsole(t);

    let world = new World().registerTag("isChild").registerTag("isParent");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();

    // Set up the test entity
    parent.addPair("isChild", child1);
    parent.addPair("isChild", child2);
    parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);

    // Test removing a pair
    let success = parent.removePair("isChild", child1, true);
    t.deepEqual(parent.getRelation("isChild"), child2);
    t.deepEqual(parent.getRelation("isChild", true), child2);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.true(success);

    // Double removing a pair does nothing
    success = parent.removePair("isChild", child1, true);
    t.deepEqual(parent.getRelation("isChild"), child2);
    t.deepEqual(parent.getRelation("isChild", true), child2);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getAllRemovedRelations(), []);
    t.false(success);

});

test("Removing entire relations sync", t => {
    setConsole(t);

    let world = new World().registerTag("isChild").registerTag("isParent");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();

    // Set up the test entity
    parent.addPair("isChild", child1);
    parent.addPair("isChild", child2);
    parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);
    
    // Remove an entire relation
    parent.removeRelation("isChild", true);
    t.deepEqual(parent.getRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isChild", true), null);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getRelation("isParent", true), grandparent);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getRemovedRelation("isParent"), null);
    t.deepEqual(parent.getAllRemovedRelations(), []);
});

test("Removing pairs all relations sync", t => {
    setConsole(t);

    let world = new World().registerTag("isChild").registerTag("isParent");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();

    // Set up the test entity
    parent.addPair("isChild", child1);
    parent.addPair("isChild", child2);
    parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);

    // Remove everything
    parent.removeAllPairs(true);
    t.deepEqual(parent.getRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isChild", true), null);
    t.deepEqual(parent.getRelation("isParent"), null);
    t.deepEqual(parent.getRelation("isParent", true), null);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getRemovedRelation("isParent"), null);
    t.deepEqual(parent.getAllRemovedRelations(), []);
});

test("Removing pairs deferred", t => {
    setConsole(t);

    let world = new World().registerTag("isChild").registerTag("isParent");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();

    // Set up the test entity
    parent.addPair("isChild", child1);
    parent.addPair("isChild", child2);
    parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);

    // Test removing a pair
    let success = parent.removePair("isChild", child1);
    t.deepEqual(parent.getRelation("isChild"), child2);
    t.deepEqual(parent.getRelation("isChild", true), [child2, child1]);
    t.deepEqual(parent.getRemovedRelation("isChild"), child1);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRemovedRelations(), ["isChild"]);
    t.true(success);

    // Double removing a deferred pair does nothing
    success = parent.removePair("isChild", child1);
    t.deepEqual(parent.getRelation("isChild"), child2);
    t.deepEqual(parent.getRelation("isChild", true), [child2, child1]);
    t.deepEqual(parent.getRemovedRelation("isChild"), child1);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRemovedRelations(), ["isChild"]);
    t.false(success);

    // Cleanup after deferred removal
    world.entityManager.processDeferredRemoval();
    t.deepEqual(parent.getRelation("isChild"), child2);
    t.deepEqual(parent.getRelation("isChild", true), child2);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRelations(true), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
});

test("Removing entire relations deferred", t => {
    setConsole(t);

    let world = new World().registerTag("isChild").registerTag("isParent");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();

    // Set up the test entity
    parent.addPair("isChild", child1);
    parent.addPair("isChild", child2);
    parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);
    
    // Remove an entire relation
    parent.removeRelation("isChild");
    t.deepEqual(parent.getRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isChild", true), [child2, child1]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getRelation("isParent", true), grandparent);
    t.deepEqual(parent.getRemovedRelation("isChild"), [child2, child1]);
    t.deepEqual(parent.getRemovedRelation("isParent"), null);
    t.deepEqual(parent.getAllRelations(), ["isParent"]);
    t.deepEqual(parent.getAllRelations(true), ["isParent", "isChild"]);
    t.deepEqual(parent.getAllRemovedRelations(), ["isChild"]);

    // Cleanup after deferred removal
    world.entityManager.processDeferredRemoval();
    t.deepEqual(parent.getRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isChild", true), null);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getRelation("isParent", true), grandparent);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getRemovedRelation("isParent"), null);
    t.deepEqual(parent.getAllRelations(), ["isParent"]);
    t.deepEqual(parent.getAllRelations(true), ["isParent"]);
    t.deepEqual(parent.getAllRemovedRelations(), []);
});

test("Removing pairs all relations deferred", t => {
    setConsole(t);

    let world = new World().registerTag("isChild").registerTag("isParent");
    let parent = world.createEntity();
    let child1 = world.createEntity();
    let child2 = world.createEntity();
    let grandparent = world.createEntity();

    // Set up the test entity
    parent.addPair("isChild", child1);
    parent.addPair("isChild", child2);
    parent.addPair("isParent", grandparent);
    t.deepEqual(parent.getRelation("isChild"), [child1, child2]);
    t.deepEqual(parent.getRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), ["isChild", "isParent"]);

    // Remove everything
    parent.removeAllPairs();
    t.deepEqual(parent.getRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isChild", true), [child2, child1]);
    t.deepEqual(parent.getRelation("isParent"), null);
    t.deepEqual(parent.getRelation("isParent", true), grandparent);
    t.deepEqual(parent.getRemovedRelation("isChild"), [child2, child1]);
    t.deepEqual(parent.getRemovedRelation("isParent"), grandparent);
    t.deepEqual(parent.getAllRelations(), []);
    t.deepEqual(parent.getAllRelations(true), ["isChild", "isParent"]);
    t.deepEqual(parent.getAllRemovedRelations(), ["isChild", "isParent"]);

    world.entityManager.processDeferredRemoval();
    t.deepEqual(parent.getRelation("isChild"), null);
    t.deepEqual(parent.getRelation("isChild", true), null);
    t.deepEqual(parent.getRelation("isParent"), null);
    t.deepEqual(parent.getRelation("isParent", true), null);
    t.deepEqual(parent.getRemovedRelation("isChild"), null);
    t.deepEqual(parent.getRemovedRelation("isParent"), null);
    t.deepEqual(parent.getAllRelations(), []);
    t.deepEqual(parent.getAllRelations(true), []);
    t.deepEqual(parent.getAllRemovedRelations(), []);
});
