import * as migration_20260905_164055_initial from './20260905_164055_initial'

export const migrations = [
  {
    up: migration_20260905_164055_initial.up,
    down: migration_20260905_164055_initial.down,
    name: '20260905_164055_initial',
  },
]
