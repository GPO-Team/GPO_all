import { expect, it } from "vitest";
import { hideLidarFrustum } from "../../../../public/webots/lidar-display.js";

it("suppresses the cyan lidar frustum even when optional rendering is requested", () => {
  class Lidar {
    applyOptionalRendering(enabled) { this.enabled = enabled; }
  }
  hideLidarFrustum(Lidar);
  const lidar = new Lidar();
  lidar.applyOptionalRendering(true);
  expect(lidar.enabled).toBe(false);
});
