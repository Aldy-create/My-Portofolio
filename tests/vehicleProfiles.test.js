import test from 'node:test'
import assert from 'node:assert/strict'
import { VEHICLE_PROFILES, getVehicleProfile } from '../src/Game/Vehicles/vehicleProfiles.js'

test('fleet exposes seven unique drivable vehicle profiles', () => {
  assert.equal(VEHICLE_PROFILES.length, 7)
  assert.equal(new Set(VEHICLE_PROFILES.map(({ id }) => id)).size, 7)
  for (const vehicle of VEHICLE_PROFILES) {
    assert.ok(vehicle.label)
    assert.ok(vehicle.kind)
    assert.ok(vehicle.topSpeed > 0)
    assert.ok(vehicle.engineForce > 0)
  }
})

test('vehicle lookup returns matching profile or null for an unknown id', () => {
  assert.equal(getVehicleProfile('excavator').id, 'excavator')
  assert.equal(getVehicleProfile('not-a-vehicle'), null)
})
