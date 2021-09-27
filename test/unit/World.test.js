import test from "ava";
import { World, Component } from "../../src/index.js";
import {
    FooComponent,
    BarComponent,
    EmptyComponent,
} from "../helpers/components";
import { loggerSetup, setConsole } from "../helpers/loggerSetup.js";

loggerSetup();

test.serial("Multiple worlds with same components", t => {
    setConsole(t);

    let w1 = new World();
    // Register foo first, then bar
    w1.registerComponent(FooComponent).registerComponent(BarComponent);

    let entity1F = w1.createEntity().addComponent(FooComponent, { variableFoo: 1 });
    
    let entity1FB = w1.createEntity()
        .addComponent(FooComponent, { variableFoo: 2 })
        .addComponent(BarComponent, { variableBar: 3 });

    let entity1B = w1.createEntity().addComponent(BarComponent, { variableBar: 4 });

    let w2 = new World();
    // Register bar first, then foo
    w2.registerComponent(BarComponent).registerComponent(FooComponent);

    let entity2F = w2.createEntity().addComponent(FooComponent, { variableFoo: 5 });

    let entity2FB = w2.createEntity()
        .addComponent(FooComponent, { variableFoo: 6 })
        .addComponent(BarComponent, { variableBar: 7 });
    
    let entity2B = w2.createEntity().addComponent(BarComponent, { variableBar: 8});

    t.true(w1.hasRegisteredComponent(FooComponent));
    t.true(w1.hasRegisteredComponent(BarComponent));
    t.true(w2.hasRegisteredComponent(FooComponent));
    t.true(w2.hasRegisteredComponent(BarComponent));
    
    t.true(entity1F.hasComponent(FooComponent));
    t.true(entity1FB.hasComponent(FooComponent));
    t.false(entity1B.hasComponent(FooComponent));
    t.true(entity2F.hasComponent(FooComponent));
    t.true(entity2FB.hasComponent(FooComponent));
    t.false(entity2B.hasComponent(FooComponent));
    
    t.false(entity1F.hasComponent(BarComponent));
    t.true(entity1FB.hasComponent(BarComponent));
    t.true(entity1B.hasComponent(BarComponent));
    t.false(entity2F.hasComponent(BarComponent));
    t.true(entity2FB.hasComponent(BarComponent));
    t.true(entity2B.hasComponent(BarComponent));

    t.is(entity1F.getComponent(FooComponent).variableFoo, 1);
    t.is(entity1FB.getComponent(FooComponent).variableFoo, 2);
    t.is(entity1FB.getComponent(BarComponent).variableBar, 3);
    t.is(entity1B.getComponent(BarComponent).variableBar, 4);
    t.is(entity2F.getComponent(FooComponent).variableFoo, 5);
    t.is(entity2FB.getComponent(FooComponent).variableFoo, 6);
    t.is(entity2FB.getComponent(BarComponent).variableBar, 7);
    t.is(entity2B.getComponent(BarComponent).variableBar, 8);
});