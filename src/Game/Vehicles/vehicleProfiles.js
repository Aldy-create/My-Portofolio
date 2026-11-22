export const VEHICLE_PROFILES = Object.freeze([
  { id: 'buggy', label: 'Trail Buggy', short: 'Buggy', kind: 'car', paint: '#ef604c', topSpeed: 20, engineForce: 430, steering: 0.56, controls: 'WASD drive · Shift boost · Space jump · B brake' },
  { id: 'excavator', label: 'Excavator', short: 'Excavator', kind: 'excavator', paint: '#f2ae28', topSpeed: 7.5, engineForce: 420, steering: 0.82, controls: 'W/S tracks · A/D steer · Q/E turret 360° · I/K boom · J/L or Space scoop/dump' },
  { id: 'dump-truck', label: 'Dump Truck', short: 'Dump Truck', kind: 'truck', paint: '#e67e22', topSpeed: 10.5, engineForce: 450, steering: 0.46, controls: 'WASD drive · Space tilt/dump bed · B brake' },
  { id: 'bulldozer', label: 'Bulldozer', short: 'Bulldozer', kind: 'dozer', paint: '#e3ad29', topSpeed: 8.5, engineForce: 470, steering: 0.54, controls: 'WASD drive · I/K raise/lower blade · B brake' },
  { id: 'drift-pickup', label: 'Drift Pickup', short: 'Pickup', kind: 'pickup', paint: '#47c3b4', topSpeed: 24, engineForce: 490, steering: 0.68, controls: 'WASD drive · Shift boost · Space jump · B brake' },
  { id: 'rover', label: 'Autonomous Rover', short: 'Rover', kind: 'rover', paint: '#8b83f6', topSpeed: 15, engineForce: 390, steering: 0.62, controls: 'WASD drive · Shift boost · Space jump · B brake' },
  { id: 'hatchback', label: 'City Hatchback', short: 'Hatchback', kind: 'hatchback', paint: '#65a6ea', topSpeed: 18, engineForce: 410, steering: 0.58, controls: 'WASD drive · Shift boost · Space jump · B brake' },
])

export function getVehicleProfile(id) {
  return VEHICLE_PROFILES.find((vehicle) => vehicle.id === id) ?? null
}
