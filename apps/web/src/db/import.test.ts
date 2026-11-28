import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { exportData } from './export'
import { checkImport, type ExportFile, importData } from './import'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

let source: GainframeDb
let target: GainframeDb
let clock: Date

const open = (name: string) => new GainframeDb(name, { indexedDB: new IDBFactory(), IDBKeyRange })

beforeEach(() => {
  source = open('source')
  target = open('target')
  clock = new Date('2026-11-27T03:00:00.000Z')
})

afterEach(() => {
  source.close()
  target.close()
})

const now = () => clock

async function seed(db: GainframeDb) {
  const repos = createRepositories(db, now)
  const exercise = await repos.exercises.create({
    nameZh: '上斜哑铃卧推',
    nameEn: null,
    muscle: 'chest',
    secondaryMuscles: [],
    equipment: 'dumbbell',
    defaultRestS: 120,
  })
  const plan = await repos.plans.create({ name: 'PPL', activatedAt: clock.toISOString() })
  await repos.exerciseUnits.create({ exerciseId: exercise.id, weightUnit: 'lb' })
  return { repos, exercise, plan }
}

async function exportText(db: GainframeDb) {
  return JSON.stringify(await exportData(db, 'abc1234', '2026-11-27T03:05:00.000Z'))
}

async function readyFile(text: string): Promise<ExportFile> {
  const check = await checkImport(target, text)
  if (check.status !== 'ready') throw new Error(`file not ready: ${check.status}`)
  return check.preview.file
}

describe('checkImport', () => {
  it('counts what the file holds and what it would change', async () => {
    await seed(source)
    const check = await checkImport(target, await exportText(source))
    expect(check).toMatchObject({
      status: 'ready',
      preview: { workouts: 0, plans: 1, exercises: 1, meals: 0, weighIns: 0, changes: 3 },
    })
  })

  it('refuses a file that is not a Gainframe export', async () => {
    expect(await checkImport(target, 'not json')).toEqual({ status: 'notExport' })
    expect(await checkImport(target, '{"format":"other"}')).toEqual({ status: 'notExport' })
  })

  it('refuses a file from a newer database version', async () => {
    const text = (await exportText(source)).replace(
      `"databaseVersion":${String(target.verno)}`,
      `"databaseVersion":${String(target.verno + 1)}`,
    )
    expect(await checkImport(target, text)).toEqual({ status: 'newerApp' })
  })

  it('refuses the whole file when one row fails its schema', async () => {
    const { exercise } = await seed(source)
    const text = (await exportText(source)).replace(`"id":"${exercise.id}"`, '"id":"broken"')
    expect(await checkImport(target, text)).toEqual({ status: 'invalid' })
  })
})

describe('importData', () => {
  it('copies every row with its ID and queues it for backup, exercises first', async () => {
    const { exercise, plan } = await seed(source)
    const text = await exportText(source)

    expect(await importData(target, await readyFile(text))).toBe(3)

    expect(await target.exercises.get(exercise.id)).toEqual(exercise)
    expect(await target.plans.get(plan.id)).toEqual(plan)
    const outbox = await target.outbox.orderBy('seq').toArray()
    expect(outbox.map((entry) => entry.table)).toEqual(['exercises', 'plans', 'exerciseUnits'])
  })

  it('files rows under no account, so the next push sends them to the signed-in one', async () => {
    const { exercise } = await seed(source)
    await source.exercises.update(exercise.id, { userId: 'dev-account' })

    await importData(target, await readyFile(await exportText(source)))

    expect((await target.exercises.get(exercise.id))?.userId).toBeNull()
  })

  it('keeps the newer version of a row on either side and leaves rows only on the device', async () => {
    const { repos, exercise, plan } = await seed(source)
    await target.exercises.put(exercise)
    await target.plans.put(plan)
    const own = await createRepositories(target, now).exercises.create({
      nameZh: '哑铃飞鸟',
      nameEn: null,
      muscle: 'chest',
      secondaryMuscles: [],
      equipment: 'dumbbell',
      defaultRestS: 90,
    })
    clock = new Date('2026-11-27T04:00:00.000Z')
    const renamedInFile = await repos.plans.update(plan.id, { name: 'Push Pull Legs' })
    const renamedOnDevice = await createRepositories(target, now).exercises.update(exercise.id, {
      nameZh: '上斜卧推',
    })
    await target.outbox.clear()

    expect(await importData(target, await readyFile(await exportText(source)))).toBe(2)

    expect(await target.plans.get(plan.id)).toEqual({ ...renamedInFile, userId: null })
    expect(await target.exercises.get(exercise.id)).toEqual(renamedOnDevice)
    expect(await target.exercises.get(own.id)).toEqual(own)
  })

  it('changes nothing when the same file is imported twice', async () => {
    await seed(source)
    const text = await exportText(source)
    await importData(target, await readyFile(text))

    const again = await checkImport(target, text)
    expect(again).toMatchObject({ status: 'ready', preview: { changes: 0 } })
    expect(await importData(target, await readyFile(text))).toBe(0)
    expect(await target.outbox.count()).toBe(3)
  })

  it('reads deleted rows as deleted', async () => {
    const { repos, exercise } = await seed(source)
    await repos.exercises.remove(exercise.id)

    await importData(target, await readyFile(await exportText(source)))

    expect((await target.exercises.get(exercise.id))?.deletedAt).not.toBeNull()
  })
})
