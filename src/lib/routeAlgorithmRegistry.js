const TASKS = {
  tsp: {
    key: "tsp",
    label: "Коммивояжер",
  },
  hamiltonian_chain: {
    key: "hamiltonian_chain",
    label: "Гамильтонова цепь",
  },
  shortest_route: {
    key: "shortest_route",
    label: "Кратчайший маршрут",
  },
};

export const TASK_OPTIONS = Object.values(TASKS).map((item) => ({
  key: item.key,
  label: item.label,
}));

export const getTaskLabel = (taskKey) => TASKS[taskKey]?.label || TASKS.tsp.label;

export const PRECISION_OPTIONS = [
  { key: "low", label: "Малая", hint: "Быстрый черновой расчёт" },
  { key: "medium", label: "Средняя", hint: "Баланс скорости и длины маршрута" },
  { key: "high", label: "Большая", hint: "Самый короткий маршрут, расчёт дольше" },
];

export const DEFAULT_PRECISION = "medium";

const GA_TABU_PRESETS = {
  low: { population_size: 40, generations: 80, mutation_rate: 0.2, crossover_rate: 0.85, tabu_iterations: 10 },
  medium: { population_size: 90, generations: 260, mutation_rate: 0.18, crossover_rate: 0.9, tabu_iterations: 24 },
  high: { population_size: 140, generations: 500, mutation_rate: 0.15, crossover_rate: 0.92, tabu_iterations: 40 },
};

const ANNEALING_PRESETS = {
  low: { pool_size: 24, max_iterations: 1500, minimum_temperature: 0.01, cooling_rate: 0.99, neighborhood_strength: 2 },
  medium: { pool_size: 48, max_iterations: 5000, minimum_temperature: 0.001, cooling_rate: 0.996, neighborhood_strength: 2.5 },
  high: { pool_size: 64, max_iterations: 15000, minimum_temperature: 0.0005, cooling_rate: 0.998, neighborhood_strength: 3 },
};

const SCATTER_PRESETS = {
  low: { population_size: 40, refset_ratio: 0.2, max_iterations: 50, mutation_rate: 0.2, local_steps: 5 },
  medium: { population_size: 70, refset_ratio: 0.18, max_iterations: 130, mutation_rate: 0.2, local_steps: 8 },
  high: { population_size: 110, refset_ratio: 0.15, max_iterations: 250, mutation_rate: 0.18, local_steps: 12 },
};

const CUCKOO_PRESETS = {
  low: { nests: 15, discovery_probability: 0.25, max_iterations: 80, alpha: 0.12, beta: 1.5 },
  medium: { nests: 30, discovery_probability: 0.25, max_iterations: 200, alpha: 0.12, beta: 1.5 },
  high: { nests: 45, discovery_probability: 0.25, max_iterations: 450, alpha: 0.12, beta: 1.5 },
};

const ALGORITHMS = {
  ga_tabu: {
    key: "ga_tabu",
    label: "GA + Tabu",
    fields: [
      {
        key: "population_size",
        label: "Размер популяции",
        min: 8,
        max: 1200,
        step: 1,
        integer: true,
      },
      {
        key: "generations",
        label: "Поколения",
        min: 1,
        max: 10000,
        step: 1,
        integer: true,
      },
      {
        key: "mutation_rate",
        label: "Вероятность мутации",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "crossover_rate",
        label: "Вероятность скрещивания",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "tabu_iterations",
        label: "Шагов Tabu",
        min: 1,
        max: 80,
        step: 1,
        integer: true,
      },
    ],
    presets: GA_TABU_PRESETS,
  },
  otshig: {
    key: "otshig",
    label: "Имитация отжига",
    fields: [
      {
        key: "pool_size",
        label: "Стартовых решений",
        min: 8,
        max: 200,
        step: 1,
        integer: true,
      },
      {
        key: "max_iterations",
        label: "Максимум итераций",
        min: 1,
        max: 200000,
        step: 1,
        integer: true,
      },
      {
        key: "minimum_temperature",
        label: "Минимальная температура",
        min: 0.000001,
        max: 1,
        step: 0.0001,
      },
      {
        key: "cooling_rate",
        label: "Коэффициент охлаждения",
        min: 0.9,
        max: 0.99999,
        step: 0.0001,
      },
      {
        key: "neighborhood_strength",
        label: "Сила окрестности",
        min: 1,
        max: 12,
        step: 0.1,
      },
    ],
    presets: ANNEALING_PRESETS,
  },
  rasseivanie: {
    key: "rasseivanie",
    label: "Алгоритм рассеивания",
    fields: [
      {
        key: "population_size",
        label: "Размер популяции",
        min: 10,
        max: 1200,
        step: 1,
        integer: true,
      },
      {
        key: "refset_ratio",
        label: "Доля RefSet",
        min: 0.05,
        max: 0.5,
        step: 0.01,
      },
      {
        key: "max_iterations",
        label: "Максимум итераций",
        min: 1,
        max: 3000,
        step: 1,
        integer: true,
      },
      {
        key: "mutation_rate",
        label: "Вероятность мутации",
        min: 0,
        max: 0.5,
        step: 0.01,
      },
      {
        key: "local_steps",
        label: "Локальных шагов",
        min: 2,
        max: 30,
        step: 1,
        integer: true,
      },
    ],
    presets: SCATTER_PRESETS,
  },
  cuckoo: {
    key: "cuckoo",
    label: "Метод кукушки",
    fields: [
      {
        key: "nests",
        label: "Количество гнезд",
        min: 5,
        max: 250,
        step: 1,
        integer: true,
      },
      {
        key: "discovery_probability",
        label: "Вероятность обнаружения p_a",
        min: 0.01,
        max: 0.9,
        step: 0.01,
      },
      {
        key: "max_iterations",
        label: "Максимум итераций",
        min: 1,
        max: 5000,
        step: 1,
        integer: true,
      },
      {
        key: "alpha",
        label: "Шаг Леви alpha",
        min: 0.001,
        max: 2,
        step: 0.01,
      },
      {
        key: "beta",
        label: "Параметр Леви beta",
        min: 1.1,
        max: 1.99,
        step: 0.01,
      },
    ],
    presets: CUCKOO_PRESETS,
  },
};

export const ALGORITHM_OPTIONS = Object.values(ALGORITHMS).map((item) => ({
  key: item.key,
  label: item.label,
}));

export const getAlgorithmLabel = (key) => ALGORITHMS[key]?.label || ALGORITHMS.ga_tabu.label;

export const getAlgorithmFields = (key) => ALGORITHMS[key]?.fields || ALGORITHMS.ga_tabu.fields;

const getAlgorithmPresets = (key) => (ALGORITHMS[key] || ALGORITHMS.ga_tabu).presets;

export const getAlgorithmPresetParams = (key, precision = DEFAULT_PRECISION) => {
  const presets = getAlgorithmPresets(key);
  return { ...(presets[precision] || presets[DEFAULT_PRECISION]) };
};

export const getDefaultAlgorithmParams = (key) => getAlgorithmPresetParams(key, DEFAULT_PRECISION);

export const getAlgorithmPrecision = (key, params) => {
  const presets = getAlgorithmPresets(key);
  return PRECISION_OPTIONS.find(({ key: level }) =>
    Object.entries(presets[level]).every(([field, value]) => params?.[field] === value))?.key || null;
};
