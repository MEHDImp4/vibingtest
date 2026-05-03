export function applySpokenCommands(raw: string): string {
  let text = raw

  // Order matters: more specific phrases should come before general ones
  const replacements: Array<[RegExp, string]> = [
    [/\b(?:new paragraph|nouveau paragraphe|paragraphe suivant|saut de paragraphe)\b/gi, '\n\n'],
    [/\b(?:new line|line break|ligne suivante|nouvelle ligne|retour a la ligne|retour à la ligne)\b/gi, '\n'],
    [/\b(?:bullet point|puce|liste a puce|liste à puce|tiret)\b/gi, '\n- '],
    [/\b(?:open quote|ouvrez les guillemets|ouvrir les guillemets|guillemet ouvrant)\b/gi, '"'],
    [/\b(?:close quote|fermez les guillemets|fermer les guillemets|guillemet fermant)\b/gi, '"'],
    [/\b(?:open parenthesis|ouvrez la parenthese|ouvrez la parenthèse|parenthese ouvrante|parenthèse ouvrante)\b/gi, '('],
    [/\b(?:close parenthesis|fermez la parenthese|fermez la parenthèse|parenthese fermante|parenthèse fermante)\b/gi, ')'],
    [/\b(?:question mark|point d'interrogation|point interrogation)\b/gi, '?'],
    [/\b(?:exclamation mark|point d'exclamation|point exclamation)\b/gi, '!'],
    [/\b(?:point final)\b/gi, '.'],
    [/\b(?:semicolon|point virgule|point-virgule)\b/gi, ';'],
    [/\b(?:comma|virgule)\b/gi, ','],
    [/\b(?:period|full stop|point)\b/gi, '.'],
    [/\b(?:colon|deux points)\b/gi, ':'],
    [/\b(?:slash|barre oblique)\b/gi, '/'],
    [/\b(?:dash|em dash|tiret long)\b/gi, ' - '],
    [/\b(?:copy that|copie ca|copie ça)\b/gi, '']
  ]

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement)
  }

  return text
    // Clean up spaces around punctuation
    .replace(/[ \t]+([,.;:?!])/g, '$1')
    .replace(/([,.;:?!])(?=\S)/g, '$1 ')
    // Clean up spaces around newlines
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    // Clean up other artifacts
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
