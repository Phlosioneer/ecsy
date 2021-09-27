import { Component } from "../../src/Component";
import { Types } from "../../src/Types";

export class FooComponent extends Component {}

/** @type {number} */
FooComponent.prototype.variableFoo;

FooComponent.schema = {
  variableFoo: { type: Types.Number },
};

export class BarComponent extends Component {}

/** @type {number} */
BarComponent.prototype.variableBar;

BarComponent.schema = {
  variableBar: { type: Types.Number },
};

export class EmptyComponent extends Component {}
