

export class Tag {
    /**
     * 
     * @param {string} name 
     * @param {number} id 
     * @param {boolean} isRelation
     */
    constructor(name, id, isRelation) {
        /** @type {string} */
        this.name = name;
        /** @type {number} */
        this._id = id;
        /** @type {boolean} */
        this.isRelation = isRelation;
    }
}