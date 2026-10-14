const numberNormalization = require("./number-normalization.cjs");
const solverValidation = require("./solver-validation.cjs");
const routeValidation = require("./route-validation.cjs");
const mappingValidation = require("./mapping-validation.cjs");
const transferValidation = require("./transfer-validation.cjs");

module.exports = {
  ...numberNormalization,
  ...solverValidation,
  ...routeValidation,
  ...mappingValidation,
  ...transferValidation,
};
