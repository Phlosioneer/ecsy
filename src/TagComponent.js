import { Component } from "./Component.js";

/**
 * Create components that extend TagComponent in order to take advantage of performance optimizations for components
 * that do not store data
 */
export class TagComponent extends Component {
  constructor() {
    super(false);
  }
}

/**
 * @type {true}
 */
TagComponent.isTagComponent = true;
