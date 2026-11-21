export const VEHICLE_PROFILES = Object.freeze([
  { id: 'buggy', label: 'Trail Buggy', kind: 'car', paint: '#ef604c', topSpeed: 20, engineForce: 420, steering: 0.56, controls: 'WASD drive · Shift boost · B brake' },
  { id: 'excavator', label: 'Excavator', kind: 'excavator', paint: '#f2ae28', topSpeed: 5.5, engineForce: 220, steering: 0.78, controls: 'W/S tracks · A/D steer · Q/E turret · I/K boom · J/L bucket' },
  { id: 'dump-truck', label: 'Dump Truck', kind: 'truck', paint: '#e67e22', topSpeed: 8, engineForce: 340, steering: 0.42, controls: 'WASD drive · Space raise/lower bed · B brake' },
  { id: 'bulldozer', label: 'Bulldozer', kind: 'dozer', paint: '#e3ad29', topSpeed: 6, engineForce: 320, steering: 0.48, controls: 'WASD drive · I/K blade · B brake' },
  { id: 'drift-pickup', label: 'Drift Pickup', kind: 'pickup', paint: '#47c3b4', topSpeed: 24, engineForce: 480, steering: 0.68, controls: 'WASD drive · Shift boost · B brake' },
  { id: 'rover', label: 'Autonomous Rover', kind: 'rover', paint: '#8b83f6', topSpeed: 14, engineForce: 360, steering: 0.62, controls: 'WASD drive · Shift boost · B brake' },
  { id: 'hatchback', label: 'City Hatchback', kind: 'hatchback', paint: '#65a6ea', topSpeed: 17, engineForce: 380, steering: 0.58, controls: 'WASD drive · Shift boost · B brake' },
])

export function getVehicleProfile(id) {
  return VEHICLE_PROFILES.find((vehicle) => vehicle.id === id) ?? null
}
