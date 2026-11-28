'use client'

import type { EstimateAiRaw } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

const CONFIDENCE_STYLE: Record<EstimateAiRaw['confidence'], string> = {
  high: 'bg-accent-wash text-accent',
  medium: 'bg-sunk text-ink-2',
  low: 'bg-short-wash text-short',
}

// An estimated item's source tag and the model's confidence as a pill, so the
// level never reads as part of the label ("Confirm screen" in
// docs/design-system.md). Shared by the confirm screen and the meal sheet.
export function AiConfidence({ confidence }: { confidence: EstimateAiRaw['confidence'] }) {
  const t = useTranslations('estimate')
  return (
    <span className="flex items-center gap-4 text-label text-ink-3">
      <span className="text-accent">{t('aiTag')}</span>
      {t('confidenceLabel')}
      <span className={`rounded-ctl px-8 font-semibold ${CONFIDENCE_STYLE[confidence]}`}>
        {t(`confidence.${confidence}`)}
      </span>
    </span>
  )
}
