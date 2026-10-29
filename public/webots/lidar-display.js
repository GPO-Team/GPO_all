// Keep diagnostic cyan frustums out of the dashboard's 3D view.
// The lidar device and incoming range data are unaffected.
export const hideLidarFrustum = Lidar => {
  const applyRendering = Lidar.prototype.applyOptionalRendering;
  Lidar.prototype.applyOptionalRendering = function () {
    return applyRendering.call(this, false);
  };
};
