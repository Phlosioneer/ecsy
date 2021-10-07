import test from "ava";
import { World, Not, Component } from "../../src/index.js";
import { Filter } from "../../src/Filter.js";
import {
  FooComponent,
  BarComponent,
} from "../helpers/components";
import { loggerSetup, setConsole } from "../helpers/loggerSetup.js";

loggerSetup();

test("Invalid filters", (t) => {
    setConsole(t);
    var world = new World();
    world.registerComponent(FooComponent).registerTag("bar");

    // Empty filter
    const filter1 = new Filter([], world);
    const error1 = t.throws(() => filter1.validate());
    t.is(error1.message, "Tried to create a query with no positive components or tags (Not() components don't count)");

    // Filters with just "Not" terms
    const filter2 = new Filter([Not(FooComponent)], world);
    const error2 = t.throws(() => filter2.validate());
    t.is(error2.message, "Tried to create a query with no positive components or tags (Not() components don't count)");

    const filter3 = new Filter([Not("bar")], world);
    const error3 = t.throws(() => filter3.validate());
    t.is(error3.message, "Tried to create a query with no positive components or tags (Not() components don't count)");

    // Filters with unregistered terms
    const filter4 = new Filter([BarComponent], world);
    const error4 = t.throws(() => filter4.validate());
    t.is(error4.message, "Tried to create a query with unregistered components: [BarComponent]");

    const filter5 = new Filter(["Baz"], world);
    const error5 = t.throws(() => filter5.validate());
    t.is(error5.message, "Tried to create a query with unregistered tags: [Baz]");

    const filter6 = new Filter([Not("Baz")], world);
    const error6 = t.throws(() => filter6.validate());
    t.is(error6.message, "Tried to create a query with unregistered tags: [Baz]");

    let otherWorld = new World();
    let otherworldly = otherWorld.registerTag("otherworldly").getTag("otherworldly");
    const filter7 = new Filter([otherworldly], world);
    const error7 = t.throws(() => filter7.validate());
    t.is(error7.message, "Tried to create a query with unregistered tags: [otherworldly]");
});

test("Nested Not", t => {
    setConsole(t);
    var world = new World();

    world.registerComponent(FooComponent);

    let error = t.throws(() => new Filter([Not(Not(FooComponent))], world));
    t.is(error.message, "Nested 'not' operators are not supported.");
});

test("Filter keys are order-independent", t => {
    setConsole(t);

    const world = new World();

    world.registerComponent(FooComponent)
        .registerComponent(BarComponent)
        .registerTag("Lorem")
        .registerTag("Ipsum");

    const tagL = world.getTag("Lorem");
    const tagI = world.getTag("Ipsum");

    const keyFB = new Filter([FooComponent, BarComponent], world).key;
    const keyBF = new Filter([BarComponent, FooComponent], world).key;
    t.is(keyFB, keyBF);

    const keyNFB = new Filter([Not(FooComponent), BarComponent], world).key;
    const keyBNF = new Filter([BarComponent, Not(FooComponent)], world).key;
    t.is(keyNFB, keyBNF);

    const keyLI = new Filter([tagL, tagI], world).key;
    const keyIL = new Filter([tagI, tagL], world).key;
    t.is(keyLI, keyIL);

    const keyNLI = new Filter([Not(tagL), tagI], world).key;
    const keyINL = new Filter([tagI, Not(tagL)], world).key;
    t.is(keyNLI, keyINL);

    const keyFBLI = new Filter([FooComponent, BarComponent, tagL, tagI], world).key;
    const keyILBF = new Filter([tagI, tagL, BarComponent, FooComponent], world).key;
    const keyFLBI = new Filter([FooComponent, tagL, BarComponent, tagI], world).key;
    const keyBLIF = new Filter([BarComponent, tagL, tagI, FooComponent], world).key;
    t.is(keyFBLI, keyILBF);
    t.is(keyILBF, keyFLBI);
    t.is(keyFLBI, keyBLIF);
});

test("Two components with the same name get unique filters", (t) => {
    setConsole(t);
    const world = new World();

    // Create two components that have the same name.
    function createComponentClass() {
        return class TestComponent extends Component {};
    }
    const Component1 = createComponentClass();
    const Component2 = createComponentClass();
    world.registerComponent(Component1);
    world.registerComponent(Component2);
    t.is(Component1.name, Component2.name);

    // Create an entity for each component.
    const entity1 = world.createEntity().addComponent(Component1);
    const entity2 = world.createEntity().addComponent(Component2);

    // Verify that the query system can identify them as unique components.
    const filter1 = new Filter([Component1], world);
    const filter2 = new Filter([Component2], world);

    t.deepEqual(filter1.findAll(), [entity1]);
    t.deepEqual(filter2.findAll(), [entity2]);
});
