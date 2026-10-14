#include "gpo/route_solver_protocol.h"

#include <cctype>
#include <iomanip>
#include <istream>
#include <ostream>
#include <sstream>
#include <stdexcept>

namespace gpo {
namespace {

std::string trim(const std::string& value) {
  std::size_t start = 0;
  while (start < value.size() &&
         std::isspace(static_cast<unsigned char>(value[start]))) {
    ++start;
  }

  std::size_t end = value.size();
  while (end > start && std::isspace(static_cast<unsigned char>(value[end - 1]))) {
    --end;
  }
  return value.substr(start, end - start);
}

TaskKind parse_task(const std::string& value) {
  if (value == "tsp") return TaskKind::kTsp;
  if (value == "hamiltonian_chain") return TaskKind::kHamiltonianChain;
  if (value == "shortest_route") return TaskKind::kShortestRoute;
  throw std::runtime_error("Unknown task key: " + value);
}

}  // namespace

SolveConfig read_solve_config(std::istream& input) {
  SolveConfig config;
  std::string line;
  const auto read_required_line = [&input, &line]() {
    if (!std::getline(input, line)) throw std::runtime_error("Unexpected end of input.");
    line = trim(line);
    if (line.empty()) throw std::runtime_error("Encountered an empty input line.");
  };

  read_required_line();
  {
    std::istringstream stream(line);
    std::string key;
    std::string value;
    stream >> key >> value;
    if (key != "task" || value.empty()) throw std::runtime_error("Expected: task <taskKey>");
    config.task = parse_task(value);
  }

  read_required_line();
  {
    std::istringstream stream(line);
    std::string key;
    stream >> key >> config.algorithm_key;
    if (key != "algorithm" || config.algorithm_key.empty()) {
      throw std::runtime_error("Expected: algorithm <algorithmKey>");
    }
  }

  read_required_line();
  {
    std::istringstream stream(line);
    std::string key;
    stream >> key >> config.seed;
    if (key != "seed" || stream.fail()) throw std::runtime_error("Expected: seed <uint32>");
  }

  read_required_line();
  {
    std::istringstream stream(line);
    std::string key;
    stream >> key >> config.params.nests >> config.params.pa >> config.params.max_iter >>
        config.params.alpha >> config.params.beta;
    if (key != "params" || stream.fail()) {
      throw std::runtime_error("Expected: params <nests> <pa> <max_iter> <alpha> <beta>");
    }
  }

  int count = 0;
  read_required_line();
  {
    std::istringstream stream(line);
    std::string key;
    stream >> key >> count;
    if (key != "count" || stream.fail() || count < 0) {
      throw std::runtime_error("Expected: count <non-negative integer>");
    }
  }

  if (static_cast<std::size_t>(count) > kMaxRoutePoints) {
    throw std::runtime_error("At most 768 route points are supported.");
  }
  config.points.reserve(static_cast<std::size_t>(count));
  for (int index = 0; index < count; ++index) {
    read_required_line();
    std::istringstream point_stream(line);
    InputPoint point;
    point_stream >> point.x >> point.y;
    if (point_stream.fail()) throw std::runtime_error("Expected point line: <x> <y>");
    config.points.push_back(point);
  }
  return config;
}

void write_solve_success(std::ostream& output, const SolveOutput& result) {
  output << std::fixed << std::setprecision(6);
  output << "status ok\n";
  output << "closed " << (result.closed ? 1 : 0) << "\n";
  output << "length " << result.length << "\n";
  output << "order";
  for (int index : result.order) output << " " << index;
  output << "\n";
  output << "route_count " << result.route.size() << "\n";
  for (const InputPoint& point : result.route) output << point.x << " " << point.y << "\n";
}

void write_solve_error(std::ostream& output, const std::string& message) {
  output << "status error\n";
  output << "message " << message << "\n";
}

}  // namespace gpo
