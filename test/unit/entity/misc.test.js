import test from "ava";
import { World, Component, Types } from "../../../src/index.js";
import { loggerSetup, setConsole } from "../../helpers/loggerSetup.js";

loggerSetup();

/**
 * TODO
 * - IDs
 */


// Component with no constructor
class BazComponent extends Component {}

/** @type {string} */
BazComponent.prototype.spam;

BazComponent.schema = {
  spam: { type: Types.String },
};

test("clearing pooled components", async (t) => {
  setConsole(t);
  var world, entity;

  world = new World();
  world.registerComponent(BazComponent);
  entity = world.createEntity();
  entity.addComponent(BazComponent, { spam: "eggs" });
  t.is(
    entity.getComponent(BazComponent).spam,
    "eggs",
    "property should be taken from addComponent args"
  );

  entity.remove();
  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(BazComponent);

  t.is(
    entity.getComponent(BazComponent).spam,
    "",
    "property should be cleared since it is not specified in addComponent args"
  );

  // Component with constructor that sets property

  class PimComponent extends Component {
    constructor(props) {
      super(props);
      this.spam = props && props.spam !== undefined ? props.spam : "bacon";
    }
  }

  world = new World();

  world.registerComponent(PimComponent, false);

  entity = world.createEntity();
  entity.addComponent(PimComponent, { spam: "eggs" });
  t.is(
    entity.getComponent(PimComponent).spam,
    "eggs",
    "property value should be taken from addComponent args"
  );

  entity.remove();
  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(PimComponent);

  t.is(
    entity.getComponent(PimComponent).spam,
    "bacon",
    "property should be reset to value initialized in constructor"
  );

  world = new World();

  world.registerComponent(PimComponent, false);

  entity = world.createEntity();
  entity.addComponent(PimComponent, { spam: "eggs" });

  entity.remove();
  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(PimComponent, { spam: null });

  t.is(
    entity.getComponent(PimComponent).spam,
    null,
    "property value should be taken from addComponent args"
  );
});


test("remove entity", async (t) => {
  setConsole(t);
  var world = new World();

  // Sync
  world.createEntity().remove(true);
  t.is(world.entityManager.count(), 0);

  // Deferred
  world.createEntity().remove();
  t.is(world.entityManager.count(), 1);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager.count(), 0);
});

test("Delete entity from entitiesByNames", async (t) => {
  setConsole(t);
  var world = new World();

  // Sync
  let entityA = world.createEntity("entityA");
  let entityB = world.createEntity("entityB");

  t.deepEqual(
    { entityA: entityA, entityB: entityB },
    world.entityManager._entitiesByNames
  );

  // Immediate remove
  entityA.remove(true);

  t.deepEqual({ entityB: entityB }, world.entityManager._entitiesByNames);

  // Deferred remove
  entityB.remove();

  t.deepEqual({ entityB: entityB }, world.entityManager._entitiesByNames);
  world.execute(); // Deferred remove happens

  t.deepEqual({}, world.entityManager._entitiesByNames);
});
