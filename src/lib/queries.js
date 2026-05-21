import { supabase } from './supabase'

/** Supabase select string for flights with disambiguated FK joins. */
export const FLIGHT_SELECT = '*, origin:airports!fk_origin(*), destination:airports!fk_destination(*)'

/** Read locally-stored trip references from localStorage. */
export function getLocalTrips() {
  try { return JSON.parse(localStorage.getItem('skybook_trips') || '[]') }
  catch { return [] }
}

/**
 * Fetches departure dates with at least one flight on the given route.
 * Uses a two-step city→UUID lookup to avoid unreliable PostgREST join-column
 * filtering with .ilike() on embedded resources.
 * @param {{ origin: string, destination: string, afterDate?: string, swapped?: boolean }} opts
 * @returns {Promise<Set<string>>} Set of 'YYYY-MM-DD' strings
 */
export async function fetchAvailableDates({ origin, destination, afterDate, swapped = false }) {
  const orig = swapped ? destination : origin
  const dest = swapped ? origin      : destination

  let query = supabase.from('flights').select('departure_time')

  if (orig && dest) {
    const [{ data: origAirport }, { data: destAirport }] = await Promise.all([
      supabase.from('airports').select('id').ilike('city', orig).single(),
      supabase.from('airports').select('id').ilike('city', dest).single(),
    ])
    if (!origAirport || !destAirport) return new Set()
    query = query
      .eq('origin_id',      origAirport.id)
      .eq('destination_id', destAirport.id)
  }

  if (afterDate) {
    query = query.gt('departure_time', `${afterDate}T23:59:59+00`)
  }

  const { data } = await query
  return new Set((data ?? []).map(f => f.departure_time.slice(0, 10)))
}
