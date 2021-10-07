/**
 * @template {import("./Component").Component} C
 * @typedef {(new(...args: any[]) => C) &
 *  typeof import("./Component").Component
 * } ComponentConstructor
 */

/**
 * @typedef {ComponentConstructor<any> | NotTerm |
 *  (import("./Tag").Tag | string)} QueryTerm
 */

/**
 * @typedef {{
 *  components: ComponentConstructor<any>[],
 *  tags: import("./Tag").Tag[],
 *  notComponents: ComponentConstructor<any>[],
 *  notTags: import("./Tag").Tag[]
 * }} ParsedQueryTerms
 */

/**
 * @typedef {{
 *  operator: "not",
 *  innerTerm: QueryTerm
 * }} NotTerm
 */

/**
 * @typedef {{
 *  components: QueryTerm[],
 *  listen?: {
 *    added?: boolean,
 *    removed?: boolean,
 *    changed?: boolean | ComponentConstructor<any>[]
 *  },
 *  mandatory?: boolean,
 * }} QueryDef
 */

export {}