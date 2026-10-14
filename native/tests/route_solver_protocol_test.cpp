#include "gpo/route_solver_protocol.h"

#include <cassert>
#include <sstream>
#include <stdexcept>
#include <string>

int main() {
  std::istringstream input(
      "task shortest_route\n"
      "algorithm ga_tabu\n"
      "seed 42\n"
      "params 30 0.25 200 0.12 1.5\n"
      "count 2\n"
      "1.5 2.5\n"
      "3.5 4.5\n");
  const gpo::SolveConfig config = gpo::read_solve_config(input);
  assert(config.task == gpo::TaskKind::kShortestRoute);
  assert(config.algorithm_key == "ga_tabu");
  assert(config.seed == 42U);
  assert(config.points.size() == 2U);
  assert(config.points[0].x == 1.5);

  std::ostringstream success;
  gpo::write_solve_success(success, gpo::SolveOutput{false, 2.5, {0, 1}, {{1, 2}, {3, 4}}});
  assert(success.str() ==
      "status ok\nclosed 0\nlength 2.500000\norder 0 1\nroute_count 2\n"
      "1.000000 2.000000\n3.000000 4.000000\n");

  std::ostringstream failure;
  gpo::write_solve_error(failure, "bad input");
  assert(failure.str() == "status error\nmessage bad input\n");

  try {
    std::istringstream invalid("task unknown\n");
    (void)gpo::read_solve_config(invalid);
    assert(false);
  } catch (const std::runtime_error& error) {
    assert(std::string(error.what()) == "Unknown task key: unknown");
  }
  try {
    std::istringstream oversized("task tsp\nalgorithm ga_tabu\nseed 42\nparams 30 0.25 200 0.12 1.5\ncount 769\n");
    (void)gpo::read_solve_config(oversized);
    assert(false);
  } catch (const std::runtime_error& error) {
    assert(std::string(error.what()) == "At most 768 route points are supported.");
  }
}
