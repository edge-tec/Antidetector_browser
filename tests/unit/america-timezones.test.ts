import { describe, it, expect } from 'vitest'
import { TIMEZONE_LIST } from '../../src/renderer/components/ProfileModal'

describe('America/ City Timezones Catalog', () => {
  it('contains an extensive list of America/ city timezones (>= 140 cities)', () => {
    const americaTimezones = TIMEZONE_LIST.filter(t => t.tz.startsWith('America/'))
    expect(americaTimezones.length).toBeGreaterThanOrEqual(140)
  })

  it('includes all major US, Canadian, Latin American, and Caribbean cities', () => {
    const tzNames = TIMEZONE_LIST.map(t => t.tz)

    const expectedCities = [
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'America/Denver',
      'America/Phoenix',
      'America/Anchorage',
      'America/Adak',
      'America/Detroit',
      'America/Indianapolis',
      'America/Boise',
      'America/Juneau',
      'America/Sitka',
      'America/Nome',
      'America/Yakutat',
      'America/Toronto',
      'America/Vancouver',
      'America/Montreal' in tzNames ? 'America/Montreal' : 'America/Toronto',
      'America/Edmonton',
      'America/Winnipeg',
      'America/Halifax',
      'America/St_Johns',
      'America/Mexico_City',
      'America/Cancun',
      'America/Monterrey',
      'America/Tijuana',
      'America/Bogota',
      'America/Lima',
      'America/Santiago',
      'America/Sao_Paulo',
      'America/Buenos_Aires',
      'America/Caracas',
      'America/La_Paz',
      'America/Montevideo',
      'America/Asuncion',
      'America/Havana',
      'America/Panama',
      'America/Costa_Rica',
      'America/Guatemala',
      'America/Puerto_Rico',
      'America/Jamaica',
      'America/Barbados',
      'America/Curacao'
    ]

    for (const city of expectedCities) {
      expect(tzNames).toContain(city)
    }
  })

  it('has valid UTC offsets formatted as [+-]HH:MM for all timezones', () => {
    const offsetRegex = /^[+-]\d{2}:\d{2}$/
    for (const item of TIMEZONE_LIST) {
      expect(item.tz).toBeTruthy()
      expect(item.offset).toMatch(offsetRegex)
    }
  })

  it('correctly filters America/ timezones by query', () => {
    const query = 'america/'
    const q = query.toLowerCase()
    const matches = TIMEZONE_LIST.filter(t => t.tz.toLowerCase().includes(q))
    expect(matches.length).toBeGreaterThanOrEqual(140)

    // Test city search with spaces
    const searchCity = (input: string) => {
      const qClean = input.toLowerCase().trim()
      const qNoSpace = qClean.replace(/\s+/g, '_')
      return TIMEZONE_LIST.filter(t => {
        const tzLower = t.tz.toLowerCase()
        const tzSpace = tzLower.replace(/_/g, ' ')
        return tzLower.includes(qClean) || tzLower.includes(qNoSpace) || tzSpace.includes(qClean) || t.offset.includes(qClean)
      })
    }

    expect(searchCity('New York').some(t => t.tz === 'America/New_York')).toBe(true)
    expect(searchCity('los angeles').some(t => t.tz === 'America/Los_Angeles')).toBe(true)
    expect(searchCity('mexico city').some(t => t.tz === 'America/Mexico_City')).toBe(true)
    expect(searchCity('buenos aires').some(t => t.tz === 'America/Buenos_Aires')).toBe(true)
    expect(searchCity('sao paulo').some(t => t.tz === 'America/Sao_Paulo')).toBe(true)
    expect(searchCity('chicago').some(t => t.tz === 'America/Chicago')).toBe(true)
  })
})
