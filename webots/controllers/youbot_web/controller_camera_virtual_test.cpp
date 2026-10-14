#include "controller_camera_virtual.h"

#include <cmath>

#define TEST_EPS 1e-6

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const float ranges[] = {4.5f, 1.0f, 1.1f, 4.5f, 0.6f, 0.65f, 4.5f};
  const ControllerCameraVirtualConfig config = {
      1.2, 1.2, 0.12, 4.5, 1.45, 0.31, 0.42,
  };
  ControllerCameraVirtualCluster clusters[4];
  ControllerCameraVirtualSummary summary;
  controller_camera_virtual_collect(ranges, 7, &config, clusters, 4, &summary);

  if (summary.cluster_count != 2 || summary.total_beams != 7 || summary.close_beams != 4) {
    return 1;
  }
  if (clusters[0].beams != 2 || !nearly_equal(clusters[0].range, 1.0) ||
      !(clusters[0].angle < -0.25 && clusters[0].angle > -0.35)) {
    return 2;
  }
  if (clusters[1].beams != 2 || !nearly_equal(clusters[1].range, 0.6) ||
      !(clusters[1].angle > 0.25 && clusters[1].angle < 0.35)) {
    return 3;
  }

  controller_camera_virtual_sort_by_range_desc(clusters, summary.cluster_count);
  if (!nearly_equal(clusters[0].range, 1.0) || !nearly_equal(clusters[1].range, 0.6)) return 4;

  const ControllerCameraVirtualCluster render_cluster = {0.0, 1.0, 4};
  ControllerCameraVirtualBox box;
  if (!controller_camera_virtual_box(&render_cluster, &config, 100, 100, &box)) return 5;
  if (box.screen_x != 49 || box.bottom_y < 85 || box.bottom_y > 88 ||
      box.width < 37 || box.width > 39 || box.height < 60 || box.height > 62 ||
      !(box.danger > 0.39 && box.danger < 0.40)) {
    return 6;
  }
  const ControllerCameraVirtualObservation observation =
      controller_camera_virtual_observation(&summary, 0.025);
  if (!observation.visible || !nearly_equal(observation.score, 4.0 / 7.0) ||
      observation.detection_count != 4) return 7;
  return 0;
}
