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

const DEFAULT_GA_TABU_PARAMS = {
  population_size: 90,
  generations: 260,
  mutation_rate: 0.18,
  crossover_rate: 0.9,
  tabu_iterations: 24,
};

const DEFAULT_ANNEALING_PARAMS = {
  pool_size: 48,
  max_iterations: 5000,
  minimum_temperature: 0.001,
  cooling_rate: 0.996,
  neighborhood_strength: 2.5,
};

const DEFAULT_SCATTER_PARAMS = {
  population_size: 70,
  refset_ratio: 0.18,
  max_iterations: 130,
  mutation_rate: 0.2,
  local_steps: 8,
};

const DEFAULT_CUCKOO_PARAMS = {
  nests: 30,
  discovery_probability: 0.25,
  max_iterations: 200,
  alpha: 0.12,
  beta: 1.5,
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
    defaults: DEFAULT_GA_TABU_PARAMS,
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
    defaults: DEFAULT_ANNEALING_PARAMS,
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
    defaults: DEFAULT_SCATTER_PARAMS,
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
    defaults: DEFAULT_CUCKOO_PARAMS,
  },
};

export const ALGORITHM_OPTIONS = Object.values(ALGORITHMS).map((item) => ({
  key: item.key,
  label: item.label,
}));

export const getAlgorithmLabel = (key) => ALGORITHMS[key]?.label || ALGORITHMS.ga_tabu.label;

export const getAlgorithmFields = (key) => ALGORITHMS[key]?.fields || ALGORITHMS.ga_tabu.fields;

export const getDefaultAlgorithmParams = (key) => ({
  ...(ALGORITHMS[key]?.defaults || ALGORITHMS.ga_tabu.defaults),
});

