import React from 'react';

const columnLabels = ['B', 'I', 'N', 'G', 'O'];

const BingoBoard = ({ board, marked = new Set(), currentNumber, onCellClick, compact = false, highlight = new Set() }) => {
  const isMarked = (rowIdx, colIdx) => {
    const key = `${rowIdx}-${colIdx}`;
    return marked instanceof Set ? marked.has(key) : !!marked[key];
  };

  const isInPattern = (rowIdx, colIdx) => {
    const key = `${rowIdx}-${colIdx}`;
    return highlight instanceof Set ? highlight.has(key) : !!highlight[key];
  };

  const isCurrent = (value) => {
    if (!currentNumber) return false;
    return value === currentNumber.value;
  };

  const headerCls = compact ? 'gap-[2px] mb-1 text-[8px] font-bold' : 'gap-[3px] mb-2 text-[11px] font-bold';
  const headerCellCls = compact ? 'h-4 rounded-[4px]' : 'h-6 rounded-md';
  const cellCls = compact
    ? 'h-5 w-5 flex items-center justify-center text-[8px] font-semibold rounded-[4px] border'
    : 'h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center text-[10px] font-semibold rounded-[8px] border';
  const wrapperCls = compact
    ? 'inline-block rounded-xl bg-[#020817] border border-slate-800 shadow-bingo-card px-1.5 py-1.5'
    : 'inline-block rounded-3xl bg-[#020817] border border-slate-800 shadow-bingo-card px-3 py-3';
  const gridGap = compact ? 'gap-[2px]' : 'gap-[3px]';

  return (
    <div className={`${wrapperCls} text-white`}>
      {/* Colored BINGO header */}
      <div className={`grid grid-cols-5 ${headerCls}`}>
        <div className={`${headerCellCls} bg-red-500 flex items-center justify-center`}>B</div>
        <div className={`${headerCellCls} bg-yellow-400 flex items-center justify-center text-slate-900`}>I</div>
        <div className={`${headerCellCls} bg-sky-500 flex items-center justify-center`}>N</div>
        <div className={`${headerCellCls} bg-emerald-500 flex items-center justify-center`}>G</div>
        <div className={`${headerCellCls} bg-purple-500 flex items-center justify-center`}>O</div>
      </div>

      {/* 5x5 card */}
      <div className={`grid grid-cols-5 ${gridGap}`}>
        {board.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const markedCell = isMarked(rowIdx, colIdx);
            const inPattern = isInPattern(rowIdx, colIdx);
            const current = isCurrent(cell.value);
            const isFree = cell.isFree;

            const baseClasses = isFree
              ? 'bg-orange-500 text-white border-orange-600'
              : 'bg-white text-slate-900 border-slate-300';

            const markedClasses = !isFree
              ? 'bg-emerald-500 text-white border-emerald-600'
              : baseClasses;

            return (
              <button
                key={`${rowIdx}-${colIdx}`}
                type="button"
                onClick={() => onCellClick?.(rowIdx, colIdx, cell)}
                className={`${cellCls} transition
                  ${markedCell ? markedClasses : baseClasses}
                  ${inPattern ? 'border-4 border-yellow-400' : ''}
                  ${current && !markedCell ? 'shadow-[0_0_12px_rgba(251,191,36,0.8)]' : ''}
                `}
              >
                {isFree ? 'F' : cell.value}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BingoBoard;

