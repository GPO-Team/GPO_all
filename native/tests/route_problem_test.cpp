#include "gpo/route_problem.h"

#include <cassert>
#include <vector>
#include <stdexcept>

int main() {
  const std::vector<gpo::InputPoint> points{{0, 0}, {3, 4}};
  const tsp::Problem euclidean = gpo::build_euclidean_problem(points);
  assert(euclidean.distance_matrix[0][1] == 5000);
  assert(euclidean.distance_matrix[1][0] == 5000);

  const gpo::AugmentedProblem augmented =
      gpo::build_augmented_problem(points, gpo::TaskKind::kShortestRoute);
  assert(augmented.dummy_index == 2);
  assert(augmented.problem.distance_matrix[2][0] == 0);
  assert(augmented.problem.distance_matrix[2][1] == 0);

  assert((gpo::extract_open_order_from_augmented_cycle({2, 1, 0}, 2) ==
      std::vector<int>{1, 0}));
  assert((gpo::orient_fixed_endpoints({1, 0}, 0, 1) == std::vector<int>{0, 1}));
  assert(gpo::calculate_route_length(points, false) == 5.0);
  bool rejected = false;
  try { (void)gpo::build_euclidean_problem({{0, 0}, {1e100, 0}}); }
  catch (const std::runtime_error&) { rejected = true; }
  assert(rejected);
}
