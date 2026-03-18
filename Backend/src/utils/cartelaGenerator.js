/**
 * Bingo cartela generation: 5×5 grid, B(1-15), I(16-30), N(31-45), G(46-60), O(61-75).
 * Center (row 2, col 2) is FREE. No repeated numbers within a column.
 */

const COLUMNS = [
  { from: 1, to: 15 },
  { from: 16, to: 30 },
  { from: 31, to: 45 },
  { from: 46, to: 60 },
  { from: 61, to: 75 },
];

const FREE_ROW = 2;
const FREE_COL = 2;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns one column of 5 distinct numbers from range. For column N (index 2), inserts null at position 2 (FREE).
 */
function pickColumn(columnIndex, count = 5) {
  const { from, to } = COLUMNS[columnIndex];
  const pool = [];
  for (let n = from; n <= to; n++) pool.push(n);
  const shuffled = shuffleArray(pool);
  const isN = columnIndex === 2;
  const result = [];
  let idx = 0;
  for (let i = 0; i < 5; i++) {
    if (isN && i === FREE_ROW) {
      result.push(null);
      continue;
    }
    result.push(shuffled[idx++]);
  }
  return result;
}

/**
 * Build a 5×5 grid. Rows are built so column c gets its values from COLUMNS[c].
 * Stored as numbers[row][col]; center (2,2) is null.
 */
function generateCartela() {
  const grid = [];
  for (let row = 0; row < 5; row++) {
    const rowArr = [];
    for (let col = 0; col < 5; col++) {
      if (row === FREE_ROW && col === FREE_COL) {
        rowArr.push(null);
        continue;
      }
      const { from, to } = COLUMNS[col];
      const pool = [];
      for (let n = from; n <= to; n++) pool.push(n);
      const shuffled = shuffleArray(pool);
      const usedInCol = rowArr.filter((x) => x != null).length;
      const usedAbove = grid.reduce((acc, r) => acc + (r[col] != null ? 1 : 0), 0);
      const alreadyInColumn = grid.map((r) => r[col]).filter((x) => x != null);
      const available = shuffled.filter((n) => !alreadyInColumn.includes(n));
      rowArr.push(available[0] ?? from);
    }
    grid.push(rowArr);
  }
  return grid;
}

/**
 * Generate a 5×5 grid with distinct numbers per column and FREE at center.
 * Uses column-major: for each column, pick 5 distinct (or 4 for N + null).
 */
function generateCartelaStrict() {
  const grid = [[], [], [], [], []];
  for (let c = 0; c < 5; c++) {
    const { from, to } = COLUMNS[c];
    const pool = [];
    for (let n = from; n <= to; n++) pool.push(n);
    const shuffled = shuffleArray(pool);
    const isN = c === 2;
    let pi = 0;
    for (let r = 0; r < 5; r++) {
      if (isN && r === FREE_ROW) {
        grid[r][c] = null;
        continue;
      }
      grid[r][c] = shuffled[pi++];
    }
  }
  return grid;
}

/**
 * Hash a grid for uniqueness (order-independent per column for simplicity: stringify rows).
 */
function hashCartela(grid) {
  return grid.map((row) => row.map((v) => (v == null ? 'F' : v)).join(',')).join('|');
}

/**
 * Generate a set of unique cartelas. Returns array of 5×5 grids.
 */
function generateCartelaPool(poolSize) {
  const seen = new Set();
  const pool = [];
  const maxAttempts = poolSize * 50;
  let attempts = 0;
  while (pool.length < poolSize && attempts < maxAttempts) {
    attempts++;
    const grid = generateCartelaStrict();
    const h = hashCartela(grid);
    if (seen.has(h)) continue;
    seen.add(h);
    pool.push(grid);
  }
  return pool;
}

module.exports = {
  generateCartela: generateCartelaStrict,
  generateCartelaPool,
  hashCartela,
  COLUMNS,
  FREE_ROW,
  FREE_COL,
};
