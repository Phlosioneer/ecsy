import { System } from "./System.js";
import { now } from "./Utils.js";

export class SystemManager {
  /**
   * 
   * @param {import("./World").World} world 
   */
  constructor(world) {
    /**
     * @type {System[]}
     */
    this._systems = [];
    /**
     * Systems that have `execute` method
     * @type {System[]}
     */
    this._executeSystems = [];
    /**
     * @type {import("./World").World}
     */
    this.world = world;
    /**
     * @type {System?}
     */
    this.lastExecutedSystem = null;
  }

  /**
   * @template {System} S
   * @param {import("./System.js").SystemConstructor<S>} SystemClass 
   * @param {object} [attributes]
   */
  registerSystem(SystemClass, attributes) {
    if (!SystemClass.isSystem) {
      throw new Error(
        `System '${SystemClass.name}' does not extend 'System' class`
      );
    }

    if (this.getSystem(SystemClass) !== undefined) {
      console.warn(`System '${SystemClass.getName()}' already registered.`);
      return this;
    }

    var system = new SystemClass(this.world, attributes);
    if (system.init !== System.prototype.init) {
      system.init(attributes);
    }
    this._systems.push(system);
    if (system.execute !== System.prototype.execute) {
      this._executeSystems.push(system);
      this.sortSystems();
    }
    return this;
  }

  /**
   * @template {System} S
   * @param {import("./System.js").SystemConstructor<S>} SystemClass 
   */
  unregisterSystem(SystemClass) {
    let system = this.getSystem(SystemClass);
    if (system === undefined) {
      console.warn(
        `Can't unregister system '${SystemClass.getName()}'. It doesn't exist.`
      );
      return this;
    }

    this._systems.splice(this._systems.indexOf(system), 1);

    if (system.execute !== System.prototype.execute) {
      this._executeSystems.splice(this._executeSystems.indexOf(system), 1);
    }

    // @todo Add system.unregister() call to free resources
    return this;
  }

  sortSystems() {
    /**
     * @param {System} a 
     * @param {System} b 
     */
    let sortFn = (a, b) => {
      return a.priority - b.priority || this._systems.indexOf(a) - this._systems.indexOf(b);
    };
    sortFn.bind(this);
    this._executeSystems.sort(sortFn);
  }

  /**
   * @template {System} S
   * @param {import("./System.js").SystemConstructor<S>} SystemClass 
   * @returns {S?}
   */
  getSystem(SystemClass) {
    return /** @type {S?} */ (this._systems.find((s) => s instanceof SystemClass));
  }

  getSystems() {
    return this._systems;
  }

  /**
   * 
   * @param {System} system 
   * @param {number} delta 
   * @param {number} time 
   */
  executeSystem(system, delta, time) {
    if (system.initialized) {
      if (system.canExecute()) {
        let startTime = now();
        system.execute(delta, time);
        system.executeTime = now() - startTime;
        this.lastExecutedSystem = system;
        system.clearEvents();
      }
    }
  }

  stop() {
    this._executeSystems.forEach((system) => system.stop());
  }

  /**
   * 
   * @param {number} delta 
   * @param {number} time 
   * @param {boolean} [forcePlay]
   */
  execute(delta, time, forcePlay) {
    this._executeSystems.forEach(
      (system) =>
        (forcePlay || system.enabled) && this.executeSystem(system, delta, time)
    );
  }

  stats() {
    /**
     * @type {{
     *  numSystems: number,
     *  systems: {
     *    [name: string]: {
     *      executeTime: number,
     *      queries: {
     *        [name: string]: ReturnType<import("./Query").Query["stats"]>
     *      }
     *    }
     *  }
     * }}
     */
    var stats = {
      numSystems: this._systems.length,
      systems: {},
    };

    for (var i = 0; i < this._systems.length; i++) {
      var system = this._systems[i];
      var systemStats = (stats.systems[system.getName()] = {
        queries: {},
        executeTime: system.executeTime,
      });
      for (var name in system.queries) {
        systemStats.queries[name] = system._queryObjects[name].stats();
      }
    }

    return stats;
  }
}
