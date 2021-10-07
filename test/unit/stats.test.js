import test from "ava";
import { World, System } from "../../src/index.js";
import { Filter } from "../../src/Filter.js";
import { FooComponent, BarComponent } from "../helpers/components";
import { loggerSetup, setConsole } from "../helpers/loggerSetup.js";

loggerSetup();

test("Stats", async (t) => {
  setConsole(t);
  var world = new World();

  class SystemA extends System {}
  SystemA.queries = {
    compFoo: { components: [FooComponent] },
    compBar: { components: [BarComponent] },
    compBtoh: { components: [FooComponent, BarComponent] },
  };

  world
    .registerComponent(FooComponent)
    .registerComponent(BarComponent)
    .registerSystem(SystemA);

  // Add a new component and check it exist
  for (var i = 0; i < 10; i++) {
    let entity = world.createEntity();
    entity.addComponent(FooComponent);
    if (i > 5) {
      entity.addComponent(BarComponent);
    }
  }

  // Keys are not fixed in an async settings
  const keyF = new Filter([FooComponent], world).key;
  const keyFB = new Filter([FooComponent, BarComponent], world).key;
  const keyB = new Filter([BarComponent], world).key;

  t.deepEqual(world.stats(), {
    entities: {
      numEntities: 10,
      numQueries: 3,
      queries: {
        [keyF]: {
          numComponents: 1,
          numEntities: 10,
        },
        [keyB]: {
          numComponents: 1,
          numEntities: 4,
        },
        [keyFB]: {
          numComponents: 2,
          numEntities: 4,
        },
      },
      numComponentPool: 2,
      componentPool: {
        FooComponent: {
          free: 2,
          used: 10,
          size: 12,
        },
        BarComponent: {
          free: 1,
          used: 4,
          size: 5,
        },
      },
      eventDispatcher: {
        fired: 24,
        handled: 0,
      },
    },
    system: {
      numSystems: 1,
      systems: {
        SystemA: {
          queries: {
            compBar: {
              numComponents: 1,
              numEntities: 4
            },
            compBtoh: {
              numComponents: 2,
              numEntities: 4
            },
            compFoo: {
              numComponents: 1,
              numEntities: 10
            }
          },
          executeTime: 0,
        },
      },
    },
  });
});
