
/**
 * @template T
 * @typedef {(
 *  dispatcher: EventDispatcher,
 *  eventName: string,
 *  entity: import("./Entity").Entity?,
 *  data: T?
 * ) => void} EventListener<T>
 */

/**
 * @template T The extra data that might be included in an event
 */
export default class EventDispatcher {
  constructor() {
    /**
     * @type {{ [eventName: string]: EventListener<T>[] }}
     */
    this._listeners = {};

    /**
     * @type {{ fired: number, handled: number }}
     */
    this.stats = {
      fired: 0,
      handled: 0,
    };
  }

  /**
   * Add an event listener
   * @param {String} eventName Name of the event to listen
   * @param {EventListener<T>} listener Callback to trigger when the event is fired
   */
  addEventListener(eventName, listener) {
    let listeners = this._listeners;
    if (listeners[eventName] === undefined) {
      listeners[eventName] = [];
    }

    if (listeners[eventName].indexOf(listener) === -1) {
      listeners[eventName].push(listener);
    }
  }

  /**
   * Check if an event listener is already added to the list of listeners
   * @param {String} eventName Name of the event to check
   * @param {EventListener<T>} listener Callback for the specified event
   */
  hasEventListener(eventName, listener) {
    return (
      this._listeners[eventName] !== undefined &&
      this._listeners[eventName].indexOf(listener) !== -1
    );
  }

  /**
   * Remove an event listener
   * @param {String} eventName Name of the event to remove
   * @param {EventListener<T>} listener Callback for the specified event
   */
  removeEventListener(eventName, listener) {
    var listenerArray = this._listeners[eventName];
    if (listenerArray !== undefined) {
      var index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }

  /**
   * Dispatch an event
   * @param {String} eventName Name of the event to dispatch
   * @param {import("./Entity").Entity} [entity] (Optional) Entity to emit
   * @param {T} [data]
   */
  dispatchEvent(eventName, entity, data) {
    this.stats.fired++;

    var listenerArray = this._listeners[eventName];
    let wasHandled = false;
    if (listenerArray !== undefined) {
      // Make a copy of the array, to prevent mutation by listeners (such as
      // listeners removing themselves)
      var array = listenerArray.slice(0);

      for (var i = 0; i < array.length; i++) {
        array[i](this, eventName, entity, data);
        wasHandled = true;
      }
    }
    if (wasHandled) {
      this.stats.handled++;
    }
  }

  /**
   * Reset stats counters
   */
  resetCounters() {
    this.stats.fired = this.stats.handled = 0;
  }
}
