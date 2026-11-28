'use client'

import {
  type MealType,
  mealTypeAt,
  mealTypeSchema,
  TEXT_MEAL_CHARS_MAX,
  type TextAnswer,
  textEstimateResponseSchema,
  type TextQuestion,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'

import { api } from '@/sync/backup'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable } from '@/ui/pressable'

import { pendingText, setPendingText } from './describe'
import { EstimateConfirm, type EstimateRow, toRows } from './estimate-confirm'
import { type EstimateProblem, problemOf } from './estimate-error'
import { ProblemNotice, problemActionClass } from './estimate-problem'
import { EstimateSkeleton } from './photo-estimate'

type Phase =
  | { kind: 'estimating' }
  | { kind: 'problem'; problem: EstimateProblem }
  | {
      kind: 'ready'
      dishName: string | null
      questions: TextQuestion[]
      assumptions: string | null
      items: EstimateRow[]
    }

interface Request {
  run: number
  text: string
  answers: TextAnswer[]
}

async function estimate(request: Request, locale: 'zh' | 'en'): Promise<Phase> {
  if (api === null) return { kind: 'problem', problem: 'signIn' }
  try {
    const response = await api.request(textEstimateResponseSchema, {
      method: 'POST',
      path: '/api/food/estimate-text',
      body: { text: request.text, locale, answers: request.answers },
    })
    if (response.items.length === 0) return { kind: 'problem', problem: 'no_text_food' }
    return {
      kind: 'ready',
      dishName: response.dishName,
      questions: response.questions,
      assumptions: response.assumptions,
      items: toRows(response.items),
    }
  } catch (error) {
    return { kind: 'problem', problem: problemOf(error) }
  }
}

const chipClass =
  'rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

// The text estimate (/food/describe, M3-10): a meal described in a sentence,
// estimated by the AI into the same confirm list as a photo. The AI may ask up
// to two questions with options; answering sends the description again once,
// and skipping logs the estimate as it is ("Describing a meal" in
// docs/design-system.md).
export function TextEstimate() {
  const t = useTranslations('describe')
  const tEstimate = useTranslations('estimate')
  const tFood = useTranslations('food')
  const locale = useLocale() === 'zh' ? 'zh' : 'en'
  const fieldId = useId()
  const [text, setText] = useState(pendingText)
  const [request, setRequest] = useState<Request | null>(null)
  const [result, setResult] = useState<{ run: number; phase: Phase } | null>(null)
  const [picked, setPicked] = useState<ReadonlyMap<number, string>>(new Map())
  const [mealType, setMealType] = useState<MealType>(() => mealTypeAt(new Date().getHours()))
  const phase: Phase | null =
    request === null ? null : result?.run === request.run ? result.phase : { kind: 'estimating' }

  // The handed-over text is read once; a later visit starts empty.
  useEffect(() => {
    setPendingText('')
  }, [])

  useEffect(() => {
    if (request === null) return
    let current = true
    void estimate(request, locale).then((next) => {
      if (current) setResult({ run: request.run, phase: next })
    })
    return () => {
      current = false
    }
  }, [request, locale])

  const send = (description: string, answers: TextAnswer[]) => {
    setPicked(new Map())
    setRequest((current) => ({ run: (current?.run ?? 0) + 1, text: description, answers }))
  }
  const description = text.trim()
  const canEstimate = description !== '' && phase?.kind !== 'estimating'
  // The button is offered until the description has been estimated as typed.
  const showEstimate = phase === null || phase.kind === 'problem' || request?.text !== description
  const submit = () => {
    if (canEstimate) send(description, [])
  }

  const problemAction = (problem: EstimateProblem) =>
    (problem === 'failed' || problem === 'timeout' || problem === 'offline') &&
    request !== null && (
      <Pressable
        onClick={() => {
          send(request.text, request.answers)
        }}
        className={problemActionClass}
      >
        {tEstimate('retry')}
      </Pressable>
    )

  const questionsCard = (questions: readonly TextQuestion[]) =>
    questions.length > 0 && (
      <section className="flex flex-col gap-16 rounded-group bg-surface p-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-section">{t('questions')}</h2>
          <p className="text-label text-ink-3">{t('questionsHint')}</p>
        </div>
        {questions.map((question, index) => (
          <div key={question.question} role="group" aria-label={question.question}>
            <p className="pb-8 text-body text-ink">{question.question}</p>
            <div className="flex flex-wrap gap-8">
              {question.options.map((option) => (
                <Pressable
                  key={option}
                  aria-pressed={picked.get(index) === option}
                  onClick={() => {
                    setPicked((current) => {
                      const next = new Map(current)
                      if (current.get(index) === option) next.delete(index)
                      else next.set(index, option)
                      return next
                    })
                  }}
                  className={chipClass}
                >
                  {option}
                </Pressable>
              ))}
            </div>
          </div>
        ))}
        <Pressable
          disabled={picked.size === 0 || request === null}
          onClick={() => {
            if (request === null) return
            send(
              request.text,
              questions.flatMap((question, index) => {
                const answer = picked.get(index)
                return answer === undefined ? [] : [{ question: question.question, answer }]
              }),
            )
          }}
          className="rounded-full bg-ink px-16 py-12 text-body font-semibold text-bg disabled:bg-sunk disabled:text-ink-3"
        >
          {t('update')}
        </Pressable>
      </section>
    )

  return (
    <div className="flex flex-col gap-20">
      <h1 className="text-title">{t('title')}</h1>
      <div className="flex flex-col gap-8">
        <label htmlFor={fieldId} className="text-label text-ink-3">
          {t('label')}
        </label>
        <textarea
          id={fieldId}
          value={text}
          rows={3}
          maxLength={TEXT_MEAL_CHARS_MAX}
          enterKeyHint="go"
          placeholder={t('placeholder')}
          onChange={(event) => {
            setText(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          className="w-full resize-none rounded-ctl bg-surface px-16 py-12 text-input text-ink placeholder:text-ink-3"
        />
        <p className="text-label text-ink-3">
          <span className="text-accent">{tEstimate('aiTag')}</span> {t('hint')}
        </p>
      </div>
      {showEstimate && (
        <Pressable
          disabled={!canEstimate}
          onClick={submit}
          className="rounded-full bg-ink px-16 py-12 text-body font-semibold text-bg disabled:bg-sunk disabled:text-ink-3"
        >
          {phase === null ? t('estimate') : t('estimateAgain')}
        </Pressable>
      )}
      <ChoiceGroup
        label={tEstimate('mealType')}
        options={mealTypeSchema.options}
        value={mealType}
        onChange={setMealType}
        optionLabel={(option) => tFood(`mealType.${option}`)}
      />
      {phase?.kind === 'estimating' && (
        <>
          <EstimateSkeleton />
          <p className="text-label text-ink-3" role="status">
            {t('wait')}
          </p>
        </>
      )}
      {phase?.kind === 'problem' && (
        <ProblemNotice problem={phase.problem} action={problemAction(phase.problem)} />
      )}
      {phase?.kind === 'ready' && request !== null && (
        <EstimateConfirm
          dishName={phase.dishName}
          items={phase.items}
          onItemsChange={(items) => {
            setResult({ run: request.run, phase: { ...phase, items } })
          }}
          mealType={mealType}
          assumptions={phase.assumptions}
          notice={
            <>
              {phase.assumptions !== null && (
                <p className="text-body text-ink-2">
                  <span className="text-label text-accent">{tEstimate('aiTag')}</span>{' '}
                  {t('assumed', { assumptions: phase.assumptions })}
                </p>
              )}
              {questionsCard(phase.questions)}
            </>
          }
        />
      )}
    </div>
  )
}
