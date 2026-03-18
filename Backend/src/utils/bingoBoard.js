// Must match frontend buildCartelaBoard so server validation matches client cards.
const COLUMN_RANGES = [
  { from: 1, to: 15 },
  { from: 16, to: 30 },
  { from: 31, to: 45 },
  { from: 46, to: 60 },
  { from: 61, to: 75 },
];

function buildCartelaBoard(cartelaNumber) {
  const seed = Math.max(1, Number(cartelaNumber) || 1);
  const shiftBase = (seed - 1) % 15;
  const rows = [];
  for (let r = 0; r < 5; r += 1) {
    const row = [];
    for (let c = 0; c < 5; c += 1) {
      const isFree = r === 2 && c === 2;
      if (isFree) {
        row.push({ value: null, isFree: true });
        continue;
      }
      const range = COLUMN_RANGES[c];
      const span = range.to - range.from + 1;
      const idx = (shiftBase + r + c * 3) % span;
      const value = range.from + idx;
      row.push({ value, isFree: false });
    }
    rows.push(row);
  }
  return rows;
}

function isCellHit(board, r, c, calledSet) {
  const cell = board[r]?.[c];
  if (!cell) return false;
  if (cell.isFree) return true;
  return typeof cell.value === 'number' && calledSet.has(cell.value);
}

/**
 * Bingo validation: horizontal + vertical + both diagonals (same rules as cartelaVerify).
 */
function hasBingo(board, calledSet) {
  if (!board || !calledSet) return false;
  const set = calledSet instanceof Set ? calledSet : new Set(calledSet);

  // Horizontal: any complete row
  for (let r = 0; r < 5; r += 1) {
    let rowComplete = true;
    for (let c = 0; c < 5; c += 1) {
      if (!isCellHit(board, r, c, set)) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) return true;
  }
  // Vertical: any complete column
  for (let c = 0; c < 5; c += 1) {
    let colComplete = true;
    for (let r = 0; r < 5; r += 1) {
      if (!isCellHit(board, r, c, set)) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }
  // Main diagonal (0,0)→(4,4)
  let main = true;
  for (let i = 0; i < 5; i += 1) {
    if (!isCellHit(board, i, i, set)) {
      main = false;
      break;
    }
  }
  if (main) return true;
  // Anti-diagonal (0,4)→(4,0)
  let anti = true;
  for (let i = 0; i < 5; i += 1) {
    if (!isCellHit(board, i, 4 - i, set)) {
      anti = false;
      break;
    }
  }
  return anti;
}

module.exports = { buildCartelaBoard, hasBingo };
