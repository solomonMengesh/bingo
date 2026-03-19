import React from 'react';

const columns = {
  B: { from: 1, to: 15 },
  I: { from: 16, to: 30 },
  N: { from: 31, to: 45 },
  G: { from: 46, to: 60 },
  O: { from: 61, to: 75 },
};

const buildColumnNumbers = (from, to) => {
  const nums = [];
  for (let n = from; n <= to; n += 1) nums.push(n);
  return nums;
};

const getCalledClasses = (label) => {
  switch (label) {
    case 'B':
      return 'bg-red-500 text-white';
    case 'I':
      return 'bg-yellow-400 text-slate-900';
    case 'N':
      return 'bg-sky-500 text-white';
    case 'G':
      return 'bg-emerald-500 text-white';
    case 'O':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
};

const CallerBoard = ({ calledSet, currentNumber }) => {
  const currentVal = currentNumber?.value;

  return (
    <div className="rounded-3xl bg-[#020817] border border-slate-800 shadow-bingo-card overflow-hidden">
      <div className="grid grid-cols-5 bg-slate-900/90 px-2 py-1.5">
        {Object.keys(columns).map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-semibold tracking-[0.3em] text-amber-300"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex px-2 pb-2 pt-0 gap-0.5">
        {Object.entries(columns).map(([label, range]) => {
          const nums = buildColumnNumbers(range.from, range.to);
          return (
            <div
              key={label}
              className="flex-1 flex flex-col gap-0.5 items-center"
            >
              {nums.map((num) => {
                const isCalled = calledSet.has(num);
                const isCurrent = num === currentVal;
                const calledClass = getCalledClasses(label);
                return (
                  <div
                    key={num}
                    className={`h-6 w-6 rounded-lg flex items-center justify-center text-[8px] font-semibold
                      ${
                        isCurrent
                          ? `${calledClass} ring-2 ring-white shadow-lg`
                          : isCalled
                          ? calledClass
                          : 'bg-slate-800 text-slate-100'
                      }`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CallerBoard;

