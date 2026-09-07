import * as migration_20260907_070109_initial from './20260907_070109_initial';

export const migrations = [
  {
    up: migration_20260907_070109_initial.up,
    down: migration_20260907_070109_initial.down,
    name: '20260907_070109_initial'
  },
];
