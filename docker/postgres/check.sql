-- Run with psql -v ON_ERROR_STOP=1. All test data is rolled back.
BEGIN;
DO $$
DECLARE
  test_user integer;
  test_group integer;
  test_scenario integer;
  test_zone integer;
  test_route integer;
BEGIN
  IF (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') <> 16 THEN
    RAISE EXCEPTION 'Expected 16 application tables';
  END IF;

  INSERT INTO users (username, email, password_hash, role_id)
    VALUES ('db_check_' || txid_current(), 'db_check_' || txid_current() || '@example.com', 'test-only',
      (SELECT id FROM roles WHERE code = 'group_leader')) RETURNING id INTO test_user;
  INSERT INTO user_groups (name, leader_id) VALUES ('Database check', test_user) RETURNING id INTO test_group;
  UPDATE users SET group_id = test_group WHERE id = test_user;
  INSERT INTO scenarios (user_id, group_id, name) VALUES (test_user, test_group, 'Database check') RETURNING id INTO test_scenario;
  INSERT INTO visit_points (scenario_id, x, y, order_index) VALUES (test_scenario, -21.5, 16.5, 0);
  INSERT INTO limit_zones (scenario_id, name) VALUES (test_scenario, 'Obstacle') RETURNING id INTO test_zone;
  INSERT INTO zone_polygon_points (zone_id, x, y, point_order) VALUES (test_zone, 0, 0, 0);
  INSERT INTO charging_stations (scenario_id, x, y, name, capacity_kwh) VALUES (test_scenario, 0, 0, 'Charger', 1);
  INSERT INTO routes (scenario_id, user_id, algorithm, total_distance)
    VALUES (test_scenario, test_user, 'ga_tabu', 1) RETURNING id INTO test_route;
  INSERT INTO route_waypoints (route_id, x, y, heading_deg, order_index) VALUES (test_route, 0, 0, 359.99, 0);
  INSERT INTO telemetry_logs (route_id, robot_x, robot_y, robot_yaw, battery_level) VALUES (test_route, -25, 20, 0, 100);
  INSERT INTO audit_log (user_id, entity_type, entity_id, action) VALUES (test_user, 'route', test_route, 'created');
  INSERT INTO lidar_files (scenario_id, route_id, file_name, storage_key, file_size_bytes, format, captured_at)
    VALUES (test_scenario, test_route, 'test.pcd', 'test.pcd', 0, 'pcd', CURRENT_TIMESTAMP);
  INSERT INTO maps (scenario_id, route_id, name, map_type, storage_key, generated_at)
    VALUES (test_scenario, test_route, 'Map', 'point_cloud', 'test.pcd', CURRENT_TIMESTAMP);

  BEGIN
    INSERT INTO visit_points (scenario_id, x, y, order_index) VALUES (test_scenario, 22, 0, 1);
    RAISE EXCEPTION 'Coordinate CHECK did not reject out-of-range value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO visit_points (scenario_id, x, y, order_index) VALUES (test_scenario, 0, 0, 0);
    RAISE EXCEPTION 'Duplicate order was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM scenarios WHERE id = test_scenario;
    RAISE EXCEPTION 'Foreign keys allowed deleting a referenced scenario';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE users SET email = 'invalid email' WHERE id = test_user;
    RAISE EXCEPTION 'Email CHECK accepted invalid value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE telemetry_logs SET battery_level = 101 WHERE route_id = test_route;
    RAISE EXCEPTION 'Battery CHECK accepted invalid value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'Database smoke check passed';
END;
$$;
ROLLBACK;
