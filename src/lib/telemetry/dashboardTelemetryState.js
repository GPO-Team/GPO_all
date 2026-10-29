const createMapState = ({ cellSize, mapFile, excelCsvFile, imageFile }) => ({
  cellSize,
  cellCount: 0,
  obstacleCellCount: 0,
  freeCellCount: 0,
  mapFile,
  jsonFile: mapFile,
  excelCsvFile,
  imageFile,
  cells: [],
  freeCells: [],
});

export const INITIAL_TELEMETRY = {
  simulationTime: null,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  navigation: {
    status: "",
    finished: false,
    currentWaypointIndex: 0,
  },
  manipulator: null,
  obstacleTrace: [],
  obstacleMap: createMapState({
    cellSize: 0.06,
    mapFile: "obstacle_map.json",
    excelCsvFile: "obstacle_map.csv",
    imageFile: "obstacle_map.png",
  }),
  cameraMap: createMapState({
    cellSize: 0.1,
    mapFile: "camera_map.json",
    excelCsvFile: "camera_map.csv",
    imageFile: "camera_map.png",
  }),
  perception: {
    lidar: null,
    camera: null,
  },
};
