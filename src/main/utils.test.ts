import { describe, it, expect } from 'vitest'
import { applySpokenCommands } from './utils'

describe('applySpokenCommands', () => {
  it('should replace punctuation words with symbols', () => {
    const input = 'Hello comma world period'
    expect(applySpokenCommands(input)).toBe('Hello, world.')
  })

  it('should handle new lines and paragraphs', () => {
    const input = 'Line one new line line two new paragraph paragraph two'
    expect(applySpokenCommands(input)).toBe('Line one\nline two\n\nparagraph two')
  })

  it('should handle French punctuation commands', () => {
    const input = 'Bonjour virgule comment ça va point d\'interrogation'
    expect(applySpokenCommands(input)).toBe('Bonjour, comment ça va?')
  })

  it('should handle bullet points', () => {
    const input = 'My list bullet point item one bullet point item two'
    expect(applySpokenCommands(input)).toBe('My list\n- item one\n- item two')
  })

  it('should clean up extra spaces around punctuation', () => {
    const input = 'Space before , and after .'
    expect(applySpokenCommands(input)).toBe('Space before, and after.')
  })

  it('should remove "copy that" command', () => {
    const input = 'Write this down copy that'
    expect(applySpokenCommands(input)).toBe('Write this down')
  })
})
