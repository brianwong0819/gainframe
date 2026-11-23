import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { GainframeDb, STORES_V1 } from './schema'

// Data on the phone cannot be repaired from the server, so every schema
// version is opened over a database written by the version before it.
describe('Dexie schema upgrades', () => {
  it('keeps version 1 rows when upgrading', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v1 = new Dexie('upgrade', options)
    v1.version(1).stores(STORES_V1)
    const workout = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      startedAt: '2026-11-08T10:00:00.000Z',
      endedAt: null,
      templateId: null,
      localDate: '2026-11-08',
      note: null,
    }
    await v1.table('workouts').add(workout)
    await v1.table('outbox').add({ table: 'workouts', rowId: workout.id })
    v1.close()

    const current = new GainframeDb('upgrade', options)
    const { templateId, ...rest } = workout
    expect(await current.workouts.get(workout.id)).toEqual({
      ...rest,
      planDayId: templateId,
      restStartedAt: null,
      restEndsAt: null,
    })
    expect(await current.outbox.toArray()).toEqual([
      { seq: 1, table: 'workouts', rowId: workout.id },
    ])
    expect(await current.errors.count()).toBe(0)
    expect(await current.foods.count()).toBe(0)
    expect(current.verno).toBe(14)
    current.close()
  })

  it('gives version 2 custom exercises no secondary muscles in version 3', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v2 = new Dexie('upgrade', options)
    v2.version(1).stores(STORES_V1)
    v2.version(2).stores({ errors: '++seq' })
    const exercise = {
      id: '01960000-0000-7000-8000-000000000002',
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      nameZh: '地雷管推举',
      nameEn: null,
      muscle: 'shoulders',
      equipment: 'barbell',
      defaultRestS: 90,
    }
    await v2.table('exercises').add(exercise)
    v2.close()

    const v3 = new GainframeDb('upgrade', options)
    expect(await v3.exercises.get(exercise.id)).toEqual({ ...exercise, secondaryMuscles: [] })
    expect(await v3.outbox.count()).toBe(0)
    expect(v3.verno).toBe(14)
    v3.close()
  })

  it('moves version 3 sets into one slot per workout and exercise in version 4', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v3 = new Dexie('upgrade', options)
    v3.version(1).stores(STORES_V1)
    v3.version(2).stores({ errors: '++seq' })
    v3.version(3).stores({})
    const workoutId = '01960000-0000-7000-8000-0000000000a1'
    const bench = '01960000-0000-7000-8000-0000000000b1'
    const row = (n: number, deletedAt: string | null = null) => ({
      id: `01960000-0000-7000-8000-00000000000${String(n)}`,
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt,
    })
    const set = (n: number, exerciseId: string, position: number, deletedAt: string | null) => ({
      ...row(n, deletedAt),
      workoutId,
      exerciseId,
      supersetGroup: n === 1 ? 2 : null,
      position,
      kind: 'working',
      weightKg: 60,
      reps: 8,
      rpe: null,
      completedAt: '2026-11-08T10:05:00.000Z',
    })
    // Bench (positions 0, 2) comes before squat (position 1, deleted).
    const sets = [
      set(1, bench, 0, null),
      set(2, '01960000-0000-7000-8000-0000000000b2', 1, '2026-11-08T10:06:00.000Z'),
      set(3, bench, 2, null),
    ]
    await v3.table('workoutSets').bulkAdd(sets)
    v3.close()

    const v4 = new GainframeDb('upgrade', options)
    const slots = await v4.workoutExercises.orderBy('id').toArray()
    const [benchSlot, squatSlot] = slots.toSorted((a, b) => a.position - b.position)
    expect(slots).toHaveLength(2)
    expect(benchSlot).toMatchObject({
      exerciseId: bench,
      position: 0,
      supersetGroup: 2,
      note: null,
    })
    expect(benchSlot?.deletedAt).toBeNull()
    expect(squatSlot?.position).toBe(1)
    expect(squatSlot?.deletedAt).not.toBeNull()

    for (const old of sets) {
      const moved = await v4.workoutSets.get(old.id)
      const slot = old.exerciseId === bench ? benchSlot : squatSlot
      expect(moved?.workoutExerciseId).toBe(slot?.id)
      expect(moved).not.toHaveProperty('supersetGroup')
      expect(moved?.updatedAt).not.toBe(old.updatedAt)
    }
    expect(await v4.outbox.count()).toBe(slots.length + sets.length)
    v4.close()
  })
  it("renames a version 4 workout's template to its plan day in version 5", async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v4 = new Dexie('upgrade', options)
    v4.version(1).stores(STORES_V1)
    v4.version(2).stores({ errors: '++seq' })
    v4.version(3).stores({})
    v4.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    const workout = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      updatedAt: '2026-11-09T10:00:00.000Z',
      deletedAt: null,
      startedAt: '2026-11-09T10:00:00.000Z',
      endedAt: '2026-11-09T11:00:00.000Z',
      templateId: null,
      localDate: '2026-11-09',
      note: null,
    }
    await v4.table('workouts').add(workout)
    v4.close()

    const v5 = new GainframeDb('upgrade', options)
    const { templateId, ...rest } = workout
    expect(await v5.workouts.get(workout.id)).toEqual({
      ...rest,
      planDayId: templateId,
      restStartedAt: null,
      restEndsAt: null,
    })
    expect(v5.tables.map((table) => table.name)).not.toContain('templates')
    expect(await v5.settings.count()).toBe(0)
    expect(await v5.outbox.count()).toBe(0)
    expect(v5.verno).toBe(14)
    v5.close()
  })

  it('gives version 5 exercise slots no rep range or rest in version 6', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v5 = new Dexie('upgrade', options)
    v5.version(1).stores(STORES_V1)
    v5.version(2).stores({ errors: '++seq' })
    v5.version(3).stores({})
    v5.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v5.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    const slot = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      updatedAt: '2026-11-09T10:00:00.000Z',
      deletedAt: null,
      workoutId: '01960000-0000-7000-8000-0000000000a1',
      exerciseId: '00000000-0000-7000-8000-000000000001',
      position: 0,
      supersetGroup: null,
      note: null,
    }
    await v5.table('workoutExercises').add(slot)
    v5.close()

    const v6 = new GainframeDb('upgrade', options)
    expect(await v6.workoutExercises.get(slot.id)).toEqual({
      ...slot,
      repsMin: null,
      repsMax: null,
      restS: null,
      planNote: null,
    })
    expect(await v6.outbox.count()).toBe(0)
    expect(v6.verno).toBe(14)
    v6.close()
  })

  it('gives version 6 plan items and slots no plan note in version 7', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v6 = new Dexie('upgrade', options)
    v6.version(1).stores(STORES_V1)
    v6.version(2).stores({ errors: '++seq' })
    v6.version(3).stores({})
    v6.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v6.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    v6.version(6).stores({})
    const row = {
      userId: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      updatedAt: '2026-11-09T10:00:00.000Z',
      deletedAt: null,
    }
    const item = {
      ...row,
      id: '01960000-0000-7000-8000-000000000001',
      planId: '01960000-0000-7000-8000-0000000000a1',
      planDayId: '01960000-0000-7000-8000-0000000000a2',
      exerciseId: '00000000-0000-7000-8000-000000000001',
      position: 0,
      supersetGroup: null,
      targetSets: 3,
      repsMin: 8,
      repsMax: 12,
      restS: null,
    }
    const slot = {
      ...row,
      id: '01960000-0000-7000-8000-000000000002',
      workoutId: '01960000-0000-7000-8000-0000000000a3',
      exerciseId: '00000000-0000-7000-8000-000000000001',
      position: 0,
      supersetGroup: null,
      note: 'Felt easy',
      repsMin: 8,
      repsMax: 12,
      restS: null,
    }
    await v6.table('planItems').add(item)
    await v6.table('workoutExercises').add(slot)
    v6.close()

    const v7 = new GainframeDb('upgrade', options)
    expect(await v7.planItems.get(item.id)).toEqual({ ...item, note: null })
    expect(await v7.workoutExercises.get(slot.id)).toEqual({ ...slot, planNote: null })
    expect(await v7.outbox.count()).toBe(0)
    expect(v7.verno).toBe(14)
    v7.close()
  })

  it('gives version 7 workouts no running rest in version 8', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v7 = new Dexie('upgrade', options)
    v7.version(1).stores(STORES_V1)
    v7.version(2).stores({ errors: '++seq' })
    v7.version(3).stores({})
    v7.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v7.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    v7.version(6).stores({})
    v7.version(7).stores({})
    const workout = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-13T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
      deletedAt: null,
      startedAt: '2026-11-13T10:00:00.000Z',
      endedAt: null,
      planDayId: null,
      localDate: '2026-11-13',
      note: null,
    }
    await v7.table('workouts').add(workout)
    v7.close()

    const v8 = new GainframeDb('upgrade', options)
    expect(await v8.workouts.get(workout.id)).toEqual({
      ...workout,
      restStartedAt: null,
      restEndsAt: null,
    })
    expect(await v8.outbox.count()).toBe(0)
    expect(v8.verno).toBe(14)
    v8.close()
  })

  it('gives each version 8 superset one rest and one number of rounds in version 9', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v8 = new Dexie('upgrade', options)
    v8.version(1).stores(STORES_V1)
    v8.version(2).stores({ errors: '++seq' })
    v8.version(3).stores({})
    v8.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v8.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    v8.version(6).stores({})
    v8.version(7).stores({})
    v8.version(8).stores({})
    const row = {
      userId: null,
      createdAt: '2026-11-17T10:00:00.000Z',
      updatedAt: '2026-11-17T10:00:00.000Z',
      deletedAt: null,
    }
    // Built-in exercise 1 rests 180 s by default, exercise 2 120 s.
    const item = (n: number, values: Record<string, unknown>) => ({
      ...row,
      id: `01960000-0000-7000-8000-00000000000${String(n)}`,
      planId: '01960000-0000-7000-8000-0000000000a1',
      planDayId: '01960000-0000-7000-8000-0000000000a2',
      exerciseId: '00000000-0000-7000-8000-000000000002',
      position: n,
      supersetGroup: 0,
      targetSets: 3,
      repsMin: 8,
      repsMax: 12,
      restS: 90,
      note: null,
      ...values,
    })
    const first = item(1, { exerciseId: '00000000-0000-7000-8000-000000000001', restS: null })
    const second = item(2, { targetSets: 4 })
    const alone = item(3, { supersetGroup: null, targetSets: 2, restS: 60 })
    const slot = (n: number, restS: number | null) => ({
      ...row,
      id: `01960000-0000-7000-8000-00000000001${String(n)}`,
      workoutId: '01960000-0000-7000-8000-0000000000a3',
      exerciseId: '00000000-0000-7000-8000-000000000002',
      position: n,
      supersetGroup: 0,
      note: null,
      repsMin: null,
      repsMax: null,
      restS,
      planNote: null,
    })
    await v8.table('planItems').bulkAdd([first, second, alone])
    await v8.table('workoutExercises').bulkAdd([slot(1, 90), slot(2, null)])
    v8.close()

    const v9 = new GainframeDb('upgrade', options)
    // A changed row keeps every value but the shared ones and a later updatedAt.
    const expectChanged = (stored: { updatedAt: string } | undefined, expected: object) => {
      const { updatedAt, ...rest } = { ...row, ...expected }
      expect(stored).toMatchObject(rest)
      expect(stored?.updatedAt).not.toBe(updatedAt)
    }
    expectChanged(await v9.planItems.get(first.id), { ...first, restS: 180, targetSets: 4 })
    expectChanged(await v9.planItems.get(second.id), { ...second, restS: 180 })
    expect(await v9.planItems.get(alone.id)).toEqual(alone)
    expectChanged(await v9.workoutExercises.get(slot(1, 0).id), slot(1, 120))
    expectChanged(await v9.workoutExercises.get(slot(2, 0).id), slot(2, 120))
    expect((await v9.outbox.toArray()).map(({ rowId }) => rowId)).toEqual([
      first.id,
      second.id,
      slot(1, 0).id,
      slot(2, 0).id,
    ])
    expect(v9.verno).toBe(14)
    v9.close()
  })

  it('adds empty meal tables in version 10 and a profile table in 11, keeping the outbox', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v9 = new Dexie('upgrade', options)
    v9.version(1).stores(STORES_V1)
    v9.version(2).stores({ errors: '++seq' })
    v9.version(3).stores({})
    v9.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v9.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    for (const version of [6, 7, 8, 9]) v9.version(version).stores({})
    await v9
      .table('outbox')
      .add({ table: 'workouts', rowId: '01960000-0000-7000-8000-000000000001' })
    v9.close()

    const v10 = new GainframeDb('upgrade', options)
    expect(await v10.meals.count()).toBe(0)
    expect(await v10.mealItems.where('mealId').equals('x').count()).toBe(0)
    expect(await v10.meals.where('localDate').equals('2026-11-22').count()).toBe(0)
    expect(await v10.profiles.count()).toBe(0)
    expect(await v10.outbox.count()).toBe(1)
    expect(v10.verno).toBe(14)
    v10.close()
  })

  it('adds a body metrics table in version 12 and empty body fields to a profile', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }
    const goals = {
      id: '01960000-0000-7000-8000-000000000002',
      createdAt: '2026-11-22T10:00:00.000Z',
      updatedAt: '2026-11-22T10:00:00.000Z',
      deletedAt: null,
      userId: null,
      proteinMode: 'fixed',
      proteinValue: 140,
      kcalTarget: 2800,
    }

    const v11 = new Dexie('upgrade', options)
    v11.version(1).stores(STORES_V1)
    v11.version(2).stores({ errors: '++seq' })
    v11.version(3).stores({})
    v11.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v11.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    for (const version of [6, 7, 8, 9]) v11.version(version).stores({})
    v11.version(10).stores({ meals: 'id, localDate', mealItems: 'id, mealId' })
    v11.version(11).stores({ profiles: 'id' })
    await v11.table('profiles').add(goals)
    v11.close()

    const v12 = new GainframeDb('upgrade', options)
    expect(await v12.profiles.get(goals.id)).toEqual({
      ...goals,
      sex: null,
      birthYear: null,
      heightCm: null,
      activityLevel: null,
      phase: null,
    })
    expect(await v12.bodyMetrics.where('localDate').equals('2026-11-23').count()).toBe(0)
    expect(await v12.outbox.count()).toBe(0)
    expect(v12.verno).toBe(14)
    v12.close()
  })

  it('gives version 12 rows the signed-in user in version 13 unless a change is waiting', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }
    const row = (id: string) => ({
      id,
      createdAt: '2026-11-22T10:00:00.000Z',
      updatedAt: '2026-11-22T10:00:00.000Z',
      deletedAt: null,
      userId: null,
      nameZh: '飞鸟',
    })
    const session = {
      userId: 'sub-1',
      email: 'someone@example.com',
      accessToken: 'access',
      accessExpiresAt: '2026-11-22T07:00:00.000Z',
      refreshToken: 'refresh',
      expired: false,
      method: 'email',
    }

    const v12 = new Dexie('upgrade', options)
    v12.version(1).stores(STORES_V1)
    v12.version(2).stores({ errors: '++seq' })
    v12.version(3).stores({})
    v12.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v12.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    for (const version of [6, 7, 8, 9]) v12.version(version).stores({})
    v12.version(10).stores({ meals: 'id, localDate', mealItems: 'id, mealId' })
    v12.version(11).stores({ profiles: 'id' })
    v12.version(12).stores({ bodyMetrics: 'id, localDate' })
    await v12.table('exercises').bulkAdd([row('backed-up'), row('waiting')])
    await v12.table('outbox').add({ table: 'exercises', rowId: 'waiting' })
    await v12.table('settings').add({ key: 'authSession', value: JSON.stringify(session) })
    v12.close()

    const v13 = new GainframeDb('upgrade', options)
    expect((await v13.exercises.get('backed-up'))?.userId).toBe('sub-1')
    expect((await v13.exercises.get('waiting'))?.userId).toBeNull()
    expect((await v13.exercises.get('backed-up'))?.updatedAt).toBe('2026-11-22T10:00:00.000Z')
    expect(await v13.outbox.count()).toBe(1)
    v13.close()
  })
})
