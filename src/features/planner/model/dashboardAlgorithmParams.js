import { ALGORITHM_OPTIONS, DEFAULT_PRECISION, getAlgorithmPresetParams } from "../../../lib/routeAlgorithms";

export const createDashboardAlgorithmParams = (precision = DEFAULT_PRECISION) =>
  Object.fromEntries(
    ALGORITHM_OPTIONS.map((option) => [option.key, getAlgorithmPresetParams(option.key, precision)])
  );
