#pragma once

#include "tsp/common.h"

#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>

namespace gpo {

// Keep in sync with shared/controller-limits.json and the Webots waypoint buffer.
constexpr std::size_t kMaxRoutePoints = 768;

enum class TaskKind {
  kTsp,
  kHamiltonianChain,
  kShortestRoute,
};

struct InputPoint {
  double x = 0.0;
  double y = 0.0;
};

struct SolveConfig {
  std::string algorithm_key;
  TaskKind task = TaskKind::kTsp;
  std::uint32_t seed = 1337U;
  tsp::AlgorithmParams params;
  std::vector<InputPoint> points;
};

struct SolveOutput {
  bool closed = false;
  double length = 0.0;
  std::vector<int> order;
  std::vector<InputPoint> route;
};

}  // namespace gpo
