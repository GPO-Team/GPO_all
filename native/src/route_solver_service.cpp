#include "gpo/route_solver_service.h"

#include "gpo/route_problem.h"
#include "tsp/algorithms.h"

#include <stdexcept>
#include <utility>
#include <cmath>

namespace gpo {
namespace {

tsp::AlgorithmRun run_algorithm(
    const tsp::Problem& problem,
    const std::string& algorithm_key,
    const tsp::AlgorithmParams& params,
    std::uint32_t seed) {
  if (algorithm_key == "ga_tabu") return tsp::run_ga_tabu(problem, params, seed);
  if (algorithm_key == "otshig") return tsp::run_annealing(problem, params, seed);
  if (algorithm_key == "rasseivanie") return tsp::run_scatter_search(problem, params, seed);
  if (algorithm_key == "cuckoo") return tsp::run_cuckoo_search(problem, params, seed);
  throw std::runtime_error("Unknown algorithm key: " + algorithm_key);
}

}  // namespace

SolveOutput solve_route(const SolveConfig& config) {
  if (config.points.size() > kMaxRoutePoints) {
    throw std::runtime_error("At most 768 route points are supported.");
  }
  for (const auto& point : config.points) {
    if (!std::isfinite(point.x) || !std::isfinite(point.y)) {
      throw std::runtime_error("Route coordinates must be finite.");
    }
  }
  if (config.points.empty()) return SolveOutput{};
  if (config.points.size() == 1) {
    return SolveOutput{
        config.task == TaskKind::kTsp,
        0.0,
        {0},
        {config.points[0]},
    };
  }

  if (config.points.size() == 2) {
    const bool closed = config.task == TaskKind::kTsp;
    auto route = config.points;
    if (closed) route.push_back(route.front());
    return SolveOutput{closed, calculate_route_length(route, closed), {0, 1}, route};
  }

  std::vector<int> order;
  bool closed = false;
  if (config.task == TaskKind::kTsp) {
    const tsp::Problem problem = build_euclidean_problem(config.points);
    order = run_algorithm(problem, config.algorithm_key, config.params, config.seed).best.order;
    closed = true;
  } else {
    const AugmentedProblem augmented = build_augmented_problem(config.points, config.task);
    const tsp::AlgorithmRun run = run_algorithm(
        augmented.problem,
        config.algorithm_key,
        config.params,
        config.seed);
    order = extract_open_order_from_augmented_cycle(run.best.order, augmented.dummy_index);
    if (config.task == TaskKind::kShortestRoute) {
      order = orient_fixed_endpoints(
          std::move(order),
          0,
          static_cast<int>(config.points.size()) - 1);
    }
  }

  std::vector<InputPoint> route;
  route.reserve(order.size() + (closed ? 1U : 0U));
  for (int index : order) {
    if (index < 0 || index >= static_cast<int>(config.points.size())) {
      throw std::runtime_error("Solver returned an invalid point index.");
    }
    route.push_back(config.points[index]);
  }
  if (closed && !route.empty()) route.push_back(route.front());

  return SolveOutput{closed, calculate_route_length(route, closed), order, route};
}

}  // namespace gpo
