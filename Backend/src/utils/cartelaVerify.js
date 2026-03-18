/**
 * Bingo validation: 5×5 grid, center (2,2) = FREE (null).
 * Valid patterns only: horizontal row, vertical column, main diagonal, anti-diagonal.
 * Full house is NOT allowed.
 */

function isCellHit(numbers, r, c, calledSet) {
  const val = numbers[r]?.[c];
  if (val == null) return true; // FREE space counts as hit
  return calledSet.has(val);
}

/**
 * Returns true if the grid has any valid Bingo pattern.
 * Checks in order: horizontal rows → vertical columns → main diagonal → anti-diagonal.
 */
function hasBingo(numbers, calledNumbers) {
  if (!numbers || !Array.isArray(numbers) || numbers.length !== 5) return false;
  const set = calledNumbers instanceof Set ? calledNumbers : new Set(calledNumbers);

  // 1. Horizontal: any complete row (5 rows, indices 0–4)
  for (let r = 0; r < 5; r++) {
    let rowComplete = true;
    for (let c = 0; c < 5; c++) {
      if (!isCellHit(numbers, r, c, set)) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) return true;
  }

  // 2. Vertical: any complete column (5 columns, indices 0–4)
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) {
      if (!isCellHit(numbers, r, c, set)) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }

  // 3. Main diagonal: (0,0) → (1,1) → (2,2) → (3,3) → (4,4)
  let mainDiagComplete = true;
  for (let i = 0; i < 5; i++) {
    if (!isCellHit(numbers, i, i, set)) {
      mainDiagComplete = false;
      break;
    }
  }
  if (mainDiagComplete) return true;

  // 4. Anti-diagonal: (0,4) → (1,3) → (2,2) → (3,1) → (4,0)
  let antiDiagComplete = true;
  for (let i = 0; i < 5; i++) {
    if (!isCellHit(numbers, i, 4 - i, set)) {
      antiDiagComplete = false;
      break;
    }
  }
  if (antiDiagComplete) return true;

  return false;
}

module.exports = { hasBingo, isCellHit };
