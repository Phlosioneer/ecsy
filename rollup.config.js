
// Matches import(...).
let jsDocImportRegex = /import\([^)]*\)\./g;

let jsDocFixer = {
  name: "js-doc-fixer",
  /** @type {(code: string, id: string) => {code: string, map: null}} */
  transform: (code, id) => {
    return {
      code: code.replaceAll(jsDocImportRegex, ""),
      map: null
    };
  }
};

export default [
  {
    input: "src/index.js",
    output: [
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "build/ecsy.js",
        indent: "\t"
      },
      {
        format: "es",
        file: "build/ecsy.module.js",
        indent: "\t"
      }
    ],
    plugins: [jsDocFixer],
    treeshake: false
  },
  
];

