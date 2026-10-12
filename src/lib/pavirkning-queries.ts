'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { hentTemaer, hentMaalOversikt, hentMaal, hentPolitiskKvarter } from './pavirkning-actions'

export const pavirkningKeys = {
  temaer: ['pavirkning', 'temaer'] as const,
  maalOversikt: (arkivert: boolean) => ['pavirkning', 'maal', arkivert ? 'arkiv' : 'aktive'] as const,
  maal: (id: string) => ['pavirkning', 'maal', id] as const,
  pk: (id: string) => ['pavirkning', 'pk', id] as const,
}

export function useTemaer() {
  return useQuery({
    queryKey: pavirkningKeys.temaer,
    queryFn: hentTemaer,
    staleTime: 5 * 60 * 1000,
  })
}

export function useMaalOversikt(arkivert = false) {
  return useQuery({
    queryKey: pavirkningKeys.maalOversikt(arkivert),
    queryFn: () => hentMaalOversikt(arkivert),
  })
}

export function useMaalDetaljer(maalId: string) {
  return useQuery({
    queryKey: pavirkningKeys.maal(maalId),
    queryFn: () => hentMaal(maalId),
    enabled: !!maalId,
  })
}

export function usePolitiskKvarter(pkId: string | null) {
  return useQuery({
    queryKey: pavirkningKeys.pk(pkId ?? ''),
    queryFn: () => hentPolitiskKvarter(pkId!),
    enabled: !!pkId,
  })
}

export function useInvaliderPavirkning() {
  const queryClient = useQueryClient()

  return {
    invaliderMaal: (maalId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['pavirkning', 'maal'] })
      if (maalId) queryClient.invalidateQueries({ queryKey: pavirkningKeys.maal(maalId) })
    },
    invaliderPK: (pkId: string) => {
      queryClient.invalidateQueries({ queryKey: pavirkningKeys.pk(pkId) })
    },
    invaliderAlt: () => {
      queryClient.invalidateQueries({ queryKey: ['pavirkning'] })
    },
  }
}
