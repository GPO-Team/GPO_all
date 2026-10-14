#include "gpo/route_problem.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <limits>

namespace gpo {
namespace {

constexpr int kMetricScale = 1000;
constexpr int kPenaltyDistance = 100000000;

int scaled_distance(const InputPoint& left, const InputPoint& right) {
  const double dx = left.x - right.x;
  const double dy = left.y - right.y;
  const double scaled = std::hypot(dx, dy) * static_cast<double>(kMetricScale);
  if (!std::isfinite(scaled) || scaled > std::numeric_limits<int>::max()) {
    throw std::runtime_error("Point distance exceeds the supported integer metric.");
  }
  return static_cast<int>(std::llround(scaled));
}

}  // namespace

double calculate_route_length(const std::vector<InputPoint>& route, bool closed) {
  if (route.size() <= 1) return 0.0;

  double total = 0.0;
  const std::size_t edge_count = closed ? route.size() : route.size() - 1;
  for (std::size_t index = 0; index < edge_count; ++index) {
    const std::size_t next = (index + 1) % route.size();
    const double dx = route[index].x - route[next].x;
    const double dy = route[index].y - route[next].y;
    total += std::hypot(dx, dy);
  }
  return total;
}

std::vector<int> extract_open_order_from_augmented_cycle(
    const std::vector<int>& cycle_order,
    int dummy_index) {
  const auto it = std::find(cycle_order.begin(), cycle_order.end(), dummy_index);
  if (it == cycle_order.end()) {
    throw std::runtime_error("Dummy node not found in solver output.");
  }

  const int dummy_pos = static_cast<int>(std::distance(cycle_order.begin(), it));
  std::vector<int> order;
  order.reserve(cycle_order.size() - 1);
  for (int offset = 1; offset < static_cast<int>(cycle_order.size()); ++offset) {
    const int value = cycle_order[(dummy_pos + offset) % static_cast<int>(cycle_order.size())];
    if (value != dummy_index) order.push_back(value);
  }
  return order;
}

std::vector<int> orient_fixed_endpoints(
    std::vector<int> order,
    int start_node,
    int end_node) {
  if (order.empty()) return order;
  if (order.front() == start_node && order.back() == end_node) return order;

  std::reverse(order.begin(), order.end());
  if (order.front() == start_node && order.back() == end_node) return order;
  throw std::runtime_error("Unable to orient fixed-endpoint route.");
}

tsp::Problem build_euclidean_problem(const std::vector<InputPoint>& points) {
  tsp::Problem problem;
  problem.name = "gpo";
  problem.cities.reserve(points.size());
  for (int index = 0; index < static_cast<int>(points.size()); ++index) {
    problem.cities.push_back(tsp::City{index, points[index].x, points[index].y});
  }

  problem.distance_matrix.assign(points.size(), std::vector<int>(points.size(), 0));
  for (int left = 0; left < static_cast<int>(points.size()); ++left) {
    for (int right = left + 1; right < static_cast<int>(points.size()); ++right) {
      const int distance = scaled_distance(points[left], points[right]);
      problem.distance_matrix[left][right] = distance;
      problem.distance_matrix[right][left] = distance;
    }
  }
  return problem;
}

AugmentedProblem build_augmented_problem(
    const std::vector<InputPoint>& points,
    TaskKind task) {
  AugmentedProblem augmented;
  augmented.problem = build_euclidean_problem(points);
  augmented.dummy_index = static_cast<int>(augmented.problem.cities.size());
  augmented.problem.cities.push_back(tsp::City{augmented.dummy_index, 0.0, 0.0});

  for (std::vector<int>& row : augmented.problem.distance_matrix) {
    row.push_back(kPenaltyDistance);
  }
  augmented.problem.distance_matrix.push_back(
      std::vector<int>(augmented.dummy_index + 1, kPenaltyDistance));
  augmented.problem.distance_matrix[augmented.dummy_index][augmented.dummy_index] = 0;

  if (task == TaskKind::kHamiltonianChain) {
    for (int node = 0; node < augmented.dummy_index; ++node) {
      augmented.problem.distance_matrix[augmented.dummy_index][node] = 0;
      augmented.problem.distance_matrix[node][augmented.dummy_index] = 0;
    }
  } else if (task == TaskKind::kShortestRoute) {
    if (augmented.dummy_index < 2) {
      throw std::runtime_error("Shortest-route task requires at least two points.");
    }
    const int end_node = augmented.dummy_index - 1;
    augmented.problem.distance_matrix[augmented.dummy_index][0] = 0;
    augmented.problem.distance_matrix[0][augmented.dummy_index] = 0;
    augmented.problem.distance_matrix[augmented.dummy_index][end_node] = 0;
    augmented.problem.distance_matrix[end_node][augmented.dummy_index] = 0;
  }

  return augmented;
}

}  // namespace gpo
