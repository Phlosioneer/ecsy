module.exports = {
  env: {
    browser: true,
    es6: true
  },
  rules: {
    "no-console": "off"
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 6
  }
};