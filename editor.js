// Match SourceCodePane::tab() in the official StanWarford/pep8 source.
// Columns are zero-based; inserted tabs are spaces in the saved source.
export function pep8TabSpaces(text, position) {
  const column = position - ((position === 0 ? -1 : text.lastIndexOf('\n', position - 1)) + 1);
  const width = column < 9 ? 9 - column
    : column < 17 ? 17 - column
    : column < 29 ? 29 - column
    : column === 29 ? 5
    : 4 - ((column - 30) % 4);
  return ' '.repeat(width);
}
