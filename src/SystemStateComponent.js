import { Component } from "./Component.js";

/**
 * Components that extend the SystemStateComponent are not removed when an
 * entity is deleted.
 */
export class SystemStateComponent extends Component {}

/**
 * @type {true}
 */
SystemStateComponent.isSystemStateComponent = true;
