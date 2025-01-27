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

var CustomTypes = {};

CustomTypes.Vector3 = createType({
  name: "Vector3",
  default: new Vector3(),
  copy: copyCopyable,
  clone: cloneClonable,
});

class TestComponent extends Component {}

TestComponent.schema = {
  string: { type: Types.String },
  number: { type: Types.Number },
  boolean: { type: Types.Boolean },
  ref: { type: Types.Ref },
  json: { type: Types.JSON },
  vector3: { type: CustomTypes.Vector3 },
  stringWithDefault: { type: Types.String, default: "test" },
  numberWithDefault: { type: Types.Number, default: 3 },
  booleanWithDefault: { type: Types.Boolean, default: true },
  refWithDefault: {
    type: Types.Ref,
    default: { value: "test ref" },
  },
  jsonWithDefault: { type: Types.JSON, default: { value: "test json" } },
  vector3WithDefault: {
    type: CustomTypes.Vector3,
    default: new Vector3(1, 2, 3),
  },
};

loggerSetup();

test("default values", (t) => {
  setConsole(t);
  /** @type {any} */
  const component = new TestComponent();

  t.is(component.string, "");
  t.is(component.number, 0);
  t.is(component.boolean, false);
  t.is(component.ref, undefined);
  t.is(component.json, null);
  t.true(new Vector3().equals(component.vector3));
  t.is(component.stringWithDefault, "test");
  t.is(component.numberWithDefault, 3);
  t.is(component.booleanWithDefault, true);
  t.deepEqual(component.refWithDefault, { value: "test ref" });
  t.is(component.refWithDefault, TestComponent.schema.refWithDefault.default);
  t.deepEqual(component.jsonWithDefault, { value: "test json" });
  t.not(
    component.jsonWithDefault,
    TestComponent.schema.jsonWithDefault.default
  );
  t.true(new Vector3(1, 2, 3).equals(component.vector3WithDefault));
});

test("copy component", (t) => {
  setConsole(t);
  /** @type {any} */
  const srcComponent = new TestComponent();
  srcComponent.string = "abc";
  srcComponent.number = 1;
  srcComponent.boolean = true;
  srcComponent.ref = { value: "test 1" };
  srcComponent.json = { value: "test 2" };
  srcComponent.vector3.set(4, 5, 6);
  srcComponent.stringWithDefault = "test 3";
  srcComponent.numberWithDefault = 2;
  srcComponent.booleanWithDefault = false;
  srcComponent.refWithDefault = { value: "test 4" };
  srcComponent.jsonWithDefault = { value: "test 5" };
  srcComponent.vector3WithDefault.set(7, 8, 9);

  /** @type {any} */
  const destComponent = new TestComponent();
  destComponent.copy(srcComponent);

  t.is(destComponent.string, "abc");
  t.is(destComponent.number, 1);
  t.is(destComponent.boolean, true);
  t.is(destComponent.ref.value, "test 1");
  t.is(destComponent.json.value, "test 2");
  t.true(new Vector3(4, 5, 6).equals(destComponent.vector3));
  t.is(destComponent.stringWithDefault, "test 3");
  t.is(destComponent.numberWithDefault, 2);
  t.is(destComponent.booleanWithDefault, false);
  t.is(destComponent.refWithDefault.value, "test 4");
  t.is(destComponent.jsonWithDefault.value, "test 5");
  t.true(new Vector3(7, 8, 9).equals(destComponent.vector3WithDefault));
});

test("clone component", (t) => {
  setConsole(t);
  /** @type {any} */
  const srcComponent = new TestComponent();
  srcComponent.string = "abc";
  srcComponent.number = 1;
  srcComponent.boolean = true;
  srcComponent.ref = { value: "test 1" };
  srcComponent.json = { value: "test 2" };
  srcComponent.vector3.set(4, 5, 6);
  srcComponent.stringWithDefault = "test 3";
  srcComponent.numberWithDefault = 2;
  srcComponent.booleanWithDefault = false;
  srcComponent.refWithDefault = { value: "test 4" };
  srcComponent.jsonWithDefault = { value: "test 5" };
  srcComponent.vector3WithDefault.set(7, 8, 9);

  const destComponent = srcComponent.clone();

  t.is(destComponent.string, "abc");
  t.is(destComponent.number, 1);
  t.is(destComponent.boolean, true);
  t.is(destComponent.ref.value, "test 1");
  t.is(destComponent.json.value, "test 2");
  t.true(new Vector3(4, 5, 6).equals(destComponent.vector3));
  t.is(destComponent.stringWithDefault, "test 3");
  t.is(destComponent.numberWithDefault, 2);
  t.is(destComponent.booleanWithDefault, false);
  t.is(destComponent.refWithDefault.value, "test 4");
  t.is(destComponent.jsonWithDefault.value, "test 5");
  t.true(new Vector3(7, 8, 9).equals(destComponent.vector3WithDefault));
});

test("unique type ids", (t) => {
  setConsole(t);
  class ComponentA extends Component {}
  class ComponentB extends Component {}

  t.assert(ComponentA._typeId === undefined);
  t.assert(ComponentB._typeId === undefined);

  let world = new World();
  world.registerComponent(ComponentA).registerComponent(ComponentB);

  t.assert(ComponentA._typeId !== undefined);
  t.assert(ComponentB._typeId !== undefined);

  // Verify unique between components.
  t.not(ComponentA._typeId, ComponentB._typeId);

  // Verify multiple calls return the same id.
  t.is(ComponentA._typeId, ComponentA._typeId);
});

test("registering components before systems", (t) => {
  setConsole(t);
  class ComponentA extends Component {}
  class ComponentB extends Component {}

  class SystemA extends System {}
  SystemA.queries = { S: { components: [ComponentA, ComponentB] } };

  let world = new World();

  const error1 = t.throws(() => {
    world.registerSystem(SystemA);
  });
  t.is(
    error1.message,
    "Tried to create a query \"SystemA.S\" with unregistered components: [ComponentA, ComponentB]"
  );

  world.registerComponent(ComponentA);

  const error2 = t.throws(() => {
    world.registerSystem(SystemA);
  });
  t.is(
    error2.message,
    "Tried to create a query \"SystemA.S\" with unregistered components: [ComponentB]"
  );
});
