import { supabase } from './supabase'

/**
 * PostgREST `select=` string for the `flights` table with disambiguated FK
 * joins to `airports`. The FK names (`fk_origin` / `fk_destination`) are
 * required because both relations point at the same parent table.
 *
 * @example
 *   supabase.from('flights').select(FLIGHT_SELECT).eq('id', flightId).single()
 *
 * @type {string}
 */
export const FLIGHT_SELECT = '*, origin:airports!fk_origin(*), destination:airports!fk_destination(*)'

/**
 * Fetch the set of departure dates that have at least one available flight
 * for the given route. Used by the Home and SearchResults date pickers to
 * gray out days with no flights.
 *
 * Uses a two-step `city → UUID` lookup against `airports` to avoid the
 * PostgREST limitation where `.ilike()` on an embedded resource doesn't
 * filter the parent rows reliably.
 *
 * @param {Object}   opts
 * @param {string}   opts.origin       City name of the origin (case-insensitive). Optional.
 * @param {string}   opts.destination  City name of the destination. Optional.
 * @param {string=}  opts.afterDate    YYYY-MM-DD; only return dates strictly after this day.
 * @param {boolean=} opts.swapped      If true, swap origin/destination — used for
 *                                     return-leg availability on round trips.
 * @returns {Promise<Set<string>>}     Set of 'YYYY-MM-DD' strings. Empty set if either
 *                                     city isn't found.
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
